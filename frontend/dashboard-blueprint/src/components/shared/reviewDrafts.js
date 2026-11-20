// Pure helpers for the review panels: which responses have edits that are not saved yet.

const ACTION_FIELDS = ["action_required", "action_owner", "action_timeframe", "action_support_needed", "action_comments"];

const text = (value) => (value == null ? "" : String(value));

function normalizeActions(actions) {
  return (Array.isArray(actions) ? actions : []).map((action) =>
    ACTION_FIELDS.map((field) => text(action?.[field]).trim())
  );
}

// True when the draft differs from what the server last returned for this response.
// A missing draft means nothing was touched.
export function isReviewResponseDirty(response, draft) {
  if (!response || !draft) return false;
  if (answerDiffers(response, draft)) return true;
  if (text(draft.verbatim).trim() !== text(response.verbatim).trim()) return true;
  return JSON.stringify(normalizeActions(draft.actions)) !== JSON.stringify(normalizeActions(response.actions));
}

// Scored questions have no editable text answer, so an empty draft answer is not a change there.
function answerDiffers(response, draft) {
  const now = text(draft.answer_text).trim();
  if (now === text(response.answer_text).trim()) return false;
  const hasScore = response.score !== null && response.score !== undefined;
  return !(hasScore && now === "");
}

// Ids (as strings) of every response in the visit that has unsaved edits.
export function dirtyReviewResponseIds(visit, drafts) {
  const responses = Array.isArray(visit?.responses) ? visit.responses : [];
  return responses
    .filter((response) => isReviewResponseDirty(response, drafts?.[String(response.response_id)]))
    .map((response) => String(response.response_id));
}
