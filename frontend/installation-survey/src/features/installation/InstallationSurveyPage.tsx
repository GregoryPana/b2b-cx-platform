import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";
import { savedAnswersMatch } from "./saveVerification";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const CUSTOMER_TYPES = ["B2B", "B2C"];
const WORKER_TYPES = ["Field Team", "Contractor"];

function scoreBandLabel(value) {
  if (value >= 4) return "Pass - Excellent";
  if (value >= 3 && value < 4) return "Pass - Needs Improvement";
  if (value >= 2) return "Fail - Rework Required";
  return "Critical Fail";
}

function parseScore(value) {
  return value == null || (typeof value === "string" && !value.trim()) ? NaN : Number(value);
}

function getScoreRange(question) {
  const min = Number(question?.score_min ?? 1);
  const max = Number(question?.score_max ?? 5);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return { min: 1, max: 5 };
  }
  return { min, max };
}

function getScoreOptions(question) {
  const { min, max } = getScoreRange(question);
  const options: number[] = [];
  for (let value = min; value <= max; value += 1) {
    options.push(value);
  }
  return options;
}

export default function InstallationSurveyPage({ headers }) {
  const [questions, setQuestions] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loadingContractors, setLoadingContractors] = useState(false);
  const [fieldTeamMemberOptions, setFieldTeamMemberOptions] = useState([]);
  const [scoresByQuestion, setScoresByQuestion] = useState({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [questionsReady, setQuestionsReady] = useState(false);
  const saveScope = useRef({ generation: 0, busy: false, attempted: false, accepted: null, controller: null });
  useEffect(() => () => {
    saveScope.current.generation += 1;
    saveScope.current.controller?.abort();
  }, []);

  const [formData, setFormData] = useState({
    inspector_name: "",
    work_order: "",
    customer_name: "",
    customer_type: "B2B",
    location: "",
    date_work_done: "",
    job_done_by: "Field Team",
    contractor_name: "",
    field_team_members: [""],
    action_points: [""],
  });

  const loadContractors = async (query = "") => {
    setLoadingContractors(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`${API_BASE}/installation/contractors${params.toString() ? `?${params.toString()}` : ""}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load contractors");
      setContractors(Array.isArray(data) ? data : []);
    } catch {
      setContractors([]);
    } finally {
      setLoadingContractors(false);
    }
  };

  const loadFieldTeamMembers = async (query = "") => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`${API_BASE}/installation/field-team-members${params.toString() ? `?${params.toString()}` : ""}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load field team members");
      setFieldTeamMemberOptions(Array.isArray(data) ? data : []);
    } catch {
      setFieldTeamMemberOptions([]);
    }
  };

  useEffect(() => {
    const loadQuestions = async () => {
      setLoadingQuestions(true);
      setQuestionsReady(false);
      try {
        const res = await fetch(`${API_BASE}/installation/questions`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed to load questions");
        setQuestions(Array.isArray(data) ? data : []);
        setQuestionsReady(true);
      } catch (err) {
        if (!saveScope.current.attempted) setError(err.message);
      } finally {
        setLoadingQuestions(false);
      }
    };
    loadQuestions();
    loadContractors();
    loadFieldTeamMembers();
  }, [headers]);

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const score = parseScore(scoresByQuestion[q.question_number]);
      if (!Number.isFinite(score)) return false;
      const { min, max } = getScoreRange(q);
      return score >= min && score <= max;
    }).length;
  }, [questions, scoresByQuestion]);

  const averageScore = useMemo(() => {
    if (!questions.length) return null;
    const values = questions
      .map((q) => {
        const score = parseScore(scoresByQuestion[q.question_number]);
        const { min, max } = getScoreRange(q);
        if (!Number.isFinite(score) || score < min || score > max) return null;
        return score;
      })
      .filter((v): v is number => typeof v === "number");
    if (!values.length) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [questions, scoresByQuestion]);

  const missingDetails = useMemo(() => {
    const missing = [];
    for (const [key, label] of Object.entries({ inspector_name: "Quality Assurance Inspector", work_order: "Work Order", customer_name: "Customer Name", location: "Location", date_work_done: "Date Work Done" })) {
      if (!formData[key]?.trim()) missing.push(label);
    }
    if (!CUSTOMER_TYPES.includes(formData.customer_type)) missing.push("Customer Type");
    if (!WORKER_TYPES.includes(formData.job_done_by)) missing.push("Job Done By");
    if (formData.job_done_by === "Contractor" && !formData.contractor_name.trim()) missing.push("Contractor Name");
    const members = (formData.field_team_members || []).map(member => member.trim()).filter(Boolean);
    if (formData.job_done_by === "Field Team" && (!members.length || members.length > 5)) missing.push("Field Team Members (1 to 5)");
    return missing;
  }, [formData]);
  const missingQuestions = questions.filter(q => {
    const score = parseScore(scoresByQuestion[q.question_number]);
    const { min, max } = getScoreRange(q);
    return !Number.isFinite(score) || score < min || score > max;
  });
  const canSubmit = questionsReady && !loadingQuestions && questions.length > 0 &&
    !missingDetails.length && !missingQuestions.length && !submitting && !saveScope.current.attempted;

  const updateForm = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const setQuestionScore = (questionNumber, scoreValue) => {
    setScoresByQuestion((prev) => ({ ...prev, [questionNumber]: scoreValue }));
  };

  // One POST creates the entire assessment. Never replay an uncertain create.
  const verifyExisting = async (accepted = saveScope.current.accepted) => {
    const scope = saveScope.current;
    if (!accepted || scope.busy || accepted !== scope.accepted) return;
    scope.busy = true;
    const generation = scope.generation;
    const controller = new AbortController();
    scope.controller = controller;
    const owns = () => scope.generation === generation && scope.accepted === accepted;
    setSubmitting(true);
    try {
      const verifyRes = await fetch(`${API_BASE}/installation/surveys/${encodeURIComponent(accepted.survey_id)}`, { headers, signal: controller.signal });
      const verifyData = await verifyRes.json();
      if (!owns()) return;
      const saveVerified = verifyRes.ok && savedAnswersMatch(verifyData, accepted.survey_id, accepted.snapshot.responses);
      setSuccess({ ...accepted, saveVerified });
      scope.accepted = { ...accepted, saveVerified };
    } catch {
      if (owns()) setSuccess({ ...accepted, saveVerified: false });
    } finally {
      if (scope.generation === generation) {
        scope.busy = false;
        scope.controller = null;
        setSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const scope = saveScope.current;
    if (!canSubmit || scope.busy || scope.attempted) return;
    const snapshot = {
      inspector_name: formData.inspector_name.trim(),
      work_order: formData.work_order.trim(),
      customer_name: formData.customer_name.trim(),
      customer_type: formData.customer_type,
      location: formData.location.trim(),
      date_work_done: formData.date_work_done,
      job_done_by: formData.job_done_by,
      contractor_name: formData.job_done_by === "Contractor" ? formData.contractor_name.trim() : null,
      field_team_members: formData.job_done_by === "Field Team" ? formData.field_team_members.map(member => member.trim()).filter(Boolean).slice(0, 5) : [],
      action_points: formData.action_points.map(point => point.trim()).filter(Boolean).slice(0, 5),
      responses: questions.map(q => ({ question_number: q.question_number, score: parseScore(scoresByQuestion[q.question_number]) })),
    };
    scope.busy = true;
    scope.attempted = true;
    const generation = scope.generation;
    const controller = new AbortController();
    scope.controller = controller;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/installation/surveys`, {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(snapshot), signal: controller.signal,
      });
      const data = await res.json();
      if (scope.generation !== generation) return;
      if (!res.ok || data?.survey_id == null || !String(data.survey_id).trim()) throw new Error("No accepted reference received");
      const accepted = { survey_id: data.survey_id, overall_score: Number(data.overall_score), action_points: snapshot.action_points, snapshot, saveVerified: false };
      scope.accepted = accepted;
      setSuccess(accepted);
      scope.busy = false;
      await verifyExisting(accepted);
    } catch {
      if (scope.generation === generation) setError("Submission outcome unknown or not confirmed. Your details are retained in this page. Check assessment records with an administrator before submitting again; creating another assessment could duplicate this one. Do not refresh or close this page until you have checked. This API cannot safely retry an unknown create.");
    } finally {
      if (scope.generation === generation) {
        scope.busy = false;
        scope.controller = null;
        setSubmitting(false);
      }
    }
  };

  const startNewAssessment = () => {
    const scope = saveScope.current;
    if (scope.busy || !scope.accepted?.saveVerified) return;
    if (!window.confirm("Start a new assessment? This clears the retained form, including any edits made since submission.")) return;
    scope.generation += 1;
    scope.controller?.abort();
    scope.accepted = null;
    scope.attempted = false;
    setSuccess(null);
    setError("");
    setScoresByQuestion({});
    setFormData(prev => ({ ...prev, work_order: "", customer_name: "", location: "", date_work_done: "", contractor_name: "", field_team_members: [""], action_points: [""] }));
  };

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Assess an installation</h1>
        <p className="text-muted-foreground mt-2">Record the job details, score every installation check on its stated scale, then submit the assessment.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Details</CardTitle>
                <CardDescription>Enter the installation quality assessment details below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
                {success && !success.saveVerified && (
                  <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
                    <div>Submission accepted (Reference: <strong>{success.survey_id}</strong>), but we couldn't confirm all responses were saved. Retained details exist only in this page; do not refresh or close it until checked.</div>
                    <div>Keep this reference and ask an administrator to check the saved answers before submitting again, to avoid a duplicate. Your form has not been cleared.</div>
                    <Button type="button" variant="outline" disabled={submitting} onClick={() => verifyExisting()}>Reverify existing assessment</Button>
                  </div>
                )}
                {success && success.saveVerified && (
                  <div className="rounded-md border border-success/50 bg-success/10 p-3 text-sm text-success">
                    <div>Saved answers verified. Reference: <strong>{success.survey_id}</strong></div>
                    <Button type="button" variant="outline" disabled={submitting} onClick={startNewAssessment}>Start new assessment</Button>
                    <div>Overall score: <strong>{Number.isFinite(success.overall_score) ? `${success.overall_score.toFixed(2)} / 5` : "Unavailable"}</strong> {Number.isFinite(success.overall_score) ? `(${scoreBandLabel(success.overall_score)})` : ""}</div>
                    {success.action_points?.length ? (
                      <div className="mt-2">
                        <div>Action points / recommendations:</div>
                        <ul className="list-disc pl-5">
                          {success.action_points.map((point, index) => (
                            <li key={index}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}

                {success && <p className="text-sm text-muted-foreground">The reference and result above apply to the submitted snapshot only. Edits below are retained but are not saved to that assessment. Start a new assessment only after verification; this clears the form with confirmation.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="inspector_name">Quality Assurance Inspector</Label>
                    <Input id="inspector_name" value={formData.inspector_name} onChange={(e) => updateForm("inspector_name", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="work_order">Work Order</Label>
                    <Input id="work_order" value={formData.work_order} onChange={(e) => updateForm("work_order", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input id="customer_name" value={formData.customer_name} onChange={(e) => updateForm("customer_name", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" value={formData.location} onChange={(e) => updateForm("location", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_work_done">Date Work Done</Label>
                    <Input id="date_work_done" type="date" value={formData.date_work_done} onChange={(e) => updateForm("date_work_done", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Type</Label>
                    <div className="flex flex-wrap gap-2">
                      {CUSTOMER_TYPES.map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={formData.customer_type === type ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateForm("customer_type", type)}
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Job Done By</Label>
                    <div className="flex flex-wrap gap-2">
                      {WORKER_TYPES.map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={formData.job_done_by === type ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              job_done_by: type,
                              contractor_name: type === "Contractor" ? prev.contractor_name : "",
                              field_team_members: type === "Field Team" ? (prev.field_team_members?.length ? prev.field_team_members : [""]) : [""],
                            }))
                          }
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {formData.job_done_by === "Contractor" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="contractor_name">Contractor Name</Label>
                      <Input
                        id="contractor_name"
                        list="contractor-options"
                        value={formData.contractor_name}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateForm("contractor_name", value);
                          loadContractors(value);
                        }}
                        placeholder="Search/select contractor"
                        required
                      />
                      <datalist id="contractor-options">
                        {contractors.map((contractor) => (
                          <option key={contractor.id} value={contractor.name} />
                        ))}
                      </datalist>
                      <p className="text-xs text-muted-foreground">
                        {loadingContractors ? "Searching contractors..." : "Select an existing contractor from the managed list."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label>Field Team Members (up to 5)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={(formData.field_team_members || []).length >= 5}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              field_team_members: [...(prev.field_team_members || []), ""].slice(0, 5),
                            }))
                          }
                        >
                          Add Member
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {(formData.field_team_members || []).map((memberName, index) => (
                          <div key={`member-${index}`} className="flex items-center gap-2">
                            <Input
                              value={memberName}
                              list="field-team-member-options"
                              onChange={(event) => {
                                const { value } = event.target;
                                setFormData((prev) => {
                                  const nextMembers = [...(prev.field_team_members || [])];
                                  nextMembers[index] = value;
                                  return { ...prev, field_team_members: nextMembers.slice(0, 5) };
                                });
                                loadFieldTeamMembers(value);
                              }}
                              placeholder={`Member ${index + 1} name`}
                              required={index === 0}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={(formData.field_team_members || []).length <= 1}
                              onClick={() =>
                                setFormData((prev) => {
                                  const nextMembers = (prev.field_team_members || []).filter((_, itemIndex) => itemIndex !== index);
                                  return { ...prev, field_team_members: nextMembers.length ? nextMembers : [""] };
                                })
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                      <datalist id="field-team-member-options">
                        {fieldTeamMemberOptions.map((member) => (
                          <option key={member.id} value={member.name} />
                        ))}
                      </datalist>
                      <p className="text-xs text-muted-foreground">
                        Start typing to reuse an existing field team member name, or add a new one.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Score each installation check</CardTitle>
                <CardDescription>{answeredCount} of {questions.length || 0} questions answered. Each question shows the score range supplied for that question.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingQuestions ? (
                  <div className="space-y-4">
                    {[1,2,3,4,5,6,7].map((n) => (
                      <Skeleton key={n} className="h-24 w-full" />
                    ))}
                  </div>
                ) : questions.length === 0 ? (
                  <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No installation questions are available. The assessment cannot be submitted until an administrator configures them.
                  </div>
                ) : (
                  questions.map((question) => (
                    <div key={question.question_number} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{question.category}</p>
                          <p className="mt-1 font-medium">Q{question.question_number}. {question.question_text}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3" role="group" aria-label={`Score Q${question.question_number} from ${getScoreRange(question).min} to ${getScoreRange(question).max}`}>
                        {getScoreOptions(question).map((score) => (
                          <Button
                            key={score}
                            type="button"
                            variant={parseScore(scoresByQuestion[question.question_number]) === score ? "default" : "outline"}
                            size="sm"
                            aria-pressed={parseScore(scoresByQuestion[question.question_number]) === score}
                            aria-label={`Score ${score} out of ${getScoreRange(question).max}`}
                            onClick={() => setQuestionScore(question.question_number, score)}
                          >
                            {score}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Allowed score: {getScoreRange(question).min} to {getScoreRange(question).max}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Action Points / Recommendations</CardTitle>
                <CardDescription>Optional. Add up to 5 action points or recommendations arising from this assessment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={(formData.action_points || []).length >= 5}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        action_points: [...(prev.action_points || []), ""].slice(0, 5),
                      }))
                    }
                  >
                    Add Action Point
                  </Button>
                </div>
                <div className="space-y-2">
                  {(formData.action_points || []).map((point, index) => (
                    <div key={`action-point-${index}`} className="flex items-center gap-2">
                      <Input
                        value={point}
                        onChange={(event) =>
                          setFormData((prev) => {
                            const nextPoints = [...(prev.action_points || [])];
                            nextPoints[index] = event.target.value;
                            return { ...prev, action_points: nextPoints.slice(0, 5) };
                          })
                        }
                        placeholder={`Action point ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={(formData.action_points || []).length <= 1}
                        onClick={() =>
                          setFormData((prev) => {
                            const nextPoints = (prev.action_points || []).filter((_, itemIndex) => itemIndex !== index);
                            return { ...prev, action_points: nextPoints.length ? nextPoints : [""] };
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle>Scoring Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-md border p-3">
                  <p className="font-medium">4 to 5 - Pass (Excellent)</p>
                  <p className="text-muted-foreground">High-quality install. No further action needed.</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-medium">3 to less than 4 - Pass (Needs Improvement)</p>
                  <p className="text-muted-foreground">Minor issues. Quality Assurance Inspector can correct small items and log feedback.</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-medium">2 - Fail (Rework Required)</p>
                  <p className="text-muted-foreground">Significant misses. Rework order is required.</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-medium">1 - Critical Fail</p>
                  <p className="text-muted-foreground">Major safety/property/network issue. Immediate escalation is required.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Current overall score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">{averageScore != null ? `${averageScore.toFixed(2)} / 5` : "Not scored"}</div>
                <p className="text-xs text-muted-foreground">Mean of the questions answered so far. Final scale: 1 (Critical Fail) to 5 (Pass - Excellent).</p>
                <div className="pt-4">
                  {(!questionsReady || loadingQuestions) && <p role="status">Questions are not ready. Submission is unavailable.</p>}
                  {(missingDetails.length > 0 || missingQuestions.length > 0) && (
                    <div className="mb-3 text-sm" aria-live="polite">
                      <p>Complete these items before submitting:</p>
                      <ul className="list-disc pl-5">
                        {missingDetails.map(label => <li key={label}>{label}</li>)}
                        {missingQuestions.map(q => <li key={`q-${q.question_number}`}>Q{q.question_number}. {q.question_text}</li>)}
                      </ul>
                    </div>
                  )}
                  <Button type="submit" disabled={!canSubmit} className="w-full">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Survey"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
