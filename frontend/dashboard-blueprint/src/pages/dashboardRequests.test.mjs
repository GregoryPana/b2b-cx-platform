import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequestScope } from '../lib/requestScope.js';
import { presentB2BMetrics } from '../features/mystery-shopper/mysteryPresentation.js';

const source = readFileSync(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
// Execute the production closures, not a reimplementation of their guards.
// Inject only their lexical dependencies and React setters to observe real state effects.
function handler(name, context) {
  const start = source.indexOf(`  const ${name} = `);
  assert.ok(start >= 0, name);
  const tail = source.slice(start + `  const ${name} = `.length);
  const callback = tail.startsWith('useCallback(');
  const body = callback ? tail.slice('useCallback('.length, tail.indexOf('\n  }, [') + 4) : tail.slice(0, tail.indexOf('\n  };') + 4);
  return vm.runInNewContext(`(${body})`, context);
}
function effect(marker, context, text = source) {
  const tail = text.slice(text.indexOf(marker));
  assert.ok(tail && text.includes(marker));
  const start = tail.indexOf('useEffect(') + 'useEffect('.length;
  const end = tail.indexOf('}, [', start) + 1;
  return vm.runInNewContext(`(${tail.slice(start, end)})`, context);
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness(overrides = {}) {
  const state = {}, calls = [], pending = [];
  const context = {
    requests: createRequestScope(), URLSearchParams, Date, Number, String, Array, Promise,
    formatApiError: (value, fallback) => typeof value === 'string' ? value : fallback,
    API_BASE: '/api', headers: {}, activePlatform: 'Mystery Shopper', isMysteryShopperPlatform: true,
    isB2BPlatform: false, isInstallationPlatform: false, location: { pathname: '/' },
    platformRequestVersion: { current: 1 }, selectedAnalyticsEntityIds: [], selectedQuestionId: '1',
    surveyStatusFilter: 'all', selectedSurveyLocation: '', selectedSurveyBusiness: '',
    reportType: 'survey', reportBusinessId: '1', reportVisitId: 'visit1',
    reportSelectedDate: '', reportDateFrom: '', reportDateTo: '',
    reportEmailRecipients: ['qa@example.invalid'], reportEmailDraft: '',
    installReportMonth: '', installReportType: 'lifetime', installReportSurveyId: '',
    installReportDateFrom: '', installReportDateTo: '',
    installReportEmailRecipients: ['qa@example.invalid'], installReportEmailDraft: '',
    selectedSurveyVisit: { id: 'A' }, reviewResponseDrafts: {},
    presentB2BMetrics,
    validateReportSelection: () => true, buildReportParams: () => new URLSearchParams(),
    collectRecipients: () => ({ recipients: ['qa@example.invalid'], invalid: [] }),
    window: { prompt: () => '' },
    pushToast: (...args) => calls.push(['toast', ...args]),
    triggerBlobDownload: (...args) => calls.push(['download', ...args]),
    filenameFromDisposition: () => 'report.html',
    loadPendingVisits: () => calls.push(['refreshPending']),
    loadSurveyResults: () => calls.push(['refreshSurveys']),
    loadSurveyVisitDetails: () => calls.push(['refreshDetail']),
    fetchJsonSafe: (...args) => { const d = deferred(); pending.push({ ...d, args }); return d.promise; },
    fetch: (...args) => { const d = deferred(); pending.push({ ...d, args }); return d.promise; },
    ...overrides,
  };
  for (const name of new Set(source.match(/\bset[A-Z]\w+/g))) context[name] = value => { state[name] = typeof value === 'function' ? value(state[name]) : value; };
  context.setPendingReviewCount = value => { state.setPendingReviewCount = value; };
  context.buildInstallationReportScope = handler('buildInstallationReportScope', context);
  return { context, state, calls, pending };
}
const ok = data => ({ res: { ok: true }, data });

// Model React useCallback dependency reuse across renders, with immutable render scopes.
function callbackRender(h, values, cache = new Map()) {
  const context = { ...h.context, ...values };
  for (const name of ['buildInstallationReportScope', 'handleInstallationPreviewReport', 'handleInstallationDownloadReport', 'handleInstallationDownloadPdfReport', 'handleInstallationEmailReport']) {
    const start = source.indexOf(`  const ${name} = `) + `  const ${name} = `.length;
    const dependencies = source.indexOf('\n  }, [', start);
    const expression = source.slice(start, source.indexOf(']);', dependencies) + 2);
    context.useCallback = (fn, deps) => {
      const old = cache.get(name);
      if (old && deps.length === old.deps.length && deps.every((dep, i) => Object.is(dep, old.deps[i]))) return old.fn;
      cache.set(name, { fn, deps }); return fn;
    };
    context[name] = vm.runInNewContext(expression, context);
  }
  return { context, cache };
}

for (const name of ['handleInstallationPreviewReport', 'handleInstallationDownloadReport', 'handleInstallationDownloadPdfReport', 'handleInstallationEmailReport']) {
  test(`${name}: real memoized handler follows month change and invalidates old completion`, async () => {
    const h = harness();
    h.state.setError = '';
    const first = callbackRender(h, { installReportMonth: '2024-02' });
    const oldTask = first.context[name]();
    const second = callbackRender(h, { installReportMonth: '2024-03' }, first.cache);
    assert.notEqual(second.context[name], first.context[name]);
    effect('  useEffect(() => {\n    for (const key of ["handleInstallationPreviewReport"', second.context)();
    const newTask = second.context[name]();
    const scope = request => name === 'handleInstallationEmailReport'
      ? JSON.parse(request.args[1].body)
      : Object.fromEntries(new URL(request.args[0], 'https://example.invalid').searchParams);
    assert.equal(scope(h.pending[0]).date_from, '2024-02-01');
    assert.equal(scope(h.pending[0]).date_to, '2024-02-29');
    assert.equal(scope(h.pending[1]).date_from, '2024-03-01');
    assert.equal(scope(h.pending[1]).date_to, '2024-03-31');
    const response = () => name.includes('Download')
      ? { ok: true, blob: async () => 'new blob', headers: { get: () => '' } }
      : ok({ report: { id: 'new' }, report_html: 'new' });
    h.pending[1].resolve(response()); await newTask;
    const before = { ...h.state }, calls = h.calls.length;
    h.pending[0].resolve(response()); await oldTask;
    assert.deepEqual(h.state, before); assert.equal(h.calls.length, calls);
    assert.equal(h.state.setError, '');
    if (name.includes('Download')) assert.equal(h.calls.filter(c => c[0] === 'download').length, 1);
    if (name.includes('Preview')) assert.equal(h.state.setInstallReportPreview.id, 'new');
    if (name.includes('Email')) assert.ok(h.calls.some(c => c[0] === 'toast' && /emailed/.test(c[2])));
  });
}

test('all installation delivery handlers share explicit-date overrides and report type/survey scope', async () => {
  for (const type of ['date', 'survey', 'lifetime']) {
    for (const name of ['handleInstallationPreviewReport', 'handleInstallationDownloadReport', 'handleInstallationDownloadPdfReport', 'handleInstallationEmailReport']) {
      const h = harness();
      const { context } = callbackRender(h, { installReportMonth: '2024-02', installReportType: type,
        installReportSurveyId: 'survey-7', installReportDateFrom: '2024-02-05', installReportDateTo: '2024-02-20' });
      const task = context[name]();
      const req = h.pending[0];
      const scope = name.includes('Email') ? JSON.parse(req.args[1].body)
        : Object.fromEntries(new URL(req.args[0], 'https://example.invalid').searchParams);
      assert.equal(scope.report_type, type); assert.equal(scope.survey_id, 'survey-7');
      assert.equal(scope.date_from, '2024-02-05'); assert.equal(scope.date_to, '2024-02-20');
      req.resolve(name.includes('Download') ? { ok: true, blob: async () => 'blob', headers: { get: () => '' } } : ok({}));
      await task;
    }
  }
});


test('preview: latest scope wins; invalidation prevents old success/error/finally writes', async () => {
  const h = harness(); const fn = handler('handlePreviewReport', h.context);
  const a = fn(), b = fn();
  h.pending[1].resolve(ok({ report: { id: 'B' }, report_html: 'B' })); await b;
  h.pending[0].resolve({ res: { ok: false }, data: { detail: 'old failure' } }); await a;
  assert.equal(h.state.setReportPreview.id, 'B'); assert.equal(h.state.setError, '');
  const c = fn(); h.context.requests.invalidateAll(); h.state.setReportLoading = 'navigation';
  h.pending[2].resolve(ok({ report: { id: 'C' } })); await c;
  assert.equal(h.state.setReportPreview.id, 'B'); assert.equal(h.state.setReportLoading, 'navigation');
});

test('eligible visits: location/type changes invalidate old lists, errors, visit resets and loading', async () => {
  const h = harness({ location: { pathname: '/reports' } });
  const marker = '  useEffect(() => {\n    const request = requests.begin("eligible")';
  const cleanup = effect(marker, h.context)();
  cleanup(); h.context.reportBusinessId = '2'; effect(marker, h.context)();
  h.pending[1].resolve(ok({ eligible: [{ visit_id: 'visit1', location_id: 2 }] })); await tick();
  h.pending[0].resolve(ok({ eligible: [{ visit_id: 'old' }] })); await tick();
  assert.equal(h.state.setReportEligibleSurveys[0].location_id, 2);
  assert.equal(h.state.setReportVisitId, undefined);
  h.context.reportType = 'lifetime'; effect(marker, h.context)();
  assert.equal(h.state.setReportEligibleSurveys.length, 0); assert.equal(h.state.setReportSurveyLoading, false);
});

test('detail A then B resolves B then A; close invalidates in-flight detail and response-save refresh', async () => {
  const h = harness(); const fn = handler('loadSurveyVisitDetails', h.context);
  const a = fn('A'), b = fn('B');
  h.pending[1].resolve(ok({ id: 'B', responses: [{ response_id: 2, answer_text: 'B' }] })); await b;
  h.pending[0].resolve(ok({ id: 'A', responses: [{ response_id: 1 }] })); await a;
  assert.equal(h.state.setSelectedSurveyVisit.id, 'B'); assert.equal(h.state.setReviewResponseDrafts['2'].answer_text, 'B');
  const c = fn('C'); handler('closeSurveyDetails', h.context)();
  h.pending[2].resolve(ok({ id: 'C' })); await c;
  assert.equal(h.state.setSelectedSurveyVisit, null);
  const save = handler('saveReviewResponseEdits', { ...h.context, canEditResponseAnswer: () => false })({ response_id: 1 });
  handler('closeSurveyDetails', h.context)(); h.pending[3].resolve(ok({})); await save;
  assert.equal(h.calls.some(c => c[0] === 'refreshDetail'), false);
});

for (const [marker, setter, payload] of [
  ['   // Load core metrics', 'setAnalytics', { nps: {}, tag: 'new' }],
  ['   // Load yes/no question analytics', 'setYesNoQuestionAnalytics', { items: ['new'] }],
  ['   // Load question averages', 'setQuestionAverages', { items: [{ question_id: 'new' }] }],
  ['   // Load question trend data', 'setTrendData', { points: [{ period: 'new', average_score: null }, { period: 'zero', average_score: 0 }] }],
]) test(`filter race executes real effect: ${setter}`, async () => {
  const h = harness(); const cleanup = effect(marker, h.context)();
  cleanup(); h.context.selectedAnalyticsEntityIds = ['2']; effect(marker, h.context)();
  h.pending[1].resolve(ok(payload)); await tick();
  const latest = h.state[setter];
  h.pending[0].resolve(ok({ items: ['old'], points: [{ period: 'old', average_score: 9 }], tag: 'old' })); await tick();
  assert.equal(h.state[setter], latest);
  if (setter === 'setTrendData') { assert.equal(latest[0].average, null); assert.equal(latest[1].average, 0); }
});

test('failed Mystery analytics and trends finish loading with explicit errors, not successful empty metrics', async () => {
  const analytics = harness(); effect('   // Load core metrics', analytics.context)();
  analytics.pending[0].resolve({ res: { ok: false }, data: { detail: 'Metrics offline' } }); await tick();
  assert.equal(analytics.state.setAnalytics, null); assert.equal(analytics.state.setAnalyticsLoading, false);
  assert.equal(analytics.state.setAnalyticsError, 'Metrics offline');
  const trend = harness(); effect('   // Load question trend data', trend.context)();
  trend.pending[0].resolve({ res: { ok: false }, data: { detail: 'Trend offline' } }); await tick();
  assert.equal(trend.state.setTrendData.length, 0); assert.equal(trend.state.setTrendLoading, false);
  assert.equal(trend.state.setTrendError, 'Trend offline');
});

test('survey list: same-module status/location race keeps latest data and loading state', async () => {
  const h = harness(); const fn = handler('loadSurveyResults', h.context);
  const a = fn(); h.context.surveyStatusFilter = 'Approved'; const b = fn();
  h.pending[1].resolve(ok([{ id: 'B' }])); await b;
  h.pending[0].resolve(ok([{ id: 'A' }])); await a;
  assert.equal(h.state.setSurveyResults[0].id, 'B'); assert.equal(h.state.setSurveyLoading, false);
});

for (const name of ['handleDownloadReport', 'handleDownloadPdfReport', 'handleInstallationDownloadReport', 'handleInstallationDownloadPdfReport']) {
  test(`${name}: navigation during blob await suppresses download and success`, async () => {
    const h = harness({ installReportType: 'lifetime', installReportDateFrom: '', installReportDateTo: '', installReportSurveyId: '' });
    const blob = deferred(); const task = handler(name, h.context)();
    h.pending[0].resolve({ ok: true, blob: () => blob.promise, headers: { get: () => '' } }); await tick();
    h.context.requests.invalidateAll(); const before = h.calls.length;
    blob.resolve('old blob'); await task;
    assert.equal(h.calls.length, before); assert.equal(h.calls.some(c => c[0] === 'download'), false);
  });
}
for (const name of ['handleEmailReport', 'handleReviewDecision', 'saveReviewResponseEdits']) {
  test(`${name}: navigation suppresses mutation completion, notifications and refreshes`, async () => {
    const h = harness({ canEditResponseAnswer: () => false });
    const fn = handler(name, h.context);
    const task = name === 'handleReviewDecision' ? fn({ id: 'A' }, 'approve') : name === 'saveReviewResponseEdits' ? fn({ response_id: 1 }) : fn();
    h.context.requests.invalidateAll(); const before = { ...h.state }, calls = h.calls.length;
    h.pending[0].resolve(ok({})); await task;
    assert.deepEqual(h.state, before); assert.equal(h.calls.length, calls);
  });
}

test('changing actual report filter effect clears preview and invalidates pending preview completion', async () => {
  const h = harness(); const task = handler('handlePreviewReport', h.context)();
  effect('  useEffect(() => {\n    for (const key of ["preview", "download", "pdf", "email"])', h.context)();
  h.pending[0].resolve(ok({ report: { id: 'old' }, report_html: 'old' })); await task;
  assert.equal(h.state.setReportPreview, null); assert.equal(h.state.setReportPreviewHtml, '');
  assert.equal(h.state.setReportLoading, false);
});

test('active export and email completion still downloads/notifies; guards do not swallow current work', async () => {
  const h = harness(); const task = handler('handleDownloadReport', h.context)();
  h.pending[0].resolve({ ok: true, blob: async () => 'current blob', headers: { get: () => '' } }); await task;
  assert.equal(h.calls.find(c => c[0] === 'download')[1], 'current blob');
  assert.equal(h.state.setMessage, 'Report downloaded.');
  const email = handler('handleEmailReport', h.context)(); h.pending[1].resolve(ok({})); await email;
  assert.match(h.state.setMessage, /Report emailed/); assert.equal(h.state.setReportEmailRecipients.length, 0);
});

for (const name of ['loadInstallationAnalytics', 'loadInstallationTrends', 'loadInstallationSurveys']) {
  test(`${name}: latest same-module filter result wins`, async () => {
    const h = harness({ isInstallationPlatform: true, installationTrendMonth: '', installationTrendCustomerType: '', installationTrendWorkerType: '', installationSurveyFilters: {} });
    const fn = handler(name, h.context); const a = fn(), b = fn();
    const newer = name === 'loadInstallationSurveys' ? [{ id: 'new' }] : { id: 'new' };
    const setter = name === 'loadInstallationAnalytics' ? 'setInstallationAnalytics' : name === 'loadInstallationTrends' ? 'setInstallationTrends' : 'setInstallationSurveys';
    h.pending[1].resolve(ok(newer)); await b; h.pending[0].resolve(ok({ id: 'old' })); await a;
    assert.equal(h.state[setter], newer);
  });
}

test('App review count checks ownership after JSON await and does not clear next request timeout', async () => {
  const timers = new Map(); let id = 0, poll;
  const h = harness({
    window: { setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: id => timers.delete(id) },
    setInterval: fn => { poll = fn; return 1; }, clearInterval: () => {}, createRequestScope,
  });
  const cleanup = effect('  useEffect(() => {\n    const requests = createRequestScope();', h.context, appSource)();
  const json = deferred(); h.pending[0].resolve({ ok: true, json: () => json.promise }); await tick();
  const oldTimeout = timers.get(id);
  poll(); const currentTimer = id;
  oldTimeout();
  assert.equal(h.pending[1].args[1].signal.aborted, false);
  json.resolve([1, 2, 3]); await tick();
  assert.equal(h.state.setPendingReviewCount, 0); assert.equal(timers.has(currentTimer), true);
  const json2 = deferred(); h.pending[1].resolve({ ok: true, json: () => json2.promise }); await tick();
  cleanup(); json2.resolve([1, 2]); await tick();
  assert.equal(h.state.setPendingReviewCount, 0);
});
