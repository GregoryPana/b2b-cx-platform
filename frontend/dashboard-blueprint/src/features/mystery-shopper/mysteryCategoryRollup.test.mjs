import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildMysteryCategoryRollup } from './mysteryPresentation.js';

const source = readFileSync(new URL('./components/MysteryAnalyticsSummarySection.jsx', import.meta.url), 'utf8');
function chartData(questionAverages) {
  const start = source.indexOf('const categoryRollup = ') + 'const categoryRollup = '.length;
  const end = source.indexOf('\n\n', start);
  return vm.runInNewContext(source.slice(start, end), {
    questionAverages, buildMysteryCategoryRollup, useMemo: fn => fn(),
    CATEGORY_ORDER: [], CATEGORY_COLORS: {}, DEFAULT_BAR_COLOR: '#6b7280',
  });
}
const row = (score_min, score_max, average_score, response_count = 2, category = 'Overall Experience (CSAT & NPS)') =>
  ({ category, score_min, score_max, average_score, response_count });

test('actual category chart data keeps each declared scale and maximum rating separate without normalization', () => {
  const rows = [row(1, 5, 5), row(0, 10, 10), row(0, 5, 5), row(0, 1, 1)];
  const data = chartData(rows);
  assert.equal(data.length, 4);
  for (const expected of rows) {
    const actual = data.find(x => x.score_min === expected.score_min && x.score_max === expected.score_max);
    assert.equal(actual.avg_score, expected.average_score);
    assert.equal(actual.response_count, 2);
    assert.equal(actual.category_label, `${expected.category} (${expected.score_min}–${expected.score_max})`);
    assert.equal('pct' in actual, false);
  }
  assert.match(source, /aria-label="Category means on original scales"/);
  assert.match(source, /row.avg_score.toFixed\(2\)/);
  assert.match(source, /Declared scale: \{row.score_min\}–\{row.score_max\}/);
  assert.doesNotMatch(source, /width=\{210\}/);
});

test('actual chart data counts only positive integer valid contributors; null is absent and real zero remains', () => {
  const valid = row(0, 10, 0, 2);
  const invalid = [
    row(0, 10, 9, 0), row(0, 10, 9, null), row(0, 10, 9, -1), row(0, 10, 9, 0.5),
    row(0, 10, 9, 'bad'), row(0, 10, null, 100), row(0, 10, NaN, 100), row(0, 10, Infinity, 100),
    row(0, 10, -1, 100), row(0, 10, 11, 100), row(null, 10, 9, 100), row(0, null, 9, 100),
    row(5, 5, 5, 100), row(10, 0, 5, 100), row(0, 10, '', 100),
  ];
  assert.equal(chartData(invalid).length, 0);
  const data = chartData([valid, ...invalid]);
  assert.equal(data.length, 1); assert.equal(data[0].avg_score, 0); assert.equal(data[0].response_count, 2);
});

test('same-scale weighted means retain original precision and categories, including unknown categories', () => {
  const rows = [row(1, 5, 5, 2, 'Service'), row(1, 5, 1, 1, 'Service'), row(1, 5, 2, 4, 'Other')];
  const data = chartData(rows);
  const service = data.find(x => x.category === 'Service');
  assert.equal(service.avg_score, 11 / 3); assert.equal(service.response_count, 3);
  assert.equal(data.find(x => x.category === 'Other').avg_score, 2);
  assert.equal(rows[0].average_score, 5);
});
