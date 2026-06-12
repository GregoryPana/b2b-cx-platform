/**
 * Converts a raw DB question_number to a display number.
 * Mystery Shopper questions are stored with question_number 2001–2027;
 * this normalises them to 1–27 for display.
 */
export function computeDisplayNumber(questionNumber, fallbackIndex = 0) {
  const raw = Number(questionNumber ?? NaN);
  if (!Number.isFinite(raw)) return fallbackIndex + 1;
  if (raw >= 2000) return raw - 2000;
  if (raw >= 1000) return raw - 1000;
  if (raw > 0) return raw;
  return fallbackIndex + 1;
}

/**
 * Builds a map of { questionId -> 1-based display number } from a sorted
 * questions array (sorted by question_number ascending).
 * Use inside a useMemo to keep it reactive.
 */
export function buildDisplayNumbers(questions) {
  const sorted = [...questions].sort(
    (a, b) => Number(a.question_number ?? a.order_index ?? 0) - Number(b.question_number ?? b.order_index ?? 0)
  );
  const map = {};
  sorted.forEach((q, i) => { map[q.id] = i + 1; });
  return map;
}
