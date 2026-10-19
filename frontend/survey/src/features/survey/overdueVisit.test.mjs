import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('./SurveyWorkspacePage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const handleSelectOverdueVisit =');
const end = source.indexOf('  const handleViewSubmittedVisit =', start);
assert.ok(start > 0 && end > start);
function setup({ confirmed = true, ok = true, network = false } = {}) {
  const calls = [];
  const sandbox = {
    API_BASE: '/api', headers: { Authorization: 'fixture' }, todayString: '2026-10-19', Error,
    overdueInFlight: { current: new Set() }, visitScope: {current: {}},
    beginVisitSelection: () => sandbox.visitScope.current = {}, setVisitForm: () => {},
    window: { confirm: (message) => { calls.push(['confirm', message]); return confirmed; } },
    pushToast: () => {}, setError: (message) => calls.push(['error', message]),
    fetch: async (url, options) => {
      calls.push(['put', url, options]);
      if (network) throw Error('Offline');
      return { ok, json: async () => ({ detail: 'Date rejected' }) };
    },
    handleSelectPlannedVisit: async (draft) => { calls.push(['resume', draft]); return true; },
    loadDrafts: async () => calls.push(['reload']),
  };
  vm.createContext(sandbox);
  vm.runInContext(transformSync(source.slice(start, end) + '\nthis.run = handleSelectOverdueVisit;', { loader: 'tsx' }).code, sandbox);
  return { run: sandbox.run, calls };
}
const draft = { visit_id: 'owned-uuid', visit_date: '2026-10-01', is_started: false };
test('overdue cancellation does not PUT, resume or reload', async () => {
  const { run, calls } = setup({ confirmed: false });
  await run(draft);
  assert.deepEqual(calls.map(c => c[0]), ['confirm']);
});
for (const is_started of [false, true]) {
  test(`overdue ${is_started ? 'continue' : 'start'} confirms, updates date then resumes and reloads`, async () => {
    const { run, calls } = setup();
    await run({ ...draft, is_started });
    assert.deepEqual(calls.map(c => c[0]), ['confirm', 'put', 'resume', 'reload']);
    assert.match(calls[0][1], /2026-10-01.*2026-10-19/);
    assert.equal(calls[1][1], '/api/dashboard-visits/owned-uuid/draft');
    assert.equal(calls[1][2].method, 'PUT');
    assert.deepEqual(JSON.parse(calls[1][2].body), { visit_date: '2026-10-19' });
    assert.equal(calls[2][1].visit_date, '2026-10-19');
    assert.equal(calls[2][1].visit_id, draft.visit_id);
    assert.equal(draft.visit_date, '2026-10-01');
  });
}
for (const options of [{ ok: false }, { network: true }]) {
  test(`overdue date failure ${JSON.stringify(options)} cannot resume or claim success`, async () => {
    const { run, calls } = setup(options);
    await run(draft);
    assert.deepEqual(calls.map(c => c[0]), ['confirm', 'put', 'error']);
    assert.match(calls[2][1], /Date rejected|Offline/);
  });
}
test('overdue missing identity has no side effects', async () => {
  const { run, calls } = setup();
  await run({ visit_date: '2026-10-01' });
  assert.deepEqual(calls, []);
});
test('actual overdue bucket includes never-started and started past-date drafts only', () => {
  const a = source.indexOf('  const plannedOverdue =');
  const b = source.indexOf('  const submittedSorted =', a);
  assert.ok(a > 0 && b > a);
  const sandbox = { todayString: '2026-10-19', sortByPriority: x => x, draftVisits: [draft, { ...draft, is_started: true }, { ...draft, visit_date: '2026-10-19' }, { ...draft, visit_date: '2026-10-20' }] };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(a, b) + '\nthis.rows = plannedOverdue;', sandbox);
  assert.equal(sandbox.rows.length, 2);
  assert.equal(sandbox.rows[0].is_started, false);
});
