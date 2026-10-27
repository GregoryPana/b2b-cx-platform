// Confirm the exact assessment and answers, not merely a matching row count.
export function savedAnswersMatch(saved, surveyId, submitted) {
  if (!surveyId || String(saved?.survey_id) !== String(surveyId) || !Array.isArray(saved?.responses)) return false;
  if (!submitted.length || saved.responses.length !== submitted.length) return false;
  const byQuestion = new Map(saved.responses.map(row => [String(row.question_number), row.score]));
  if (byQuestion.size !== submitted.length) return false;
  return submitted.every(row => {
    const score = byQuestion.get(String(row.question_number));
    return score != null && score !== '' && Number.isFinite(Number(score)) && Number(score) === row.score;
  });
}
