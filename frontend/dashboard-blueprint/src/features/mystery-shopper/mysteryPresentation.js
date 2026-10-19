const OVERALL_EXPERIENCE_CATEGORY = "overall experience";

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function weightedQuestionAverage(items = []) {
  const total = items.reduce(
    (acc, item) => {
      const average = asFiniteNumber(item?.average_score);
      const count = asFiniteNumber(item?.response_count);
      if (average === null || count === null || count <= 0) return acc;
      return { score: acc.score + average * count, count: acc.count + count };
    },
    { score: 0, count: 0 },
  );
  return total.count > 0 ? total.score / total.count : null;
}

export function summarizeMysteryQuestions(questionAverages = []) {
  const validForScale = (item, min, max) => {
    const average = asFiniteNumber(item?.average_score);
    const count = asFiniteNumber(item?.response_count);
    return asFiniteNumber(item?.score_min) === min && asFiniteNumber(item?.score_max) === max
      && average !== null && average >= min && average <= max && Number.isInteger(count) && count > 0;
  };
  const isOverallExperience = (item) => String(item?.category || "").toLowerCase().includes(OVERALL_EXPERIENCE_CATEGORY);
  const overallExperience = questionAverages.filter((item) => isOverallExperience(item) && validForScale(item, 0, 10));
  const qualityQuestions = questionAverages.filter((item) => !isOverallExperience(item) && validForScale(item, 1, 5));
  return {
    qualityAvg: weightedQuestionAverage(qualityQuestions),
    qualityRatingCount: qualityQuestions.reduce((sum, item) => sum + Number(item.response_count), 0),
    overallExperienceAvg: weightedQuestionAverage(overallExperience),
    overallExperienceRatingCount: overallExperience.reduce((sum, item) => sum + Number(item.response_count), 0),
  };
}

// Keep raw metrics separate by both declared bounds; never infer or normalize scales.
export function buildMysteryCategoryRollup(questionAverages = []) {
  const groups = new Map();
  for (const q of questionAverages) {
    const min = asFiniteNumber(q?.score_min);
    const max = asFiniteNumber(q?.score_max);
    const average = asFiniteNumber(q?.average_score);
    const count = asFiniteNumber(q?.response_count);
    if (min === null || max === null || max <= min || average === null
      || average < min || average > max || !Number.isInteger(count) || count <= 0) continue;
    const category = q.category || "Uncategorized";
    const key = JSON.stringify([category, min, max]);
    const group = groups.get(key) || { category, score_min: min, score_max: max, scoreSum: 0, response_count: 0 };
    group.scoreSum += average * count;
    group.response_count += count;
    groups.set(key, group);
  }
  return [...groups.values()].map(({ scoreSum, ...group }) => ({
    ...group,
    category_label: `${group.category} (${group.score_min}–${group.score_max})`,
    avg_score: scoreSum / group.response_count,
  }));
}

export function presentB2BMetrics(analytics) {
  const nps = analytics?.nps || {};
  const csat = analytics?.customer_satisfaction || {};
  return {
    nps: asFiniteNumber(nps.total_responses) > 0 ? asFiniteNumber(nps.nps) : null,
    csat: asFiniteNumber(csat.response_count) > 0 ? asFiniteNumber(csat.csat_score) : null,
  };
}

export function getDeclaredQuestionScale(questionAverages = [], selectedQuestionId) {
  const question = questionAverages.find((item) => String(item?.question_id) === String(selectedQuestionId));
  const min = asFiniteNumber(question?.score_min);
  const max = asFiniteNumber(question?.score_max);
  if (min === null || max === null || max <= min) return null;
  return { min, max, label: `${min}-${max}`, question };
}

export function presentMysteryMetrics(analytics) {
  const mystery = analytics?.mystery_shopper || {};
  const csatRatingCount = asFiniteNumber(mystery.csat_response_count) || 0;
  const csatValue = asFiniteNumber(mystery.csat_average);
  const npsAnswerCount = asFiniteNumber(analytics?.nps?.total_responses) || 0;
  const npsValue = asFiniteNumber(analytics?.nps?.nps);
  return {
    approvedVisitCount: asFiniteNumber(analytics?.visits?.approved) || 0,
    csatRatingCount,
    csatValue,
    csatDisplay: csatRatingCount > 0 && csatValue !== null ? `${csatValue.toFixed(2)} / 10` : "No ratings",
    npsAnswerCount,
    npsValue,
    npsDisplay: npsAnswerCount > 0 && npsValue !== null ? String(npsValue) : "No answers",
  };
}

export function buildAnalyticsCards({ isMysteryShopper, analytics, pendingReviewCount = 0 }) {
  if (isMysteryShopper) {
    return [
      { title: "Approved visits", value: analytics?.visits?.approved ?? 0, unit: "visits" },
      { title: "Draft visits", value: analytics?.visits?.draft ?? 0, unit: "visits" },
      { title: "Pending visits", value: analytics?.visits?.pending ?? 0, unit: "visits" },
      { title: "Visits awaiting review", value: pendingReviewCount, unit: "visits" },
    ];
  }
  const metrics = presentB2BMetrics(analytics);
  return [
    { title: "NPS", value: metrics.nps ?? "No answers", numericValue: metrics.nps, metric: "b2b_nps", unit: "score" },
    { title: "CSAT", value: metrics.csat === null ? "No ratings" : `${metrics.csat.toFixed(1)}%`, numericValue: metrics.csat, metric: "b2b_csat", unit: "positive ratings" },
  ];
}

const ROUTE_LABELS = {
  "/": ["Analytics", "Review approved results, counts, score scales, and trends for this module."],
  "/planned": ["Planned visits", "Create and manage B2B draft visits before survey completion."],
  "/trends": ["Trends", "Track question results over time using each question's declared score scale."],
  "/review": ["Review queue", "Check submitted visits that are waiting for a decision."],
  "/actions": ["Action points", "Track follow-up work recorded against B2B survey answers."],
  "/surveys": ["Survey results", "Filter visits and open a visit to see its recorded answers."],
  "/reports": ["Reports", "Choose a scope, preview the report, then download or email it."],
  "/user-guide": ["User guide", "Read instructions for the selected module."],
  "/contractors": ["Contractors", "Manage contractor names used in installation assessments."],
  "/businesses": ["Businesses", "Manage businesses available to the B2B module."],
  "/executives": ["Account executives", "Manage account executives available to the B2B module."],
  "/locations": ["Locations", "Manage locations available to Mystery Shopper visits."],
  "/purposes": ["Visit purposes", "Manage purposes available to Mystery Shopper visits."],
  "/mystery-users": ["Mystery Shopper users", "Manage shopper access and enrolment."],
};

export function getRouteContext(pathname, activePlatform) {
  const [section, help] = ROUTE_LABELS[pathname] || ["Dashboard", "Use the navigation to open a dashboard page."];
  const platform = activePlatform || "CWSCX";
  return { section, title: `${platform} ${section}`, help };
}
