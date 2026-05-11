import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">Survey Detail - {visit.business_name || "Visit"}</CardTitle>
        <CardDescription>
          {visit.visit_date || "--"} | {visit.status || "--"} | Representative: {visit.representative_name || visit.representative_id || "--"}
        </CardDescription>
        <CardDescription>
          Location: {visit.location_name || visit.business_name || "--"} | Time: {visit.visit_time || "--"} | Purpose: {visit.purpose_of_visit || "--"} | Staff: {visit.staff_on_duty || "--"} | Shopper: {visit.shopper_name || "--"}
        </CardDescription>
        {editable ? (
          <CardDescription>
            Last Edited Before Review: {visit.edited_by_name || "--"} {visit.edited_at ? `at ${formatReadableDateTime(visit.edited_at)}` : ""}
          </CardDescription>
        ) : null}
        <CardDescription>
          Audit Signature: {visit.submitted_by_name || "--"} ({visit.submitted_by_email || "--"}) {visit.submitted_at ? `at ${formatReadableDateTime(visit.submitted_at)}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {responseGroups.length > 0 ? (
          responseGroups.map(({ category, responses }) => (
            <div key={category} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold tracking-tight">{category}</p>
                <Badge variant="secondary">{responses.length} questions</Badge>
              </div>
              {responses.map((response) => {
                const display = formatSurveyResponseValue(response);
                const responseId = String(response.response_id || "");
                const draft = reviewResponseDrafts?.[responseId] || {
                  answer_text: response.answer_text || "",
                  verbatim: response.verbatim || "",
                  actions: response.actions || [],
                };
                const isSaving = reviewSavingResponseId === responseId;

                return (
                  <div key={response.response_id || `${response.question_id}-${response.created_at || ""}`} className="rounded-md border bg-background p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-base font-medium">Question {response.question_number || response.question_id}</p>
                    </div>
                    <p className="text-sm">{response.question_text || "--"}</p>

                    {editable && canEditResponseAnswer?.(response) ? (
                      <div className="mt-2">
                        <label className="mb-1 block text-sm font-medium">Answer</label>
                        <Textarea value={draft.answer_text} onChange={(event) => updateReviewDraft(responseId, { ...draft, answer_text: event.target.value })} />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{display.label}: {display.value}</p>
                    )}

                    {editable ? (
                      <div className="mt-2">
                        <label className="mb-1 block text-sm font-medium">Verbatim</label>
                        <Textarea value={draft.verbatim} onChange={(event) => updateReviewDraft(responseId, { ...draft, verbatim: event.target.value })} />
                      </div>
                    ) : response.verbatim ? (
                      <p className="mt-1 text-sm text-muted-foreground">Verbatim: {response.verbatim}</p>
                    ) : null}

                    {editable && canEditResponseActions?.(response) ? (
                      <div className="mt-3 space-y-2 rounded-md border bg-muted/40 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Action Points</p>
                          <Button type="button" size="sm" variant="outline" onClick={() => addReviewAction(responseId)}>Add Action</Button>
                        </div>
                        {(draft.actions || []).map((action, actionIndex) => (
                          <div key={`${responseId}-action-${actionIndex}`} className="grid grid-cols-1 gap-2 rounded-md border bg-background p-3 md:grid-cols-2">
                            <Textarea className="min-h-24 resize-y md:col-span-2" placeholder="Action required" value={action.action_required || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_required", event.target.value)} />
                            <Input placeholder="Lead owner" value={action.action_owner || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_owner", event.target.value)} />
                            <Select value={action.action_timeframe || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_timeframe", event.target.value)}>
                              <option value="">Action timeframe</option>
                              {actionTimeframeOptions.map((option) => (
                                <option key={`${responseId}-${actionIndex}-${option}`} value={option}>{option}</option>
                              ))}
                            </Select>
                            <Textarea className="min-h-24 resize-y" placeholder="Support needed" value={action.action_support_needed || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_support_needed", event.target.value)} />
                            <Textarea className="min-h-24 resize-y" placeholder="Comments" value={action.action_comments || ""} onChange={(event) => updateReviewAction(responseId, actionIndex, "action_comments", event.target.value)} />
                            <div className="md:col-span-2">
                              <Button type="button" size="sm" variant="destructive" onClick={() => removeReviewAction(responseId, actionIndex)}>Remove Action</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {editable ? (
                      <div className="mt-3">
                        <Button type="button" size="sm" variant="outline" onClick={() => onSaveResponse(response)} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save Response Edit"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No responses found for this visit.</p>
        )}
        <div>
          <Button type="button" variant="outline" onClick={onClose}>Close Details</Button>
        </div>
      </CardContent>
    </Card>
  );
}
