import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";

function scoreColor(score, max) {
  const s = Number(score);
  if (Number.isNaN(s)) return null;
  if (max <= 5) {
    if (s <= 2) return "red";
    if (s === 3) return "amber";
    return "green";
  }
  // 0-10 scale
  if (s <= 5) return "red";
  if (s <= 7) return "amber";
  return "green";
}

function ScoreBadge({ score, max }) {
  const color = scoreColor(score, max);
  const label = `${score} / ${max}`;
  const colorClass =
    color === "red"
      ? "bg-red-100 text-red-700 border-red-300"
      : color === "amber"
        ? "bg-amber-100 text-amber-700 border-amber-300"
        : "bg-emerald-100 text-emerald-700 border-emerald-300";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-sm font-semibold tabular-nums ${colorClass}`}>
      {label}
    </span>
  );
}

function YesNoBadge({ value }) {
  const norm = String(value || "").toLowerCase().trim();
  if (norm === "yes") {
    return <span className="inline-flex items-center rounded border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-700">Yes</span>;
  }
  if (norm === "no") {
    return <span className="inline-flex items-center rounded border border-red-300 bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-700">No</span>;
  }
  return <span className="text-sm text-muted-foreground">{value || "--"}</span>;
}

function MetaField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value || "--"}</p>
    </div>
  );
}

function ResponseAnswer({ response, editable, draft, updateReviewDraft, responseId }) {
  const type = String(response?.question_type || "").toLowerCase();
  const hasScore = response?.score !== null && response?.score !== undefined;
  const scoreMax = response?.score_max ?? (type === "score" && Number(response?.score) > 5 ? 10 : 5);

  if (hasScore) {
    return <ScoreBadge score={response.score} max={scoreMax} />;
  }

  const answerText = draft?.answer_text ?? response?.answer_text ?? "";
  if (type === "yes_no" || ["yes", "no"].includes(String(answerText).toLowerCase().trim())) {
    return editable ? (
      <Select
        value={answerText}
        onChange={(e) => updateReviewDraft?.(responseId, { ...draft, answer_text: e.target.value })}
        className="w-24"
      >
        <option value="">--</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </Select>
    ) : (
      <YesNoBadge value={answerText} />
    );
  }

  if (editable) {
    return (
      <Textarea
        value={answerText}
        onChange={(e) => updateReviewDraft?.(responseId, { ...draft, answer_text: e.target.value })}
        className="mt-1"
        rows={2}
      />
    );
  }

  return <p className="text-sm text-foreground">{answerText || "--"}</p>;
}

export default function MysteryVisitDetailCard({
  visit,
  responseGroups,
  formatSurveyResponseValue,
  formatReadableDateTime,
  onClose,
  editable = false,
  canEditResponseAnswer,
  canEditResponseActions,
  reviewResponseDrafts,
  reviewSavingResponseId,
  updateReviewDraft,
  addReviewAction,
  updateReviewAction,
  removeReviewAction,
  onSaveResponse,
  actionTimeframeOptions,
}) {
  if (!visit) return null;

  const statusVariant =
    visit.status === "Approved" ? "success"
      : visit.status === "Rejected" ? "destructive"
        : "warning";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {visit.location_name || visit.business_name || "Visit Detail"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Mystery Shopper Assessment
            </p>
          </div>
          <Badge variant={statusVariant} className="text-sm">
            {visit.status || "Pending"}
          </Badge>
        </div>

        {/* Visit metadata grid */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3 lg:grid-cols-4">
          <MetaField label="Visit Date" value={visit.visit_date} />
          <MetaField label="Visit Time" value={visit.visit_time} />
          <MetaField label="Purpose" value={visit.purpose_of_visit} />
          <MetaField label="Staff on Duty" value={visit.staff_on_duty} />
          <MetaField label="Shopper" value={visit.shopper_name} />
          <MetaField label="Location" value={visit.location_name || visit.business_name} />
          <MetaField
            label="Mandatory Completion"
            value={
              visit.mandatory_total_count
                ? `${visit.mandatory_answered_count ?? 0} / ${visit.mandatory_total_count}`
                : "--"
            }
          />
        </div>

        {/* Audit trail */}
        <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Submitted by:</span>{" "}
            {visit.submitted_by_name || "--"}
            {visit.submitted_by_email ? ` (${visit.submitted_by_email})` : ""}
            {visit.submitted_at ? ` · ${formatReadableDateTime(visit.submitted_at)}` : ""}
          </p>
          {editable && visit.edited_by_name ? (
            <p>
              <span className="font-medium text-foreground">Last edited by:</span>{" "}
              {visit.edited_by_name}
              {visit.edited_at ? ` · ${formatReadableDateTime(visit.edited_at)}` : ""}
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {responseGroups.length > 0 ? (
          responseGroups.map(({ category, responses }) => (
            <div key={category} className="rounded-xl border">
              {/* Category header */}
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{category}</h3>
                <span className="text-xs text-muted-foreground">{responses.length} question{responses.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="divide-y">
                {responses.map((response, qIndex) => {
                  const responseId = String(response.response_id || "");
                  const draft = reviewResponseDrafts?.[responseId] || {
                    answer_text: response.answer_text || "",
                    verbatim: response.verbatim || "",
                    actions: response.actions || [],
                  };
                  const isSaving = reviewSavingResponseId === responseId;
                  const displayNum = response.display_number ?? response.question_number ?? (qIndex + 1);

                  return (
                    <div key={response.response_id || `${response.question_id}-${qIndex}`} className="p-4">
                      {/* Question row */}
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {displayNum}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {response.question_text || "--"}
                          </p>

                          {/* Answer */}
                          <div>
                            {editable && canEditResponseAnswer?.(response) ? (
                              <ResponseAnswer
                                response={response}
                                editable
                                draft={draft}
                                updateReviewDraft={updateReviewDraft}
                                responseId={responseId}
                              />
                            ) : (
                              <ResponseAnswer response={response} editable={false} draft={null} />
                            )}
                          </div>

                          {/* Verbatim */}
                          {editable ? (
                            <div className="mt-2">
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">Verbatim notes</label>
                              <Textarea
                                value={draft.verbatim}
                                onChange={(e) => updateReviewDraft(responseId, { ...draft, verbatim: e.target.value })}
                                rows={2}
                                placeholder="Optional verbatim notes..."
                              />
                            </div>
                          ) : response.verbatim ? (
                            <p className="mt-1 text-xs italic text-muted-foreground">"{response.verbatim}"</p>
                          ) : null}

                          {/* Action points */}
                          {editable && canEditResponseActions?.(response) ? (
                            <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action Points</p>
                                <Button type="button" size="sm" variant="outline" onClick={() => addReviewAction(responseId)}>
                                  + Add Action
                                </Button>
                              </div>
                              {(draft.actions || []).map((action, actionIndex) => (
                                <div
                                  key={`${responseId}-action-${actionIndex}`}
                                  className="grid grid-cols-1 gap-2 rounded-md border bg-background p-3 md:grid-cols-2"
                                >
                                  <Textarea
                                    className="min-h-20 resize-y md:col-span-2"
                                    placeholder="Action required"
                                    value={action.action_required || ""}
                                    onChange={(e) => updateReviewAction(responseId, actionIndex, "action_required", e.target.value)}
                                  />
                                  <Input
                                    placeholder="Lead owner"
                                    value={action.action_owner || ""}
                                    onChange={(e) => updateReviewAction(responseId, actionIndex, "action_owner", e.target.value)}
                                  />
                                  <Select
                                    value={action.action_timeframe || ""}
                                    onChange={(e) => updateReviewAction(responseId, actionIndex, "action_timeframe", e.target.value)}
                                  >
                                    <option value="">Action timeframe</option>
                                    {(actionTimeframeOptions || []).map((opt) => (
                                      <option key={`${responseId}-${actionIndex}-${opt}`} value={opt}>{opt}</option>
                                    ))}
                                  </Select>
                                  <Textarea
                                    className="min-h-20 resize-y"
                                    placeholder="Support needed"
                                    value={action.action_support_needed || ""}
                                    onChange={(e) => updateReviewAction(responseId, actionIndex, "action_support_needed", e.target.value)}
                                  />
                                  <Textarea
                                    className="min-h-20 resize-y"
                                    placeholder="Comments"
                                    value={action.action_comments || ""}
                                    onChange={(e) => updateReviewAction(responseId, actionIndex, "action_comments", e.target.value)}
                                  />
                                  <div className="md:col-span-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => removeReviewAction(responseId, actionIndex)}
                                    >
                                      Remove Action
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {/* Save button */}
                          {editable ? (
                            <div className="mt-2 flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onSaveResponse(response)}
                                disabled={isSaving}
                              >
                                {isSaving ? "Saving..." : "Save Edit"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No responses found for this visit.</p>
        )}

        <div className="pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ← Back to Review Queue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
