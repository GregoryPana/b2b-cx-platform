import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source = readFileSync(process.env.REVIEW_SOURCE_FILE || new URL('./SurveyWorkspacePage.tsx', import.meta.url), 'utf8');
const section = (a,b) => source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const draft = score => ({score, answer_text:'',verbatim:'',actions:[]});
const row = (id,score) => ({question_id:id,score,response_id:`r${id}`,answer_text:'',verbatim:'',actions:[]});
function setup() {
 const calls=[], requests=[];
 const s={ API_BASE:'/api', headers:{}, Date, Error, Set, JSON, todayString:'2026-10-19',
  visitId:'A', responseDrafts:{1:draft('1'),2:draft('2')}, responsesByQuestion:{}, emptyDraft:draft(''),
  visitScope:{current:{id:'A',saves:new Set()}}, responseReadScope:{current:null}, overdueInFlight:{current:new Set()},
  parseChoices:()=>[], ACTION_TIMEFRAME_OPTIONS:[], normalizeYesNo:x=>x,
  window:{confirm:()=>true}, resolveBusinessName:()=> 'Fixture',
  fetch:(url,options={})=>{const d=deferred(); requests.push({url,options,...d});return d.promise;},
  pushToast:(...v)=>calls.push(['toast',...v]), navigate:(v)=>calls.push(['navigate',v]),
  loadDrafts:async()=>calls.push(['reload']),
  questionnaireReady:true, visibleQuestions:[{id:1,input_type:'score',is_mandatory:true,score_min:0,score_max:10}],
  responseDraftsRef:{current:{1:draft('1'),2:draft('2')}},
  saveActiveVisitDetails:async()=>true,
 };
 for(const name of ['Error','Message','VisitId','Status','VisitSource','SelectedDraftId','IsViewingSubmitted','SavingQuestionId','IsSubmittingVisit','IsCreatingVisit','SubmissionSignature','VisitForm','AccountExecutiveSearch','ResponsesByQuestion','ResponseDrafts']) {
  const key=name[0].toLowerCase()+name.slice(1);
  s['set'+name]=value=>{s[key]=typeof value==='function'?value(s[key]||{}):value;calls.push([key,s[key]]);};
 }
 const helpers=source.includes('  const beginVisitSelection =') ? section('  const beginVisitSelection =','  const loadVisitResponses =') : '';
 const code=section('function normalizeResponseDraftForCompare','export default')+helpers+
  section('  const loadVisitResponses =','  const resolveBusinessName =')+
  section('  const handleSelectPlannedVisit =','  const handleViewSubmittedVisit =')+
  section('  const buildResponsePayload =','  const todayString =')+
  '\nthis.submit=handleSubmitVisit;this.save=handleSaveQuestionResponse;this.select=handleSelectPlannedVisit;this.overdue=handleSelectOverdueVisit;this.begin=beginVisitSelection;';
 vm.createContext(s);vm.runInContext(transformSync(code,{loader:'tsx'}).code,s);
 return {s,calls,requests};
}
const q={id:1,input_type:'score',score_min:0,score_max:10};
async function postAccepted(h) {h.requests[0].resolve({ok:true,json:async()=>({})});await tick();}
function respond(req,data,ok=true) {
 if(data.responses && !data.id)data={id:req.url.split('/dashboard-visits/')[1].split('?')[0],...data};
 req.resolve({ok,json:async()=>data});
}

for (const mandatory of [false,true]) test(`independent explicit clear old text mandatory=${mandatory}`,async()=>{
 const h=setup();h.s.visibleQuestions=[{...q,is_mandatory:true},{id:3,question_number:3,input_type:'text',is_mandatory:mandatory}];
 h.s.responseDrafts={1:draft('1'),3:{...draft(''),answer_text:''}};h.s.responseDraftsRef.current=h.s.responseDrafts;
 h.s.responsesByQuestion={3:{...row(3,null),answer_text:'OLD'}};
 const p=h.s.submit();await tick();respond(h.requests[0],row(1,1));await tick();
 respond(h.requests[1],{responses:[row(1,1),{...row(3,null),answer_text:'OLD'}]});await tick();
 const advanced=Boolean(h.requests[2]?.url.includes('/submit?'));
 if(advanced)respond(h.requests[2],{status:'Pending'});await p;
 console.log(JSON.stringify({probe:'explicit-clear',mandatory,advanced,error:h.s.error||'',draft:h.s.responseDrafts[3],methods:h.requests.map(r=>r.options.method||'GET')}));
 assert.equal(advanced,false,'explicit clear must persist/verify clear or block Q3, not submit OLD');
});
test('independent score whitespace is not numeric zero',async()=>{
 const h=setup();h.s.responseDrafts={1:draft('  ')};const p=h.s.save(q);await tick();
 const attempted=Boolean(h.requests[0]);if(attempted){respond(h.requests[0],row(1,0));await tick();respond(h.requests[1],{responses:[row(1,0)]});}await p;
 console.log(JSON.stringify({probe:'blank-score',attempted,payload:attempted?JSON.parse(h.requests[0].options.body):null,error:h.s.error||''}));
 assert.equal(attempted,false,'whitespace score must not write 0');
});

