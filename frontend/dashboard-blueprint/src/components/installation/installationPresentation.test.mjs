import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

globalThis.React = React;
const root = fileURLToPath(new URL('../../..', import.meta.url));
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
async function render(name, props) {
  const { default: Component } = await server.ssrLoadModule(`/src/components/installation/${name}.jsx`);
  return renderToStaticMarkup(React.createElement(Component, props));
}

test('unloaded analytics is not reported as zero submitted assessments', async () => {
  const html = await render('InstallationAnalyticsView', { analytics: null, loading: true });
  assert.match(html, /Loading installation analytics/);
  assert.doesNotMatch(html, /No submitted installation assessments|0 submitted assessments/);
});
test('empty analytics shows no scores without a false zero grade', async () => {
  const html = await render('InstallationAnalyticsView', { analytics: { summary: { total_surveys: 0 } } });
  assert.match(html, /No submitted installation assessments/);
  assert.match(html, /No score/);
  assert.doesNotMatch(html, /0\.00 \/ 5|Critical Fail/);
});
test('measured zero is preserved while absent segments remain unscored', async () => {
  const html = await render('InstallationAnalyticsView', { analytics: { summary: { total_surveys: 1, overall_average_score: 0 } } });
  assert.match(html, /0\.00 \/ 5/);
  assert.match(html, /No score/);
  assert.match(html, /1 submitted assessment/);
});
test('Installation help has named buttons, disclosure state and focus styling', async () => {
  const html = await render('InstallationAnalyticsView', { analytics: { summary: { total_surveys: 0 } } });
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-label="Help for customer type scores"/);
  assert.match(html, /focus-visible:ring-2/);
  assert.match(html, /focus-visible:ring-offset-2/);
});
test('empty trends show a plain empty state rather than empty axes', async () => {
  const html = await render('InstallationTrendsView', { trends: { overall_trend: [{ period: '2026-10', average_score: null }] } });
  assert.match(html, /No installation trend data/);
  assert.doesNotMatch(html, /recharts/);
});
test('trend loading is distinct from no submitted data', async () => {
  const html = await render('InstallationTrendsView', { trends: null, loading: true });
  assert.match(html, /Loading installation trends/);
  assert.doesNotMatch(html, /No installation trend data/);
});
const filters = Object.fromEntries(['customer_name', 'inspector_name', 'work_order', 'location', 'date_from', 'date_to', 'customer_type', 'worker_type'].map(k => [k, '']));
test('assessment details distinguish a missing question score from measured zero', async () => {
  const html = await render('InstallationSurveyExplorer', { filters, surveys: [], selectedSurvey: { responses: [{ question_number: 1, score: null }, { question_number: 2, score: 0 }] } });
  assert.match(html, /No score recorded/);
  assert.match(html, /0\.00 \/ 5: Critical/);
  assert.match(html, /2 saved responses/);
  assert.doesNotMatch(html, /2 scored responses/);
});
test('assessment table preserves absent and real zero scores separately', async () => {
  const html = await render('InstallationSurveysDataTable', { data: [{ survey_id: 'a', overall_score: null }, { survey_id: 'b', overall_score: 0 }] });
  assert.match(html, /No score/);
  assert.match(html, /0\.00 \/ 5/);
  assert.match(html, /aria-label="Assessment filter column"/);
});
test('question response table has score units and labelled filters', async () => {
  const html = await render('InstallationResponsesDataTable', { responses: [{ question_number: 1, score: null }, { question_number: 2, score: 0 }] });
  assert.match(html, /No score/);
  assert.match(html, /0 \/ 5/);
  assert.match(html, /aria-label="Response filter column"/);
  assert.match(html, /aria-label="Responses per page"/);
});
