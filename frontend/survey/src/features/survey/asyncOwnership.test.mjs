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
  '\nthis.submit=handleSubmitVisit;this.save=handleSaveQuestionResponse;this.select=handleSelectPlannedVisit;this.overdue=handleSelectOverdueVisit;';
 vm.createContext(s);vm.runInContext(transformSync(code,{loader:'tsx'}).code,s);
 return {s,calls,requests};
}
const q={id:1,input_type:'score',score_min:0,score_max:10};
async function postAccepted(h) {h.requests[0].resolve({ok:true,json:async()=>({})});await tick();}
function respond(req,data,ok=true) {
 if(data.responses && !data.id)data={id:req.url.split('/dashboard-visits/')[1].split('?')[0],...data};
 req.resolve({ok,json:async()=>data});
}
for(const edit of ['none','other','saved']) test(`actual Save preserves unrelated drafts and pending ${edit} edits`,async()=>{
 const h=setup();const p=h.s.save(q);await postAccepted(h);
 if(edit==='other')h.s.responseDrafts={...h.s.responseDrafts,2:draft('9')};
 if(edit==='saved')h.s.responseDrafts={...h.s.responseDrafts,1:draft('8')};
 respond(h.requests[1],{responses:[row(1,1)]});await p;
 assert.equal(h.s.responseDrafts[2].score,edit==='other'?'9':'2');
 assert.equal(h.s.responseDrafts[1].score,edit==='saved'?'8':'1');
 assert.equal(h.s.responsesByQuestion[1].score,1);
});
test('actual Save accepted POST/readback failure retains both drafts and warns',async()=>{
 const h=setup();const p=h.s.save(q);await postAccepted(h);h.requests[1].reject(Error('offline'));await p;
 assert.equal(h.s.responseDrafts[2].score,'2');assert.equal(h.s.responseDrafts[1].score,'1');
 assert.match(h.s.error,/saved|accepted|verify|confirm/i);
});
for(const phase of ['post','get'])test(`switch visit during Save ${phase} ignores obsolete completion`,async()=>{
 const h=setup();const p=h.s.save(q);if(phase==='get')await postAccepted(h);
 const next=h.s.select({visit_id:'B',visit_date:'2026-10-19'});const nextReq=h.requests.at(-1);
 respond(nextReq,{responses:[row(3,3)]});await next;const before=h.calls.length;
 if(phase==='post')respond(h.requests[0],{});else respond(h.requests[1],{responses:[row(1,1)]});
 await tick();if(phase==='post' && h.requests.length>2)respond(h.requests.at(-1),{responses:[row(1,1)]});
 await p;assert.equal(h.s.responseDrafts[1],undefined);assert.equal(h.s.responseDrafts[3].score,'3');
 assert.equal(h.calls.length,before);
});
test('planned resume A/B reversed readbacks retain only B with no old drafts',async()=>{
 const h=setup();const a=h.s.select({visit_id:'A'});const b=h.s.select({visit_id:'B'});
 respond(h.requests[1],{responses:[row(3,3)]});await b;respond(h.requests[0],{responses:[row(1,1)]});await a;
 assert.equal(h.s.visitId,'B');assert.equal(h.s.responseDrafts[1],undefined);assert.equal(h.s.responseDrafts[3].score,'3');
});
test('overdue reversed PUTs cannot reselect A after B',async()=>{
 const h=setup();const a=h.s.overdue({visit_id:'A'});const b=h.s.overdue({visit_id:'B'});
 respond(h.requests[1],{});await tick();respond(h.requests[2],{responses:[row(3,3)]});await b;
 respond(h.requests[0],{});await tick();
 // Complete any obsolete GET too, so a bad implementation fails rather than hangs.
 if(h.requests[3])respond(h.requests[3],{responses:[row(1,1)]});await a;
 assert.equal(h.s.visitId,'B');assert.equal(h.s.responseDrafts[1],undefined);assert.equal(h.requests.length,3);
 assert.ok(h.requests.every(r=>r.options.method!=='POST'));
});
test('overdue duplicate click is one PUT; accepted date/readback failure retains identity/date and warns',async()=>{
 const h=setup();const a=h.s.overdue({visit_id:'A',visit_date:'2026-10-01'});
 const duplicate=h.s.overdue({visit_id:'A',visit_date:'2026-10-01'});
 assert.equal(h.requests.length,1);respond(h.requests[0],{});await tick();h.requests[1].reject(Error('offline'));
 await Promise.all([a,duplicate]);assert.equal(h.s.visitId,'A');assert.equal(h.s.visitForm.visit_date,'2026-10-19');
 assert.match(h.s.error,/date.*updated|accepted/i);assert.match(h.s.error,/check|confirm/i);
});

