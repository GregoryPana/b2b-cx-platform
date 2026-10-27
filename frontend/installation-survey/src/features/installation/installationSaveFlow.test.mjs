import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { savedAnswersMatch } from './saveVerification.js';

// Execute the production component's hooks and actual callback closures, not a
// parallel implementation of its POST/readback algorithm. HTTP is synthetic.
const source = readFileSync(new URL('./InstallationSurveyPage.tsx', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('const CUSTOMER_TYPES'), source.indexOf('\n  return (\n    <PageContainer>'))
  .replace('export default function', 'function');
const compiled = transformSync(body + `\nreturn { handleSubmit, verifyExisting, startNewAssessment, updateForm, setQuestionScore, setQuestions, setQuestionsReady, setLoadingQuestions, formData, scoresByQuestion, success, error, submitting, canSubmit, missingDetails, missingQuestions, saveScope };\n}\nthis.renderComponent = InstallationSurveyPage;`, { loader: 'tsx', target: 'es2022' }).code;
const questions = [
  { question_number: 1, question_text: 'Synthetic zero check', score_min: 0, score_max: 5 },
  { question_number: 2, question_text: 'Synthetic second check', score_min: 1, score_max: 5 },
];
const metadata = { inspector_name: 'Fixture Inspector', work_order: 'FIXTURE-ONLY', customer_name: 'Synthetic Customer', customer_type: 'B2B', location: 'Fixture Location', date_work_done: '2026-01-01', job_done_by: 'Field Team', contractor_name: '', field_team_members: ['Synthetic Member'], action_points: ['Synthetic action'] };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function setup(http) {
  const states = [], refs = [], cleanups = [], calls = [];
  let cursor = 0, refCursor = 0, effectCursor = 0, confirm = true;
  const ctx = { API_BASE: '/api', savedAnswersMatch, AbortController, console,
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
    useMemo: fn => fn(),
    useEffect(fn, deps) { if (!deps.length && !effectCursor++) cleanups[0] = fn(); },
    window: { confirm: () => confirm },
    fetch: async (url, options = {}) => { calls.push({ url, options }); return http(url, options, calls.length); },
  };
  vm.createContext(ctx); vm.runInContext(compiled, ctx);
  const render = () => { cursor = refCursor = effectCursor = 0; return ctx.renderComponent({ headers: {} }); };
  let view = render();
  view.setQuestions(questions); view.setQuestionsReady(true);
  for (const [key, value] of Object.entries(metadata)) view.updateForm(key, value);
  view.setQuestionScore(1, 0); view.setQuestionScore(2, 5);
  return { render, calls, unmount: () => cleanups[0](), confirm: value => { confirm = value; } };
}
const response = (data, ok = true) => ({ ok, json: async () => data });
const saved = { survey_id: 'fixture-a', responses: [{ question_number: 1, score: 0 }, { question_number: 2, score: 5 }] };
const normal = async (url, options) => options.method === 'POST' ? response({ survey_id: 'fixture-a', overall_score: 2.5 }) : response(saved);
const submit = view => view.handleSubmit({ preventDefault() {} });

for (const state of ['unloaded', 'loading', 'empty', 'partial', 'blank', 'whitespace', 'missing-header', 'worker']) {
  test(`production submit blocks ${state} without POST`, async () => {
    const h = setup(normal); let v = h.render();
    if (state === 'unloaded') v.setQuestionsReady(false);
    if (state === 'loading') v.setLoadingQuestions(true);
    if (state === 'empty') v.setQuestions([]);
    if (state === 'partial') v.setQuestionScore(2, undefined);
    if (state === 'blank') v.setQuestionScore(1, '');
    if (state === 'whitespace') v.setQuestionScore(1, '   ');
    if (state === 'missing-header') v.updateForm('work_order', ' ');
    if (state === 'worker') v.updateForm('field_team_members', ['']);
    v = h.render(); assert.equal(v.canSubmit, false); await submit(v); assert.equal(h.calls.length, 0);
    if (state === 'missing-header') assert.ok(v.missingDetails.includes('Work Order'));
    if (state === 'partial') assert.equal(v.missingQuestions[0].question_text, questions[1].question_text);
  });
}
test('full atomic POST preserves zero and exact metadata, then verifies; no implicit reset', async () => {
  const h = setup(normal); await submit(h.render()); const v = h.render();
  assert.deepEqual(h.calls.map(c => c.options.method || 'GET'), ['POST', 'GET']);
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { ...metadata, contractor_name: null, responses: saved.responses });
  assert.equal(v.success.saveVerified, true); assert.equal(v.success.overall_score, 2.5);
  assert.equal(v.formData.work_order, metadata.work_order); assert.equal(v.scoresByQuestion[1], 0);
  await submit(v); assert.equal(h.calls.length, 2);
});
for (const failure of ['mismatch', 'get-network', 'get-http']) {
  test(`accepted ${failure} retains form/reference; reverify only GETs same ID`, async () => {
    let reads = 0;
    const h = setup(async (url, options) => {
      if (options.method === 'POST') return response({ survey_id: 'fixture-a', overall_score: 2.5 });
      if (!reads++) {
        if (failure === 'get-network') throw Error('offline');
        return response({ ...saved, responses: [] }, failure !== 'get-http');
      }
      return response(saved);
    });
    await submit(h.render()); let v = h.render();
    assert.equal(v.success.saveVerified, false); assert.equal(v.success.survey_id, 'fixture-a');
    assert.equal(v.formData.work_order, metadata.work_order); assert.equal(v.scoresByQuestion[1], 0);
    await submit(v); await v.verifyExisting(); v = h.render();
    assert.equal(v.success.saveVerified, true);
    assert.deepEqual(h.calls.map(c => c.options.method || 'GET'), ['POST', 'GET', 'GET']);
    assert.equal(h.calls[1].url, h.calls[2].url);
  });
}
for (const failure of ['network', 'invalid-json', 'missing-id', 'http-rejection']) {
  test(`POST ${failure} is uncertain, preserves draft and prevents duplicate POST`, async () => {
    const h = setup(async () => {
      if (failure === 'network') throw Error('offline');
      if (failure === 'invalid-json') return { ok: true, json: async () => { throw Error('truncated'); } };
      return response({}, failure !== 'http-rejection');
    });
    await submit(h.render()); let v = h.render();
    assert.match(v.error, /outcome unknown or not confirmed/); assert.equal(v.success, null);
    assert.equal(v.formData.work_order, metadata.work_order); assert.equal(v.scoresByQuestion[1], 0);
    await submit(v); await v.verifyExisting(); v.startNewAssessment();
    assert.equal(h.calls.length, 1); assert.equal(h.render().canSubmit, false);
  });
}
test('rapid double submit and edits during POST/readback cannot replay or erase draft', async () => {
  const post = deferred(), get = deferred();
  const h = setup(async (url, opts) => opts.method === 'POST' ? post.promise : get.promise);
  let v = h.render(); const pending = submit(v); await submit(v);
  v.updateForm('work_order', 'EDIT-DURING-POST'); v.setQuestionScore(1, 3);
  post.resolve(response({ survey_id: 'fixture-a', overall_score: 2.5 }));
  await new Promise(r => setImmediate(r));
  v = h.render(); v.updateForm('customer_name', 'EDIT-DURING-GET'); v.startNewAssessment();
  get.resolve(response(saved)); await pending; v = h.render();
  assert.equal(v.success.saveVerified, true); assert.equal(v.formData.work_order, 'EDIT-DURING-POST');
  assert.equal(v.formData.customer_name, 'EDIT-DURING-GET'); assert.equal(v.scoresByQuestion[1], 3);
  assert.equal(v.success.snapshot.work_order, metadata.work_order); assert.equal(v.success.snapshot.responses[0].score, 0);
  assert.equal(h.calls.length, 2);
});
test('explicit start-new requires verified record and confirmation; cancelled reset retains edits', async () => {
  const h = setup(normal); await submit(h.render()); let v = h.render();
  h.confirm(false); v.startNewAssessment(); assert.equal(h.render().success.survey_id, 'fixture-a');
  h.confirm(true); v.startNewAssessment(); v = h.render();
  assert.equal(v.success, null); assert.equal(v.formData.work_order, ''); assert.equal(Object.keys(v.scoresByQuestion).length, 0);
});
test('contractor metadata uses the same complete atomic create contract', async () => {
  const h = setup(normal); let v = h.render();
  v.updateForm('job_done_by', 'Contractor'); v.updateForm('contractor_name', 'Synthetic Contractor');
  await submit(h.render());
  const payload = JSON.parse(h.calls[0].options.body);
  assert.equal(payload.contractor_name, 'Synthetic Contractor'); assert.deepEqual(payload.field_team_members, []);
  assert.deepEqual(payload.responses, saved.responses);
});
test('stale accepted POST after unmount cannot start readback or claim success', async () => {
  const post = deferred(); const h = setup(() => post.promise);
  const pending = submit(h.render()); h.unmount();
  post.resolve(response({ survey_id: 'fixture-a', overall_score: 2.5 })); await pending;
  assert.equal(h.calls.length, 1); assert.equal(h.render().success, null);
});
test('old readback after scope invalidation cannot update new assessment or loading state', async () => {
  const get = deferred(); const h = setup(async (url, opts) => opts.method === 'POST' ? response({ survey_id: 'fixture-a' }) : get.promise);
  const pending = submit(h.render()); await new Promise(r => setImmediate(r));
  let v = h.render(); const oldController = v.saveScope.current.controller;
  h.unmount(); assert.equal(oldController.signal.aborted, true);
  v.saveScope.current.accepted = null; v.updateForm('work_order', 'NEW-SCOPE');
  const prior = h.render().success;
  get.resolve(response(saved)); await pending; v = h.render();
  assert.equal(v.success, prior); assert.equal(v.formData.work_order, 'NEW-SCOPE');
});
