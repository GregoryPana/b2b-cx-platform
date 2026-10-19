import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source=readFileSync(process.env.REVIEW_SOURCE_FILE || new URL('../App.jsx',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(mystery=false){
 const requests=[],calls=[],refs=[];let ri=0;
 const s={API_BASE:'/api',headers:{},AbortController,JSON,Map,URLSearchParams,
 activePlatform:mystery?'Mystery Shopper':'B2B',activeView:'reviews',analyticsDateFrom:'',analyticsDateTo:'',
 selectedAnalyticsBusinessIds:[],questionTrendInterval:'week',surveyFilter:'all',selectedSurveyBusiness:'',surveyDateFilter:'',
 isMysteryShopperPlatform:mystery,isB2BPlatform:!mystery,isOperationalPlatform:true,canReview:true,canViewMetrics:true,reviewNote:'',
 useRef:value=>refs[ri++]??(refs[ri-1]={current:value}),useEffect:()=>{},
 fetch:(url,options={})=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});const body={};requests.push({url,options,resolve,reject,body});return promise;},
 loadPending:async()=>calls.push(['pending']),
 };
 for(const name of ['SelectedVisit','SelectedSurveyVisit','Error','Message','ReviewNote','ReviewActionState','SurveyResults','TargetedAnalytics','MysteryLocations','MysteryLocationsLoading'])s['set'+name]=value=>{s[name[0].toLowerCase()+name.slice(1)]=value;calls.push([name,value]);};
 const scope=section('  const moduleScope =','  useEffect(() => {');
 function render(){ri=0;vm.runInContext(transformSync('{'+scope+'\nObject.assign(this,{'+(source.includes('  const beginRequest =')?'requests,beginRequest,ownsRequest,invalidateRequest,closeVisitDetail,closeSurveyVisitDetails,':'')+'moduleScope});}',{loader:'jsx'}).code,s);}
 vm.createContext(s);render();
 const code=section('  const loadMysteryLocations =','  const createMysteryLocation =')+section('  const loadVisitDetail =','  const loadBusinesses =')+section('  const loadSurveyResults =','  // Helper functions for business dropdown')+section('  const loadTargetedAnalytics =','  const loadQuestionAverages =')+'\nObject.assign(this,{loadMysteryLocations,loadVisitDetail,loadSurveyVisitDetails,submitReviewAction,loadSurveyResults,loadTargetedAnalytics});';
 vm.runInContext(transformSync(code,{loader:'jsx'}).code,s);
 return {s,requests,calls,render};
}
function respond(req,data,ok=true){req.resolve({ok,json:async()=>data});}
for(const fn of ['loadVisitDetail','loadSurveyVisitDetails'])for(const mystery of [false,true])test(`${fn} ${mystery?'Mystery':'B2B'} A/B reversed JSON owns B`,async()=>{
 const h=setup(mystery);let release;const a=h.s[fn]('A');h.requests[0].resolve({ok:true,json:()=>new Promise(r=>release=r)});await tick();
 const b=h.s[fn]('B');respond(h.requests[1],{id:'B'});await b;release({id:'A'});await a;
 assert.equal(h.s[fn==='loadVisitDetail'?'selectedVisit':'selectedSurveyVisit'].id,'B');
 assert.match(h.requests[0].url,mystery?/mystery-shopper\/visits\/A/:/dashboard-visits\/A/);
});
for(const change of ['close','route','filter','module'])test(`pending detail invalidated by ${change}`,async()=>{
 const h=setup();const p=h.s.loadSurveyVisitDetails('A');
 if(change==='close'){if(h.s.closeSurveyVisitDetails)h.s.closeSurveyVisitDetails();else h.s.setSelectedSurveyVisit(null);}
 else {if(change==='route')h.s.activeView='analytics';if(change==='filter')h.s.surveyFilter='Pending';if(change==='module')h.s.activePlatform='Mystery Shopper';h.render();}
 const count=h.calls.length;respond(h.requests[0],{id:'A'});await p;assert.equal(h.calls.length,count);
});
test('current detail reviews exact target; selecting B blocks stale A review closure',async()=>{
 const h=setup();const p=h.s.loadVisitDetail('A');respond(h.requests[0],{id:'A'});await p;
 const review=h.s.submitReviewAction('approve');assert.match(h.requests[1].url,/\/A\/approve$/);
 const b=h.s.loadVisitDetail('B');const blocked=h.s.submitReviewAction('approve');
 assert.equal(h.requests.length,3);await blocked;respond(h.requests[2],{id:'B'});await b;
 const count=h.calls.length;respond(h.requests[1],{status:'Approved'});await review;
 assert.equal(h.s.selectedVisit.id,'B');assert.equal(h.calls.length,count);
});
test('normal current review completes and clears selected detail',async()=>{
 const h=setup();const p=h.s.loadVisitDetail('A');respond(h.requests[0],{id:'A'});await p;
 const review=h.s.submitReviewAction('approve');respond(h.requests[1],{status:'Approved'});await review;
 assert.equal(h.s.selectedVisit,null);assert.ok(h.calls.some(([k,v])=>k==='Message'&&v==='Visit Approved.'));
});
for(const fn of ['loadSurveyResults','loadTargetedAnalytics'])test(`${fn} same-module repeated requests are latest-owned`,async()=>{
 const h=setup();h.s.selectedAnalyticsBusinessIds=[1];const a=h.s[fn]();const b=h.s[fn]();
 respond(h.requests[1],fn==='loadSurveyResults'?[{id:'B'}]:{id:'B'});await b;
 respond(h.requests[0],fn==='loadSurveyResults'?[{id:'A'}]:{id:'A'});await a;
 const value=h.s[fn==='loadSurveyResults'?'surveyResults':'targetedAnalytics'];assert.equal((Array.isArray(value)?value[0]:value).id,'B');
});

for(const outcome of ['success','http-error','reverse','module','network'])test(`ordinary Mystery locations GET-only ${outcome}`,async()=>{
 const h=setup(true);const a=h.s.loadMysteryLocations();
 assert.equal(h.requests.length,1);assert.match(h.requests[0].url,/\/locations$/);
 assert.equal(h.requests[0].options.method||'GET','GET');
 if(outcome==='reverse'){
  const b=h.s.loadMysteryLocations();respond(h.requests[1],[{id:'B'}]);await b;
  const n=h.calls.length;respond(h.requests[0],[{id:'A'}]);await a;
  assert.equal(h.s.mysteryLocations[0].id,'B');assert.equal(h.calls.length,n);
 }else if(outcome==='module'){
  h.s.activePlatform='B2B';h.render();const n=h.calls.length;respond(h.requests[0],[{id:'A'}]);await a;assert.equal(h.calls.length,n);
 }else{
  if(outcome==='network')h.requests[0].reject(Error('offline'));
  else respond(h.requests[0],outcome==='success'?[{id:'A'}]:{},outcome!=='http-error');
  await a;assert.equal(h.s.mysteryLocationsLoading,false);
  if(outcome==='success')assert.equal(h.s.mysteryLocations[0].id,'A');
  else assert.match(h.s.error,/unavailable|Failed/);
 }
 assert.ok(h.requests.every(r=>(r.options.method||'GET')==='GET'));
});
