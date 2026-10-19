import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { measuredValue, mandatoryProgress } from './metricPresentation.js';

const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const tone = source.slice(source.indexOf('  const getToneClass ='), source.indexOf('\n  };', source.indexOf('  const getToneClass =')) + 5);
const cards = source.slice(source.indexOf('<div className="targeted-kpis">'), source.indexOf('\n            ) : (', source.indexOf('<div className="targeted-kpis">')));
function render(targetedAnalytics) {
  const sandbox = { React, targetedAnalytics, measuredValue };
  vm.createContext(sandbox);
  vm.runInContext(transformSync(tone + `\nthis.cards = (${cards});`, { loader: 'jsx' }).code, sandbox);
  return renderToStaticMarkup(sandbox.cards);
}
for (const denominator of [undefined, null, 0]) {
  test(`targeted cards: ${denominator} denominators produce neutral no-data even with numeric placeholders`, () => {
    const html = render({ customer_satisfaction: { csat_score: 0, response_count: denominator }, competitive_exposure: { exposure_rate: 0, total_accounts: denominator } });
    assert.match(html, /class="kpi-neutral"><strong>B2B satisfied responses<\/strong><span>No answers/);
    assert.match(html, /class="kpi-neutral"><strong>Competitor Exposure<\/strong><span>No accounts/);
  });
}
test('targeted cards: valid zero is displayed and graded, not hidden', () => {
  const html = render({ customer_satisfaction: { csat_score: 0, response_count: 2 }, competitive_exposure: { exposure_rate: 0, total_accounts: 2 } });
  assert.match(html, /class="kpi-bad"><strong>B2B satisfied responses<\/strong><span>0.0%/);
  assert.match(html, /class="kpi-good"><strong>Competitor Exposure<\/strong><span>0.0%/);
});
test('targeted cards: populated positive values retain grading', () => {
  const html = render({ customer_satisfaction: { csat_score: 90, response_count: 2 }, competitive_exposure: { exposure_rate: 80, total_accounts: 2 } });
  assert.match(html, /class="kpi-good"><strong>B2B satisfied responses<\/strong><span>90.0%/);
  assert.match(html, /class="kpi-bad"><strong>Competitor Exposure<\/strong><span>80.0%/);
});
test('targeted cards: missing metric remains neutral despite positive denominator', () => {
  assert.equal(measuredValue(null, 5), null);
  assert.equal(measuredValue('', 5), null);
  assert.equal(measuredValue(NaN, 5), null);
});
for (const [visit, expected] of [
  [{ mandatory_answered_count: 0, mandatory_total_count: 0 }, '0/0'],
  [{ mandatory_answered_count: 0, mandatory_total_count: 12 }, '0/12'],
  [{ mandatory_answered_count: 3 }, '3 / Unknown (questionnaire metadata unavailable)'],
  [{}, 'Unknown / Unknown (questionnaire metadata unavailable)'],
]) test(`mandatory progress: ${expected}`, () => assert.equal(mandatoryProgress(visit), expected));
test('shipped progress cell uses metadata-aware formatter, not fabricated 24', () => {
  assert.match(source, /<span>\{mandatoryProgress\(visit\)\}<\/span>/);
  assert.doesNotMatch(source, /mandatory_total_count\s*\|\|\s*24/);
});
