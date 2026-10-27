import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const b2b = readFileSync(new URL('./SurveyWorkspacePage.tsx', import.meta.url), 'utf8');
const mystery = readFileSync(new URL('../../../../mystery-shopper/src/SurveyWorkspace.jsx', import.meta.url), 'utf8');
function section(source, start, end) {
  const first = source.indexOf(start);
  assert.ok(first >= 0, start);
  const last = source.indexOf(end, first);
  assert.ok(last > first, end);
  return source.slice(first, last);
}
function evaluate(code, sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(transformSync(code, { loader: 'tsx', target: 'es2022' }).code, sandbox);
}
const question = { id: 1, is_mandatory: true, input_type: 'score', score_min: 0, score_max: 10 };
const answer = { question_id: 1, score: 0, answer_text: '', verbatim: '', actions: [] };
const draft = { score: '0', answer_text: '', verbatim: '', actions: [] };
function setup(kind, state = 'ready', items = [question], saved = { 1: answer }, options = {}) {
  const calls = [];
  const source = kind === 'Mystery' ? mystery : b2b;
  const sandbox = {
    questionnaireState: state, questions: items, visibleQuestions: items,
    visitId: 'owned-visit', API_BASE: '/api', headers: {}, Date,
    visitScope: {current: {id:'owned-visit', saves:new Set()}},
    responseDraftsRef: {current: options.drafts ?? {1:draft}}, window: {confirm:()=>true},
    responsesByQuestion: options.local ?? { 1: answer }, responseDrafts: options.drafts ?? { 1: draft },
    emptyDraft: { score: '', answer_text: '', verbatim: '', actions: [] },
    parseChoices: () => [], ACTION_TIMEFRAME_OPTIONS: [], normalizeYesNo: value => value,
    useCallback: (fn) => fn,
    selection: {current:0}, operation:{current:null}, liveDrafts:{current:options.drafts ?? {1:draft}},
    readSaved:async()=>{calls.push(['readback']);if(options.readFails)throw Error('Read failed');return {rows:saved,status:'Pending'};},
    persistAnswer:async()=>{calls.push(['save-answer']);},
    raiseMessage: (message) => calls.push(['error', message]), setError: (message) => calls.push(['error', message]),
    setSubmitting: () => {}, setIsSubmittingVisit: () => {}, pushToast: () => {},
    setStatus: (value) => calls.push(['status', value]), setMessage: (value) => calls.push(['message', value]),
    saveActiveVisitDetails: async () => { calls.push(['save-header']); return true; },
    persistQuestionResponse: async () => { calls.push(['save-answer']); return { ok: !options.saveFails, error: 'Save failed' }; },
    loadVisitDetail: async () => { calls.push(['readback']); if (options.readFails) throw Error('Read failed'); return saved; },
    loadVisitResponses: async () => { calls.push(['readback']); if (options.readFails) throw Error('Read failed'); return saved; },
    loadDrafts: async () => {},
    apiFetch: async (url) => { calls.push(['submit', url]); return { res: { ok: true }, data: {} }; },
    fetch: async (url) => { calls.push(['submit', url]); return { ok: true, json: async () => ({}) }; },
  };
  const readiness = section(source, '  const questionnaireReady =', ';') + ';';
  const helpers = kind === 'Mystery'
    ? section(source, 'function normalizeQuestionValue', 'function QuestionField') + section(source, '  const hasMeaningfulAnswer =', '  const completedMandatory =') + section(source, 'function displayQuestionNumber', 'function getScoreOptions')
    : section(source, 'function normalizeResponseDraftForCompare', 'export default') + section(source, '  const buildResponsePayload =', '  const persistQuestionResponse =') + section(source, '  const isQuestionSaved =', '  const handleSaveQuestionResponse =');
  const callback = kind === 'Mystery'
    ? section(source, '  const submitVisitFn =', '  const scrollToCategory =') + '\nthis.run = submitVisitFn;'
    : section(source, '  const handleSubmitVisit =', '  const todayString =') + '\nthis.run = handleSubmitVisit;';
  evaluate(readiness + helpers + callback, sandbox);
  return { sandbox, calls };
}
for (const kind of ['Mystery', 'B2B']) {
  for (const state of ['unloaded', 'loading', 'error', 'empty', 'ready']) {
    test(`${kind}: actual submit callback blocks ${state} empty questionnaire before any save/read/write`, async () => {
      const { sandbox, calls } = setup(kind, state, []);
      await sandbox.run();
      assert.deepEqual(calls.map(([name]) => name), ['error']);
      assert.match(calls[0][1], /questionnaire is not ready/);
    });
  }
  for (const state of ['unloaded', 'loading', 'error']) {
    test(`${kind}: stale question rows do not bypass ${state} readiness`, async () => {
      const { sandbox, calls } = setup(kind, state);
      await sandbox.run();
      assert.deepEqual(calls.map(([name]) => name), ['error']);
    });
  }
  test(`${kind}: valid questionnaire accepts a persisted zero score`, async () => {
    const { sandbox, calls } = setup(kind);
    await sandbox.run();
    assert.equal(calls.filter(([name]) => name === 'submit').length, 1);
    assert.ok(calls.some(([name, value]) => name === 'status' && value === 'Pending'));
  });
  test(`${kind}: refreshed missing answer overrides stale React state`, async () => {
    const { sandbox, calls } = setup(kind, 'ready', [question], {});
    await sandbox.run();
    assert.equal(calls.filter(([name]) => name === 'submit').length, 0);
    assert.ok(calls.some(([name]) => name === 'error'));
  });
  test(`${kind}: readback failure cannot submit or report success`, async () => {
    const { sandbox, calls } = setup(kind, 'ready', [question], {}, { readFails: true });
    await sandbox.run();
    assert.equal(calls.filter(([name]) => name === 'submit' || name === 'status').length, 0);
  });
  test(`${kind}: submit button also consumes readiness`, () => {
    assert.match(kind === 'Mystery' ? mystery : b2b, /disabled=\{[^}]*!questionnaireReady\}/);
  });
}
test('B2B: newly saved answers use readback, not the pre-save closure', async () => {
  const { sandbox, calls } = setup('B2B', 'ready', [question], { 1: answer }, { local: {} });
  await sandbox.run();
  assert.ok(calls.some(([name]) => name === 'save-answer'));
  assert.equal(calls.filter(([name]) => name === 'submit').length, 1);
});
test('B2B: wrong readback value blocks submit and retains draft for retry', async () => {
  const { sandbox, calls } = setup('B2B', 'ready', [question], { 1: { ...answer, score: 9 } }, { local: {} });
  await sandbox.run();
  assert.equal(calls.filter(([name]) => name === 'submit').length, 0);
  assert.equal(sandbox.responseDrafts[1].score, '0');
});
test('B2B: save failure blocks readback and submit', async () => {
  const { sandbox, calls } = setup('B2B', 'ready', [question], {}, { local: {}, saveFails: true });
  await sandbox.run();
  assert.equal(calls.filter(([name]) => name === 'submit' || name === 'readback').length, 0);
});
test('Mystery: unsaved changes must verify exact saved values without replacing the draft', async () => {
  const { sandbox, calls } = setup('Mystery', 'ready', [question], { 1: answer }, { drafts: { 1: { ...draft, score: '8' } } });
  await sandbox.run();
  assert.equal(calls.filter(([name]) => name === 'submit').length, 0);
  assert.equal(sandbox.responseDrafts[1].score, '8');
});
for (const kind of ['Mystery', 'B2B']) {
  test(`${kind}: actual resume loader replaces old visit drafts; verification preserves edits and returns server map`, async () => {
    let drafts = { 99: { score: '8' } };
    const sandbox = { API_BASE: '/api', headers: {}, Date, useCallback: (fn) => fn,
      visitScope: {current: {id: 'visit', saves: new Set()}}, responseReadScope: {current: null}, selection:{current:0}, liveDrafts:{current:drafts},
      apiFetch: async () => ({ res: { ok: true }, data: { id: 'visit', responses: [answer] } }),
      fetch: async () => ({ ok: true, json: async () => ({ id: 'visit', responses: [answer] }) }),
      setResponseDrafts: (value) => { drafts = value; },
      setResponsesByQuestion: () => {}, setVisitId: () => {}, setStatus: () => {}, setSubmissionSignature: () => {}, setVisitForm: () => {}, setAccountExecutiveSearch: () => {}, setError: () => {},
    };
    const code = kind === 'Mystery' ? section(mystery, '  const loadVisitDetail =', '  useEffect(() => {\n    const run') + '\nthis.run = loadVisitDetail;'
      : section(b2b, '  const loadVisitResponses =', '  const resolveBusinessName =') + '\nthis.run = loadVisitResponses;';
    evaluate(code, sandbox);
    assert.equal((await sandbox.run('visit'))[1].score, 0);
    assert.equal(drafts[99], undefined);
    drafts[1].score = '8';
    await sandbox.run('visit', true);
    assert.equal(drafts[1].score, '8');
  });
}