test('independent selection while submit in flight resets current loading',async()=>{
 const h=setup();const a=h.s.submit();await tick();respond(h.requests[0],row(1,1));await tick();respond(h.requests[1],{responses:[row(1,1)]});await tick();
 assert.equal(h.s.isSubmittingVisit,true);const b=h.s.select({visit_id:'B'});respond(h.requests[3],{responses:[row(2,2)]});await b;
 respond(h.requests[2],{status:'Pending'});await a;
 console.log(JSON.stringify({probe:'selection-submit-loading',visit:h.s.visitId,loading:h.s.isSubmittingVisit}));
 assert.equal(h.s.isSubmittingVisit,false,'B must not retain invalidated A submit loading');
});

for (const value of ['  ', NaN, Infinity, -Infinity, null, true, [], {}, 'NaN', 'Infinity', '-1', '11']) {
 for (const mode of ['save','submit']) test(`invalid score ${String(value)} (${typeof value}) blocks ${mode} mutation and preserves drafts`, async()=>{
  const h=setup(); h.s.responseDrafts={1:draft(value)}; h.s.responseDraftsRef.current=h.s.responseDrafts;
  const before=h.s.responseDrafts; let writes=0;
  h.s.fetch=async(url,options={})=>{if(options.method)writes++;return {ok:true,json:async()=>options.method?row(1,0):{id:'A',responses:[row(1,0)]}};};
  await h.s[mode](q); assert.equal(writes,0); assert.equal(h.s.responseDrafts,before); assert.notEqual(h.s.status,'Pending');
 });
}
for(const value of [0,'0']) for(const mode of ['save','submit']) test(`legitimate zero ${typeof value} supports ${mode}`,async()=>{
 const h=setup();h.s.responseDrafts={1:draft(value)};h.s.responseDraftsRef.current=h.s.responseDrafts;let writes=[];
 h.s.fetch=async(url,options={})=>{if(options.method)writes.push({url,...options});return {ok:true,json:async()=>url.includes('/submit?')?{status:'Pending'}:options.method?row(1,0):{id:'A',responses:[row(1,0)]}};};
 await h.s[mode](q);assert.equal(JSON.parse(writes[0].body).score,0);
 if(mode==='submit')assert.equal(h.s.status,'Pending');else assert.equal(h.s.message,'Response saved.');
});
for(const present of [false,true]) test(`optional blank without old server answer remains optional present=${present}`,async()=>{
 const h=setup();h.s.visibleQuestions.push({id:3,input_type:'text',is_mandatory:false});
 if(present)h.s.responseDrafts[3]=draft('');h.s.responseDraftsRef.current=h.s.responseDrafts;
 h.s.fetch=async(url,options={})=>({ok:true,json:async()=>url.includes('/submit?')?{status:'Pending'}:options.method?row(1,1):{id:'A',responses:[row(1,1)]}});
 await h.s.submit();assert.equal(h.s.status,'Pending');assert.ok(h.calls.some(c=>c[0]==='toast'&&/optional.*Q3/.test(c[2])));
});
for(const type of ['score','yes_no']) test(`explicit ${type} clear blocks stale old value after other progress saves`,async()=>{
 const h=setup();h.s.visibleQuestions.push({...q,id:3,question_number:33,input_type:type,is_mandatory:false});
 h.s.responseDrafts[3]=draft('');h.s.responseDraftsRef.current=h.s.responseDrafts;
 const old={...row(3,type==='score'?0:null),answer_text:type==='yes_no'?'Y':''};h.s.responsesByQuestion={3:old};
 h.s.fetch=async(url,options={})=>{h.requests.push({url,options});return {ok:true,json:async()=>options.method?row(1,1):{id:'A',responses:[row(1,1),old]}};};
 await h.s.submit();assert.equal(h.requests.filter(r=>r.options.method==='POST').length,1);assert.ok(!h.requests.some(r=>r.url.includes('/submit?')));assert.match(h.s.error,/Q33/);assert.equal(h.s.responsesByQuestion[1].score,1);
});
for(const old of ['Y','N']) for(const local of [undefined,'','Y','N','invalid']) test(`Q16 old=${old} local=${local} uses explicit draft presence`,()=>{
 const h=setup();h.s.questions=[{id:16,question_key:'parent'},{id:17,question_key:'child1'},{id:18,question_key:'child2'}];
 Object.assign(h.s,{Q16_KEY:'parent',Q17_KEY:'child1',Q18_KEY:'child2',useMemo:fn=>fn(),responsesByQuestion:{16:{answer_text:old}},responseDrafts:local===undefined?{}:{16:{answer_text:local}}});
 vm.runInContext(transformSync(section('  const visibleQuestions =','  const questionnaireReady =')+'this.visible=visibleQuestions;',{loader:'tsx'}).code,h.s);
 assert.equal(h.s.visible.length,(local===undefined?old:local)==='Y'?3:1);
});
for(const outcome of ['success','http-error','network-error']) test(`A pending submit -> B can submit, obsolete ${outcome} cannot clear B pending`,async()=>{
 const h=setup();const a=h.s.submit();await tick();respond(h.requests[0],row(1,1));await tick();respond(h.requests[1],{responses:[row(1,1)]});await tick();
 const b=h.s.select({visit_id:'B'});respond(h.requests[3],{responses:[row(1,1)]});await b;
 assert.equal(h.s.isSubmittingVisit,false);h.s.responseDraftsRef.current=h.s.responseDrafts;
 const next=h.s.submit();await tick();respond(h.requests[4],{responses:[row(1,1)]});await tick();
 assert.equal(h.s.isSubmittingVisit,true);assert.match(h.requests[5].url,/B\/submit/);
 if(outcome==='network-error')h.requests[2].reject(Error('offline'));else respond(h.requests[2],{status:'Pending',detail:'rejected'},outcome==='success');
 await a;assert.equal(h.s.isSubmittingVisit,true);assert.notEqual(h.s.status,'Pending');
 respond(h.requests[5],{status:'Pending'});await next;assert.equal(h.s.isSubmittingVisit,false);assert.equal(h.s.status,'Pending');
});
test('selection resets invalidated creation/header loading without releasing per-question new-owner locks',()=>{
 const h=setup();h.s.isCreatingVisit=true;h.s.isSubmittingVisit=true;
 const owner=h.s.begin('B');assert.equal(h.s.isCreatingVisit,false);assert.equal(h.s.isSubmittingVisit,false);assert.equal(owner.saves.size,0);assert.equal(h.s.savingQuestionId,null);
});

