import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { summarizeMysteryQuestions, buildAnalyticsCards } from './mysteryPresentation.js';

const bundle = await build({
  entryPoints: [new URL('./components/MysteryAnalyticsSummarySection.jsx', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const Summary = module.exports.default;
const render = props => renderToStaticMarkup(React.createElement(Summary, { mysteryAnalyticsSummary: summarizeMysteryQuestions([]), ...props }));

test('actual Mystery summary renders loading, error, unavailable and successful no-data distinctly', () => {
  const loading = render({ loading: true });
  assert.match(loading, /role="status"/); assert.match(loading, /Loading Mystery Shopper/);
  assert.doesNotMatch(loading, /No approved|No ratings|Approved visits/);
  const error = render({ error: 'Network failure' });
  assert.match(error, /role="alert"/); assert.match(error, /Network failure/);
  assert.doesNotMatch(error, /No approved|No ratings|Approved visits/);
  assert.match(render({}), /analytics are unavailable/);
  const empty = render({ analytics: { visits: { approved: 0 } } });
  assert.match(empty, /No approved Mystery Shopper visits/); assert.match(empty, /No ratings/);
  assert.doesNotMatch(empty, /Loading Mystery Shopper|role="alert"/);
});

test('actual successful Mystery summary distinguishes visits, rating counts and legitimate zero', () => {
  const html = render({
    analytics: { visits: { approved: 1 }, mystery_shopper: { csat_average: 0, csat_response_count: 2 }, nps: { total_responses: 1, nps: 0 } },
    mysteryAnalyticsSummary: { qualityAvg: 1, qualityRatingCount: 2, overallExperienceAvg: 0, overallExperienceRatingCount: 2 },
  });
  assert.match(html, /0\.00 \/ 10/); assert.match(html, /2 satisfaction ratings/);
  assert.match(html, /1 recommendation answer/); assert.doesNotMatch(html, /No approved Mystery Shopper visits/);
});

test('quality mean only combines declared 1-5 ratings, with actual contributing counts', () => {
  const rows = [
    { category: 'Service', score_min: 1, score_max: 5, average_score: 4, response_count: 2 },
    { category: 'Facilities', score_min: 1, score_max: 5, average_score: 2, response_count: 1 },
    { category: 'Binary', score_min: 0, score_max: 1, average_score: 1, response_count: 100 },
    { category: 'Service', score_min: 0, score_max: 5, average_score: 5, response_count: 100 },
    { category: 'Service', score_min: 1, score_max: 5, average_score: null, response_count: 100 },
    { category: 'Service', score_min: 1, score_max: 5, average_score: 'bad', response_count: 100 },
    { category: 'Service', score_min: 1, score_max: 5, average_score: 8, response_count: 100 },
    { category: 'Service', score_max: 5, average_score: 4, response_count: 100 },
    { category: 'Overall Experience', score_min: 1, score_max: 5, average_score: 4, response_count: 100 },
    { category: 'Overall Experience', score_min: 0, score_max: 10, average_score: 0, response_count: 2 },
    { category: 'Overall Experience', score_min: 0, score_max: 10, average_score: null, response_count: 50 },
  ];
  const result = summarizeMysteryQuestions(rows);
  assert.equal(result.qualityAvg, 10 / 3); assert.equal(result.qualityRatingCount, 3);
  assert.equal(result.overallExperienceAvg, 0); assert.equal(result.overallExperienceRatingCount, 2);
});

test('category display renders original-scale zero with its denominator instead of an invisible bar', () => {
  const html = render({ analytics: { visits: { approved: 1 } }, questionAverages: [
    { category: 'Service', score_min: 0, score_max: 10, average_score: 0, response_count: 3 },
    { category: 'Service', score_min: 1, score_max: 5, average_score: 4, response_count: 2 },
    { category: 'Service', score_min: 0, score_max: 5, average_score: 2, response_count: 1 },
  ] });
  const category = html.split('data-testid="category-scores"')[1].split('</ul>')[0];
  assert.equal((category.match(/data-category-score/g) || []).length, 3);
  assert.match(category, /Declared scale: 0–10/);
  assert.match(category, /0\.00/);
  assert.match(category, /3 scored responses/);
  assert.match(category, /Declared scale: 1–5/);
  assert.match(category, /Declared scale: 0–5/);
});

test('empty category display explicitly explains absent data and never reports a measured zero', () => {
  const html = render({ analytics: { visits: { approved: 0 } } });
  const category = html.split('data-testid="category-scores"')[1].split('</div></div>')[0];
  assert.match(category, /No category scores are available/);
  assert.doesNotMatch(category, /data-category-score|0\.00/);
});

test('B2B zero requires a positive valid-answer denominator; no answers is not a score', () => {
  const cards = (n, c) => buildAnalyticsCards({ isMysteryShopper: false, analytics: {
    nps: { nps: 0, total_responses: n }, customer_satisfaction: { csat_score: 0, response_count: c },
  } });
  assert.equal(cards(1, 2)[0].value, 0); assert.equal(cards(1, 2)[1].value, '0.0%');
  for (const count of [0, undefined, null, -1]) {
    const absent = cards(count, count);
    assert.equal(absent[0].value, 'No answers'); assert.equal(absent[0].numericValue, null);
    assert.equal(absent[1].value, 'No ratings'); assert.equal(absent[1].numericValue, null);
  }
});