for (const kind of ['Mystery', 'B2B']) {
  for (const outcome of ['empty', 'ready', 'http-error', 'network-error']) {
    test(`${kind}: actual question loader transitions loading to ${outcome}`, async () => {
      const states = [];
      const data = outcome === 'ready' ? [question] : [];
      const result = async () => {
        if (outcome === 'network-error') throw Error('Offline');
        return { ok: outcome !== 'http-error', json: async () => data };
      };
      const sandbox = { API_BASE: '/api', SURVEY_TYPE: 'B2B', headers: {}, URLSearchParams,
        headerForm: {}, DEFAULT_PURPOSE_OPTIONS: [], useCallback: (fn) => fn,
        setQuestionnaireState: (value) => states.push(value),
        setQuestions: () => {}, setResponseDrafts: () => {}, setError: () => {},
        setLocations: () => {}, setPurposeOptions: () => {}, setHeaderForm: () => {}, setCurrentCategory: () => {},
        fetch: result, apiFetch: async () => ({ res: await result(), data }),
      };
      const code = kind === 'Mystery'
        ? section(mystery, '  const initialize =', '  const loadDrafts =') + '\nthis.run = initialize;'
        : section(b2b, '    const loadQuestions =', '    const loadAccountExecutives =') + '\nthis.run = loadQuestions;';
      evaluate(code, sandbox);
      try { await sandbox.run(); } catch (error) { assert.equal(kind, 'Mystery'); }
      assert.deepEqual(states, ['loading', outcome.endsWith('error') ? 'error' : outcome]);
    });
  }
}
