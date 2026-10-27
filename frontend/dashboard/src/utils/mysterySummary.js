// Aggregate only comparable configured scales; a missing score is not zero.
export function weightedScoreSummary(items) {
  let sum = 0;
  let responseCount = 0;
  const scales = new Set();
  for (const item of items) {
    const score = Number(item.average_score);
    const count = Number(item.response_count);
    if (item.average_score == null || item.average_score === "" || !Number.isFinite(score) || !Number.isFinite(count) || count <= 0) continue;
    scales.add(`${item.score_min ?? "unknown"}:${item.score_max ?? "unknown"}`);
    sum += score * count;
    responseCount += count;
  }
  const comparable = scales.size <= 1;
  const scale = scales.size === 1 ? [...scales][0].split(":") : [];
  return {
    average: responseCount && comparable ? sum / responseCount : null,
    responseCount,
    scoreMax: scale[1] && scale[1] !== "unknown" ? Number(scale[1]) : null,
    mixedScales: !comparable,
  };
}

export function summarizeMysteryQuestions(items) {
  const overall = (item) => (item.category || "").toLowerCase().includes("overall experience");
  return {
    overallExperience: weightedScoreSummary(items.filter(overall)),
    quality: weightedScoreSummary(items.filter((item) => !overall(item) && Number(item.score_min) === 1 && Number(item.score_max) === 5)),
  };
}
