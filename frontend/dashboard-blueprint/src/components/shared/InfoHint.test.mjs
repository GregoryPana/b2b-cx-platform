import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const bundle = await build({ entryPoints: [new URL('./InfoHint.jsx', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic' });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);

test('B2B help initially exposes a named keyboard button, not an unnamed native disclosure', () => {
  const html = renderToStaticMarkup(React.createElement(module.exports.default, { text: 'Original-scale score explanation', label: 'Help for B2B CSAT' }));
  assert.match(html, /<button/);
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Help for B2B CSAT"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /focus-visible:ring-2/);
  assert.doesNotMatch(html, /<summary|<details|role="tooltip"/);
});

test('DashboardPage uses the same production help component exercised by browser regression', () => {
  const source = readFileSync(new URL('../../pages/DashboardPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /import InfoHint from "..\/components\/shared\/InfoHint"/);
  assert.doesNotMatch(source, /const InfoHint =|function InfoHint/);
  assert.match(source, /<InfoHint text=/);
});
