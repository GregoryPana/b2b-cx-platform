// A measured zero requires a positive population, just like any other value.
export function measuredValue(value, denominator) {
  return value != null && value !== "" && Number.isFinite(Number(value)) && Number(denominator) > 0
    ? Number(value) : null;
}

export function mandatoryProgress(visit) {
  const answered = visit.mandatory_answered_count ?? "Unknown";
  const total = visit.mandatory_total_count;
  return total == null ? `${answered} / Unknown (questionnaire metadata unavailable)` : `${answered}/${total}`;
}
