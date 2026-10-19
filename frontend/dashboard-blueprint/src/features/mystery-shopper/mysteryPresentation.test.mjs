import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAnalyticsCards,
  getDeclaredQuestionScale,
  getRouteContext,
  presentMysteryMetrics,
  summarizeMysteryQuestions,
} from "./mysteryPresentation.js";

test("Mystery cards describe visits and never expose the B2B percentage CSAT card", () => {
  const cards = buildAnalyticsCards({
    isMysteryShopper: true,
    analytics: {
      visits: { approved: 1, draft: 0, pending: 0 },
      customer_satisfaction: { csat_score: 100 },
      mystery_shopper: { csat_average: 8.5, csat_response_count: 2 },
    },
    pendingReviewCount: 0,
  });

  assert.deepEqual(cards.map((card) => card.title), ["Approved visits", "Draft visits", "Pending visits", "Visits awaiting review"]);
  assert.equal(cards.some((card) => card.metric === "b2b_csat" || String(card.value).includes("%")), false);
});

test("Mystery question summaries use declared score_max rather than observed averages", () => {
  const summary = summarizeMysteryQuestions([
    { question_id: 1, category: "Service", average_score: 4.9, response_count: 2, score_min: 0, score_max: 10 },
    { question_id: 2, category: "Service", average_score: 5, response_count: 2, score_min: 1, score_max: 5 },
    { question_id: 3, category: "Overall Experience (CSAT & NPS)", average_score: 8.5, response_count: 2, score_min: 0, score_max: 10 },
  ]);

  assert.equal(summary.qualityAvg, 5);
  assert.equal(summary.qualityRatingCount, 2);
  assert.equal(summary.overallExperienceAvg, 8.5);
  assert.equal(summary.overallExperienceRatingCount, 2);
});

test("trend scale comes from selected question metadata, including a 1-5 scale", () => {
  const questions = [
    { question_id: 10, score_min: 1, score_max: 5, average_score: 4.9 },
    { question_id: 11, score_min: 0, score_max: 10, average_score: 2 },
  ];
  assert.deepEqual(getDeclaredQuestionScale(questions, "10"), { min: 1, max: 5, label: "1-5", question: questions[0] });
  assert.deepEqual(getDeclaredQuestionScale(questions, 11), { min: 0, max: 10, label: "0-10", question: questions[1] });
  assert.equal(getDeclaredQuestionScale([{ question_id: 12, average_score: 9 }], 12), null);
});

test("valid zero NPS remains data while missing NPS remains unavailable", () => {
  const zero = buildAnalyticsCards({ isMysteryShopper: false, analytics: { nps: { nps: 0, total_responses: 1 } } });
  const missing = buildAnalyticsCards({ isMysteryShopper: false, analytics: { nps: {} } });
  assert.equal(zero[0].value, 0);
  assert.equal(missing[0].value, "No answers");
});

test("one approved visit shows 8.50 from two CSAT ratings and zero NPS from one passive answer", () => {
  const metrics = presentMysteryMetrics({
    visits: { approved: 1 },
    mystery_shopper: { csat_average: 8.5, csat_response_count: 2 },
    nps: { nps: 0, passives: 1, total_responses: 1 },
  });
  assert.deepEqual(metrics, {
    approvedVisitCount: 1,
    csatRatingCount: 2,
    csatValue: 8.5,
    csatDisplay: "8.50 / 10",
    npsAnswerCount: 1,
    npsValue: 0,
    npsDisplay: "0",
  });
});

test("route context names the active module and section", () => {
  assert.deepEqual(getRouteContext("/reports", "Mystery Shopper"), {
    section: "Reports",
    title: "Mystery Shopper Reports",
    help: "Choose a scope, preview the report, then download or email it.",
  });
});

test("every registered dashboard route has contextual help", () => {
  const routes = ["/", "/planned", "/trends", "/review", "/actions", "/surveys", "/reports", "/user-guide", "/contractors", "/businesses", "/executives", "/locations", "/purposes", "/mystery-users"];
  for (const route of routes) {
    const context = getRouteContext(route, "Mystery Shopper");
    assert.match(context.title, /^Mystery Shopper /);
    assert.ok(context.help.length > 20, `${route} should have useful help`);
  }
});

test("DashboardPage keeps B2B percentage CSAT behind a B2B-only guard", () => {
  const source = readFileSync(new URL("../../pages/DashboardPage.jsx", import.meta.url), "utf8");
  const marker = source.indexOf("B2B NPS and percentage CSAT use a separate metric contract");
  const guard = source.indexOf("{isB2BPlatform ? (", marker);
  const csat = source.indexOf("CSAT shows the percentage", marker);
  assert.ok(marker >= 0 && guard > marker && csat > guard);
  assert.equal(source.includes("average_score || 0) <= 5.2"), false);
});
