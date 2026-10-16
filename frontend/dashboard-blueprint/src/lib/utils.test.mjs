// Metric presentation tests. Run: node --test src/lib/*.test.mjs (from frontend/dashboard-blueprint).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getTrafficLightMetric, MYSTERY_METRIC_THRESHOLDS } from "./utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(
  readFileSync(path.resolve(here, "../../../../backend/tests/analytics/metric_threshold_contract.json"), "utf8"),
);

test("Mystery metric keys match the shared backend/dashboard contract", () => {
  for (const [metric, cases] of Object.entries(contract.metrics)) {
    for (const { value, tone } of cases) {
      assert.equal(getTrafficLightMetric(metric, value).tone, tone, `${metric}(${value})`);
    }
  }
});

test("every contract metric exists in the dashboard threshold table (parity)", () => {
  assert.deepEqual(Object.keys(MYSTERY_METRIC_THRESHOLDS).sort(), Object.keys(contract.metrics).sort());
});

test("Mystery CSAT on a 0-10 scale is no longer graded as a percentage (regression)", () => {
  assert.equal(getTrafficLightMetric("mystery_csat", 8.33).tone, "good");
  assert.equal(getTrafficLightMetric("mystery_csat", "8.33").tone, "good"); // report cards pass toFixed() strings
  assert.equal(getTrafficLightMetric("b2b_csat", 8.33).tone, "bad"); // percent rule unchanged for B2B
});

test("missing values are neutral, not red", () => {
  for (const metric of Object.keys(contract.metrics)) {
    assert.equal(getTrafficLightMetric(metric, "--").tone, "neutral");
    assert.equal(getTrafficLightMetric(metric, undefined).tone, "neutral");
  }
});

test("B2B and installation thresholds are preserved", () => {
  const cases = [
    ["b2b_nps", 50, "good"], ["b2b_nps", 49.9, "warning"], ["b2b_nps", 0, "warning"], ["b2b_nps", -1, "bad"],
    ["b2b_csat", 80, "good"], ["b2b_csat", 79.9, "warning"], ["b2b_csat", 60, "warning"], ["b2b_csat", 59, "bad"],
    ["b2b_relationship", 80, "good"], ["b2b_relationship", 60, "warning"], ["b2b_relationship", 59, "bad"],
    ["b2b_competitive_exposure", 20, "good"], ["b2b_competitive_exposure", 40, "warning"], ["b2b_competitive_exposure", 41, "bad"],
    ["installation_average", 4, "good"], ["installation_average", 3, "warning"], ["installation_average", 2.9, "bad"],
    ["b2b_csat", "85%", "good"],
  ];
  for (const [metric, value, tone] of cases) {
    assert.equal(getTrafficLightMetric(metric, value).tone, tone, `${metric}(${value})`);
  }
});