for(const old of ['Y','N']) test(`actual final Submit blocks cleared Q16 with old ${old}, preserving Q1`,async()=>{
 const h=setup();h.s.visibleQuestions.push({id:16,question_number:16,question_key:'canonical-parent',input_type:'yes_no',is_mandatory:true});
 h.s.responseDrafts[16]=draft('');h.s.responseDraftsRef.current=h.s.responseDrafts;const previous={...row(16,null),answer_text:old};h.s.responsesByQuestion={16:previous};
 h.s.fetch=async(url,options={})=>{h.requests.push({url,options});return {ok:true,json:async()=>options.method?row(1,1):{id:'A',responses:[row(1,1),previous]}};};
 await h.s.submit();assert.equal(h.requests.length,2);assert.equal(h.s.responsesByQuestion[1].score,1);assert.match(h.s.error,/Q16/);assert.notEqual(h.s.status,'Pending');assert.equal(h.s.responseDrafts[16].answer_text,'');
});

test('absent optional local draft can retain existing saved server answer',async()=>{
 const h=setup();h.s.visibleQuestions.push({id:3,input_type:'text',is_mandatory:false});const old={...row(3,null),answer_text:'OLD'};
 h.s.responsesByQuestion={3:old};h.s.fetch=async(url,options={})=>({ok:true,json:async()=>url.includes('/submit?')?{status:'Pending'}:options.method?row(1,1):{id:'A',responses:[row(1,1),old]}});
 await h.s.submit();assert.equal(h.s.status,'Pending');assert.equal(h.s.responseDrafts[3],undefined);
});

for(const outcome of ['success','http-error']) test(`actual pending create invalidated by selection ignores old ${outcome}/finally`,async()=>{
 const h=setup();Object.assign(h.s,{visitSource:'planned',selectedDraftId:'A',userId:'fixture',visitForm:{visit_date:'2026-10-19',visit_type:'scheduled',account_executive_name:'',team_member_names:[]},normalizeTeamMemberNames:x=>x});
 vm.runInContext(transformSync(section('  const handleCreateVisit =','  const saveActiveVisitDetails =')+'this.create=handleCreateVisit;',{loader:'tsx'}).code,h.s);
 const a=h.s.create();assert.equal(h.s.isCreatingVisit,true);
 const b=h.s.select({visit_id:'B'});assert.equal(h.s.isCreatingVisit,false);respond(h.requests[1],{responses:[row(1,1)]});await b;
 h.s.selectedDraftId='B';const next=h.s.create();assert.equal(h.s.isCreatingVisit,true);
 respond(h.requests[0],{visit_id:'A',detail:'old rejected'},outcome==='success');await a;
 assert.equal(h.s.isCreatingVisit,true);assert.equal(h.s.visitId,'B');
 respond(h.requests[2],{visit_id:'B'},true);await tick();respond(h.requests[3],{responses:[row(1,1)]});await next;
 assert.equal(h.s.isCreatingVisit,false);assert.equal(h.s.visitId,'B');
});
