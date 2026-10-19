import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { summarizeMysteryQuestions, weightedScoreSummary } from './mysterySummary.js';

test('weighted scores use scored answers, not visits or question count', () => {
  const result = weightedScoreSummary([{ average_score: 9, response_count: 1, score_min: 0, score_max: 10 }, { average_score: 8, response_count: 3, score_min: 0, score_max: 10 }]);
  assert.equal(result.average, 8.25);
  assert.equal(result.responseCount, 4);
  assert.equal(result.scoreMax, 10);
});
test('null/empty means and invalid denominators cannot become a measured zero', () => {
  const result = weightedScoreSummary([{ average_score: null, response_count: 3 }, { average_score: '', response_count: 2 }, { average_score: 8, response_count: -1 }]);
  assert.equal(result.average, null);
  assert.equal(result.responseCount, 0);
});
test('a measured zero is kept', () => {
  assert.equal(weightedScoreSummary([{ average_score: 0, response_count: 1 }]).average, 0);
});
test('different configured scales are not averaged together', () => {
  const result = weightedScoreSummary([{ average_score: 5, response_count: 1, score_min: 1, score_max: 5 }, { average_score: 10, response_count: 1, score_min: 0, score_max: 10 }]);
  assert.equal(result.average, null);
  assert.equal(result.mixedScales, true);
});
test('quality membership uses the exact configured 1-to-5 scale, never observed mean', () => {
  const items = [{ average_score: 2, response_count: 1, score_min: 0, score_max: 10 }, { average_score: 4, response_count: 1, score_min: 1, score_max: 5 }, { average_score: 1, response_count: 1, score_max: null }];
  const result = summarizeMysteryQuestions(items);
  assert.equal(result.quality.average, 4);
  assert.equal(result.quality.responseCount, 1);
});
test('overall experience is separate from quality', () => {
  const result = summarizeMysteryQuestions([{ category: 'Overall Experience', average_score: 8.5, response_count: 2, score_min: 0, score_max: 10 }, { category: 'Service', average_score: 4, response_count: 7, score_min: 1, score_max: 5 }]);
  assert.equal(result.overallExperience.average, 8.5);
  assert.equal(result.overallExperience.scoreMax, 10);
  assert.equal(result.quality.average, 4);
});

// Execute the actual async loader bodies against delayed fetches, not a reimplementation.
const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
for (const mystery of [false, true]) {
for (const name of ['loadPending', 'loadVisitDetail', 'loadSurveyResults', 'loadSurveyVisitDetails', 'loadQuestionAverages', 'loadQuestionTrend', 'loadTargetedAnalytics', 'loadMetrics', 'submitReviewAction']) {
  test(`${name} routes ${mystery ? 'Mystery' : 'B2B'} correctly and ignores delayed responses after a switch`, async () => {
    const start = source.indexOf(`  const ${name} = async`);
    const end = source.indexOf('\n  };', start) + 5;
    assert.ok(start > 0 && end > start);
    const calls = [];
    const urls = [];
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const moduleScope = { current: { platform: mystery ? 'Mystery Shopper' : 'B2B' } };
    const sandbox = { moduleScope, canReview: true, canViewMetrics: true, isOperationalPlatform: true, isMysteryShopperPlatform: mystery, isB2BPlatform: !mystery, activePlatform: mystery ? 'Mystery Shopper' : 'B2B', API_BASE: '/api', headers: {}, analyticsDateFrom: '', analyticsDateTo: '', selectedAnalyticsBusinessIds: ['business'], questionTrendInterval: 'month', selectedSurveyBusiness: '', surveyDateFilter: '', surveyFilter: 'all', selectedVisit: {id: 'visit'}, reviewNote: '', loadPending: async () => {}, URLSearchParams, Date,
      fetch: async (url) => { urls.push(url); await waiting; return { ok: true, json: async () => ({ items: [], status: 'Approved' }) }; } };
    for (const setter of source.slice(start, end).matchAll(/\b(set\w+)\(/g)) sandbox[setter[1]] = (...args) => calls.push([setter[1], ...args]);
    Object.assign(sandbox, { requests: {current: new Map()}, resourceContexts:{current:{}}, AbortController });
    const helpers = source.slice(source.indexOf('  const invalidateRequest ='), source.indexOf('  useEffect(() => () => {', source.indexOf('  const invalidateRequest =')));
    vm.createContext(sandbox);
    vm.runInContext(helpers + '\nthis.detail = beginRequest("visitDetail", "visit"); this.detail.ready = true;\n' + source.slice(start, end) + `\nthis.run = ${name};`, sandbox);
    const pending = sandbox.run(name === 'submitReviewAction' ? 'approve' : 'visit-or-question');
    if (['loadPending', 'loadVisitDetail', 'loadSurveyResults', 'loadSurveyVisitDetails', 'submitReviewAction'].includes(name)) {
      assert.equal(urls.length, 1);
      assert.match(urls[0], mystery ? /\/mystery-shopper\// : /\/dashboard-visits/);
    }
    calls.length = 0; // Ignore loading state set before switching.
    moduleScope.current = { platform: mystery ? 'B2B' : 'Mystery Shopper' };
    release();
    await pending;
    assert.deepEqual(calls, []);
  });
}
}
