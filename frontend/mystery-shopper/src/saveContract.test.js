import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./SurveyWorkspace.jsx', import.meta.url), 'utf8');
function callback(name) {
  const start = source.indexOf(`  const ${name} = useCallback(`);
  if (start < 0) throw new Error(`Missing production callback ${name}`);
  const end = source.indexOf('}, [', start);
  return source.slice(start, end + 1) + ', []);';
}
function harness({ drafts = {1: {score: '0'}}, questions, rows = {}, confirm = true } = {}) {
  const q = {id: 1, order_index: 2001, input_type: 'score', score_min: 0, score_max: 10, is_mandatory: true, question_text: 'Score'};
  const state = {rows: {...rows}, status: 'Draft', saved: {}, messages: [], calls: [], prompts: []};
  const c = {
    API_BASE: '/api', visitId: 'A', purposeOptions: ['Billing'], userInfo: {name: 'Synthetic shopper'}, DEFAULT_PURPOSE_OPTIONS: ['Billing'], questions: questions || [q], questionnaireReady: true,
    selection: {current: 0}, operation: {current: null}, liveDrafts: {current: structuredClone(drafts)},
    useCallback: f => f, window: {confirm: text => {state.prompts.push(text); return confirm;}},
    setResponsesByQuestion: rows => {state.saved = rows;}, setSavingQuestionId: v => {state.saving = v;},
    setVisitId: v => {state.visitId=v;}, setResponseDrafts: v => {state.drafts=v;}, setHeaderForm: v => {state.header=v;}, setEntryChoicePending: v => {state.entry=v;}, setActiveTab: v => {state.tab=v;},
    setSubmitting: v => {state.submitting = v;}, setStatus: v => {state.status = v;},
    raiseMessage: (text,tone) => state.messages.push({text,tone}), loadDrafts: async () => {},
    apiFetch: async (url, opts = {}) => {
      state.calls.push([url,opts]);
      if (state.hook) { const result = await state.hook(url,opts); if (result) return result; }
      if (url.endsWith('/submit')) {state.status = 'Pending'; return {res: {ok:true}, data: {}};}
      if (opts.method) {
        const body = JSON.parse(opts.body);
        state.rows[body.question_id] = {...body, response_id: `id${body.question_id}`};
        if (state.lost) throw new Error('Connection lost after commit');
        return {res:{ok:true}, data: {...body,response_id:'mirror-id-not-authority'}};
      }
      return {res:{ok:true}, data:{id: 'A',status:state.status,responses:Object.values(state.rows)}};
    },
  };
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('function displayQuestionNumber'), source.indexOf('function getScoreOptions')) + source.slice(source.indexOf('function normalizeQuestionValue'),source.indexOf('function QuestionField')) + '\n' + callback('hasMeaningfulAnswer') + '\n' + ['loadVisitDetail','selectDraftVisit','readSaved','persistAnswer','saveQuestion','submitVisitFn'].map(callback).join('\n') + '\nglobalThis.handlers = {saveQuestion,submitVisitFn,selectDraftVisit};', c);
  return {c,state,q,save: () => c.handlers.saveQuestion(q),submit: () => c.handlers.submitVisitFn()};
}
const mutations = s => s.calls.filter(([,o]) => o.method);
const success = s => s.messages.some(m => m.tone === 'success');
describe('production Mystery Save / Submit callback contract (mock IO, not authenticated E2E)', () => {
  it('initial Save persists legitimate zero and verifies fresh authoritative response identity', async () => {
    const h = harness(); await h.save();
    expect(mutations(h.state)[0][1].method).toBe('POST'); expect(h.state.saved[1].response_id).toBe('id1');
    expect(h.state.saved[1].score).toBe(0); expect(success(h.state)).toBe(true); expect(h.state.prompts).toHaveLength(0);
  });
  it.each([true,false])('confirms overwrite; cancel leaves drafts and server unchanged: %s', async confirm => {
    const h = harness({rows:{1:{question_id:1,response_id:'id1',score:5}},confirm}); await h.save();
    expect(h.state.prompts).toHaveLength(1); expect(mutations(h.state)).toHaveLength(confirm ? 1 : 0);
    expect(h.state.rows[1].score).toBe(confirm ? 0 : 5); expect(h.c.liveDrafts.current[1].score).toBe('0');
    if (confirm) expect(mutations(h.state)[0][0]).toMatch(/responses\/id1$/);
  });
  it('reconciles lost reply through GET and retry never duplicates the write', async () => {
    const h = harness(); h.state.lost = true; await h.save(); await h.save();
    expect(mutations(h.state)).toHaveLength(1); expect(success(h.state)).toBe(true); expect(h.state.prompts).toHaveLength(0);
  });
  it('readback mismatch never claims Saved and retains drafts', async () => {
    const h = harness(); h.state.hook = async (_url,o) => o.method ? {res:{ok:true},data:{}} : null;
    await h.save(); expect(success(h.state)).toBe(false); expect(h.c.liveDrafts.current[1].score).toBe('0');
    expect(h.state.messages.at(-1).text).toMatch(/could not be verified/);
  });
  it('readback failure retains uncertain action identity; retry verifies without a second POST', async () => {
    const h = harness(); let reads=0;
    h.state.hook = async (_url,o) => {if (!o.method && ++reads === 3) throw new Error('Readback unavailable');};
    await h.save(); expect(success(h.state)).toBe(false); h.state.hook=null; await h.save();
    expect(mutations(h.state)).toHaveLength(1); expect(h.state.saved[1].response_id).toBe('id1');
  });
  it('end-only Submit saves all answered questions then verifies submission', async () => {
    const h = harness({drafts:{1:{score:'0'},2:{answer_text:'N'}},questions:[{id:1,input_type:'score',score_min:0,score_max:10,is_mandatory:true},{id:2,input_type:'yes_no',is_mandatory:true}]});
    await h.submit(); expect(mutations(h.state).map(([,o])=>o.method)).toEqual(['POST','POST','PUT']);
    expect(h.state.status).toBe('Pending'); expect(Object.keys(h.state.saved)).toHaveLength(2);
  });
  it('partial save failure retains confirmed earlier answers and all drafts without submitting', async () => {
    const h = harness({drafts:{1:{score:'0'},2:{score:'7'}},questions:[{id:1,input_type:'score'},{id:2,input_type:'score'}]});
    h.state.hook=async (_url,o)=>o.method && JSON.parse(o.body || '{}').question_id===2 ? {res:{ok:false},data:{detail:'Server validation rejected'}} : null;
    await h.submit(); expect(h.state.saved[1].score).toBe(0); expect(h.c.liveDrafts.current[2].score).toBe('7');
    expect(h.state.status).toBe('Draft'); expect(h.state.messages.at(-1).text).toBe('Server validation rejected');
  });
  it('missing required and optional are labelled after saving partial answers; remains Draft', async () => {
    const h=harness({questions:[{id:1,input_type:'score',is_mandatory:true},{id:2,order_index:2002,input_type:'text',is_mandatory:true,question_text:'Required notes'},{id:3,order_index:2003,input_type:'text',is_mandatory:false}]});
    await h.submit(); expect(h.state.saved[1].score).toBe(0); expect(h.state.status).toBe('Draft');
    expect(h.state.messages.at(-1).text).toMatch(/Required unanswered: Q2: Required notes.*Optional unanswered: Q3/);
  });
  it('bulk overwrite cancel makes zero writes and preserves drafts', async () => {
    const h=harness({rows:{1:{question_id:1,response_id:'id1',score:8}},confirm:false});
    await h.submit(); expect(mutations(h.state)).toHaveLength(0); expect(h.state.prompts).toHaveLength(1); expect(h.c.liveDrafts.current[1].score).toBe('0');
  });
  it('stale visit after deferred body cannot change state or emit a success', async () => {
    const h=harness(); let release; h.state.hook=()=>new Promise(r=>{release=r;});
    const saving=h.save(); h.c.selection.current++; h.c.operation.current=null;
    release({res:{ok:true},data:{id:'A',responses:[]}}); await saving;
    expect(h.state.saved).toEqual({}); expect(h.state.messages).toEqual([]); expect(mutations(h.state)).toHaveLength(0);
  });
  it('preserves edits and unrelated drafts during save and prevents duplicate concurrent Save/Submit', async () => {
    const h=harness({drafts:{1:{score:'0'},2:{answer_text:'Unsaved notes'}}}); let release;
    h.state.hook=async (_url,o)=>{if(o.method) await new Promise(r=>{release=r;});};
    const saving=h.save(); while(!release) await new Promise(r=>setTimeout(r,0));
    h.c.liveDrafts.current[1].score='9'; await h.save(); await h.submit(); release(); await saving;
    expect(h.c.liveDrafts.current[1].score).toBe('9'); expect(h.c.liveDrafts.current[2].answer_text).toBe('Unsaved notes');
    expect(h.state.saved[1].score).toBe(0); expect(mutations(h.state)).toHaveLength(1);
  });
  it('bulk confirmation lists every changed saved answer exactly once', async () => {
    const h=harness({drafts:{1:{score:'0'},2:{score:'6'}}, rows:{1:{question_id:1,response_id:'id1',score:8},2:{question_id:2,response_id:'id2',score:3}},questions:[{id:1,order_index:2001,input_type:'score',is_mandatory:true},{id:2,order_index:2002,input_type:'score',is_mandatory:true}]});
    await h.submit(); expect(h.state.prompts).toHaveLength(1); expect(h.state.prompts[0]).toMatch(/Q1, Q2/); expect(h.state.status).toBe('Pending');
  });
  it('concurrent newly persisted answer aborts before an unconfirmed overwrite', async () => {
    const h=harness(); let reads=0;
    h.state.hook=async (_url,o)=>{if (!o.method && ++reads===2) h.state.rows[1]={question_id:1,response_id:'id1',score:6};};
    await h.save(); expect(mutations(h.state)).toHaveLength(0); expect(h.state.messages.at(-1).text).toMatch(/changed since confirmation/);
  });
  it.each([true,false])('optional missing notice preserves existing optional submission policy: %s', async confirm => {
    const h=harness({confirm,questions:[{id:1,input_type:'score',is_mandatory:true},{id:2,order_index:2002,input_type:'text',is_mandatory:false}]});
    await h.submit(); expect(h.state.prompts[0]).toMatch(/Optional unanswered: Q2/); expect(h.state.status).toBe(confirm ? 'Pending' : 'Draft'); expect(h.state.saved[1].score).toBe(0);
  });
  it('edits during end-only saving remain draft and prevent stale submission', async () => {
    const h=harness(); let release;
    h.state.hook=async (_url,o)=>{if(o.method) await new Promise(r=>{release=r;});};
    const submitting=h.submit(); while(!release) await new Promise(r=>setTimeout(r,0));
    h.c.liveDrafts.current[1].score='7'; release(); await submitting;
    expect(h.state.status).toBe('Draft'); expect(h.state.messages.at(-1).text).toMatch(/edited while saving/); expect(h.c.liveDrafts.current[1].score).toBe('7');
  });
  it('selection change during write prevents stale readback, success and loading resets', async () => {
    const h=harness(); let release;
    h.state.hook=async (_url,o)=>{if(o.method) await new Promise(r=>{release=r;});};
    const saving=h.save(); while(!release) await new Promise(r=>setTimeout(r,0));
    h.c.selection.current++; const newer={owner:1}; h.c.operation.current=newer;
    h.state.saved={2:{score:4}}; h.state.saving=2; release(); await saving;
    expect(h.state.saved).toEqual({2:{score:4}}); expect(h.state.saving).toBe(2); expect(h.c.operation.current).toBe(newer); expect(h.state.messages).toEqual([]);
  });
  it('actual resume callback rejects reversed same-module visit completions and replaces prior drafts', async () => {
    const h=harness(); const pending={};
    h.state.hook=url=>new Promise(resolve=>{pending[url.split('/').at(-1)]=resolve;});
    const a=h.c.handlers.selectDraftVisit({visit_id:'A',location_id:1});
    const b=h.c.handlers.selectDraftVisit({visit_id:'B',location_id:2});
    pending.B({res:{ok:true},data:{id:'B',status:'Draft',responses:[{question_id:2,response_id:'id2',score:4}]}}); await b;
    pending.A({res:{ok:true},data:{id:'A',status:'Draft',responses:[{question_id:1,response_id:'id1',score:8}]}}); await a;
    expect(h.state.visitId).toBe('B'); expect(h.state.saved[2].score).toBe(4); expect(h.c.liveDrafts.current[1]).toBeUndefined(); expect(h.c.liveDrafts.current[2].score).toBe(4);
  });
  it('exact text and verbatim readback cannot hide changed whitespace', async () => {
    const h=harness({drafts:{1:{answer_text:'Typed text ',verbatim:'Note '}},questions:[{id:1,input_type:'text',is_mandatory:true}]});
    h.q.input_type='text'; h.state.hook=async (_url,o)=>{if(o.method) {const body=JSON.parse(o.body); h.state.rows[1]={...body,answer_text:'Typed text',verbatim:'Note',response_id:'id1'}; return {res:{ok:true},data:{}};}};
    await h.save(); expect(success(h.state)).toBe(false); expect(h.c.liveDrafts.current[1].answer_text).toBe('Typed text ');
  });
  it.each(['', ' \t '])('cleared saved optional text blocks submit after saving other answers: %j', async cleared => {
    const h = harness({
      drafts: {1: {score: '0'}, 2: {answer_text: cleared}},
      questions: [{id: 1, input_type: 'score', is_mandatory: true}, {id: 2, order_index: 2002, input_type: 'text', is_mandatory: false}],
      rows: {1: {question_id: 1, response_id: 'id1', score: 8}, 2: {question_id: 2, response_id: 'id2', answer_text: 'OLD SAVED TEXT'}},
    });
    await h.submit();
    expect(h.state.rows[1].score).toBe(0);
    expect(h.state.rows[2].answer_text).toBe('OLD SAVED TEXT');
    expect(h.c.liveDrafts.current[2].answer_text).toBe(cleared);
    expect(h.state.calls.some(([url]) => url.endsWith('/submit'))).toBe(false);
    expect(h.state.status).toBe('Draft');
    expect(h.state.messages.at(-1).text).toMatch(/Q2.*still.*saved|still.*saved.*Q2/i);
  });
  it.each(['score', 'yes_no'])('cleared saved optional %s cannot submit a stale persisted value', async type => {
    const field = type === 'score' ? 'score' : 'answer_text';
    const value = type === 'score' ? 4 : 'Y';
    const h = harness({drafts: {1: {score: '0'}, 2: {[field]: ''}}, questions: [
      {id: 1, input_type: 'score', is_mandatory: true},
      {id: 2, order_index: 2002, input_type: type, is_mandatory: false},
    ], rows: {2: {question_id: 2, response_id: 'id2', [field]: value}}});
    await h.submit();
    expect(h.state.rows[1].score).toBe(0);
    expect(h.state.rows[2][field]).toBe(value);
    expect(h.state.status).toBe('Draft');
    expect(h.state.calls.some(([url]) => url.endsWith('/submit'))).toBe(false);
  });
  it('clearing a mandatory answer also blocks without silently submitting its persisted value', async () => {
    const h = harness({drafts: {1: {score: ''}}, rows: {1: {question_id: 1, response_id: 'id1', score: 4}}});
    await h.submit();
    expect(h.state.status).toBe('Draft');
    expect(h.state.rows[1].score).toBe(4);
    expect(h.c.liveDrafts.current[1].score).toBe('');
    expect(mutations(h.state)).toHaveLength(0);
  });
  it.each([22, '22'])('rejects cross-question duplicate response IDs, including mixed numeric/string identities: %s', async duplicate => {
    const h = harness({drafts: {1: {score: '0'}, 2: {score: '3'}}, questions: [
      {id: 1, input_type: 'score', is_mandatory: true}, {id: 2, input_type: 'score', is_mandatory: true},
    ], rows: {1: {question_id: 1, response_id: 22, score: 0}, 2: {question_id: 2, response_id: duplicate, score: 3}}});
    await h.submit();
    expect(mutations(h.state)).toHaveLength(0);
    expect(success(h.state)).toBe(false);
    expect(h.state.messages.at(-1).text).toMatch(/duplicate answer identity/i);
  });
  it.each(['   ', Infinity, -Infinity, NaN])('invalid score cannot reach a Save mutation: %s', async score => {
    const h = harness({drafts: {1: {score}}});
    await h.save();
    expect(mutations(h.state)).toHaveLength(0);
    expect(success(h.state)).toBe(false);
  });
  it('unready questionnaire blocks all Submit IO', async () => {
    const h=harness(); h.c.questionnaireReady=false; await h.submit(); expect(h.state.calls).toHaveLength(0);
  });
});