for(const confirmed of [true,false])test(`repeat Save confirmation ${confirmed} uses same response ID, never creates duplicate`,async()=>{
 const h=setup();h.s.responsesByQuestion={1:row(1,0)};h.s.window.confirm=()=>confirmed;
 const p=h.s.save(q);
 if(!confirmed){await p;assert.equal(h.requests.length,0);assert.equal(h.s.responseDrafts[1].score,'1');return;}
 assert.equal(h.requests[0].options.method,'PUT');assert.match(h.requests[0].url,/\/responses\/r1\?/);
 respond(h.requests[0],row(1,1));await tick();respond(h.requests[1],{responses:[row(1,1)]});await p;
 assert.equal(h.s.message,'Response saved.');
});
test('Save acknowledgement waits for exact server readback',async()=>{
 const h=setup();const p=h.s.save(q);respond(h.requests[0],row(1,1));await tick();
 assert.notEqual(h.s.message,'Response saved.');respond(h.requests[1],{responses:[row(1,9)]});await p;
 assert.notEqual(h.s.message,'Response saved.');assert.equal(h.s.responseDrafts[1].score,'1');
});
test('accepted save keeps response ID when readback fails; retry preflights and uses PUT',async()=>{
 const h=setup();const p=h.s.save(q);respond(h.requests[0],row(1,1));await tick();h.requests[1].reject(Error('offline'));await p;
 assert.equal(h.s.visitScope.current.records[1].response_id,'r1');
 const retry=h.s.save(q);assert.equal(h.requests[2].options.method,undefined);
 respond(h.requests[2],{responses:[row(1,1)]});await tick();assert.equal(h.requests[3].options.method,'PUT');
 respond(h.requests[3],row(1,1));await tick();respond(h.requests[4],{responses:[row(1,1)]});await retry;
 assert.equal(h.requests.filter(r=>r.options.method==='POST').length,1);
});
for(const missing of ['none','required','optional'])test(`end-only Submit persists answered question before checking ${missing} omissions`,async()=>{
 const h=setup();h.s.visibleQuestions=[{...q,is_mandatory:true}];
 if(missing!=='none')h.s.visibleQuestions.push({id:3,input_type:'text',is_mandatory:missing==='required'});
 const p=h.s.submit();await tick();assert.equal(h.requests[0].options.method,'POST');
 respond(h.requests[0],row(1,1));await tick();respond(h.requests[1],{responses:[row(1,1)]});await tick();
 if(missing==='required'){
  await p;assert.equal(h.requests.length,2);assert.match(h.s.error,/Answers saved.*Q3/);
  assert.equal(h.s.responsesByQuestion[1].score,1);assert.notEqual(h.s.status,'Pending');
 }else{
  assert.match(h.requests[2].url,/\/submit\?/);respond(h.requests[2],{status:'Pending'});await p;assert.equal(h.s.status,'Pending');
  if(missing==='optional')assert.ok(h.calls.some(c=>c[0]==='toast'&&/optional.*Q3/.test(c[2])));
 }
});
for(const failure of ['mismatch','network','switch','edit'])test(`Submit ${failure} cannot advance status and retains drafts`,async()=>{
 const h=setup();const p=h.s.submit();await tick();respond(h.requests[0],row(1,1));await tick();
 if(failure==='network')h.requests[1].reject(Error('offline'));
 else{
  if(failure==='switch')h.s.visitScope.current={id:'B',saves:new Set()};
  if(failure==='edit')h.s.responseDraftsRef.current={...h.s.responseDrafts,1:draft('8')};
  respond(h.requests[1],{responses:[row(1,failure==='mismatch'?9:1)]});
 }
 await p;assert.equal(h.requests.length,2);assert.notEqual(h.s.status,'Pending');assert.equal(h.s.responseDrafts[2].score,'2');
});
test('Submit asks once to replace several saved dirty answers; cancel writes no answers',async()=>{
 const h=setup();h.s.visibleQuestions=[{...q,is_mandatory:true},{...q,id:2}];h.s.responsesByQuestion={1:row(1,0),2:row(2,0)};
 let confirms=0;h.s.window.confirm=()=>{confirms++;return false;};await h.s.submit();
 assert.equal(confirms,1);assert.equal(h.requests.length,0);assert.equal(h.s.responseDrafts[1].score,'1');
});

test('Submit verifies even previously Saved answered values against fresh server map',async()=>{
 const h=setup();h.s.responsesByQuestion={1:row(1,1)};const p=h.s.submit();await tick();
 assert.equal(h.requests.length,1);respond(h.requests[0],{responses:[row(1,9)]});await p;
 assert.equal(h.requests.length,1);assert.notEqual(h.s.status,'Pending');assert.match(h.s.error,/did not save/);
});
test('lost POST reply recovery reads first; missing server row cannot trigger blind duplicate create',async()=>{
 const h=setup();const p=h.s.save(q);h.requests[0].reject(Error('lost reply'));await p;
 const retry=h.s.save(q);respond(h.requests[1],{responses:[]});await retry;
 assert.equal(h.requests.length,2);assert.equal(h.requests[1].options.method,undefined);
 assert.match(h.s.error,/unconfirmed/);assert.equal(h.s.responseDrafts[1].score,'1');
});

test('Save wrong visit identity cannot mark Saved or replace either draft',async()=>{
 const h=setup();const p=h.s.save(q);respond(h.requests[0],row(1,1));await tick();
 respond(h.requests[1],{id:'FOREIGN',responses:[row(1,1)]});await p;
 assert.notEqual(h.s.message,'Response saved.');assert.equal(h.s.responseDrafts[1].score,'1');assert.equal(h.s.responseDrafts[2].score,'2');
});
