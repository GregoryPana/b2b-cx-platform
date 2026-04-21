import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const CUSTOMER_TYPES = ["B2B", "B2C"];
const WORKER_TYPES = ["Field Team", "Contractor"];

function scoreBandLabel(value) {
  if (value >= 4) return "Pass - Excellent";
  if (value >= 3) return "Pass - Needs Improvement";
  if (value >= 2) return "Fail - Rework Required";
  return "Critical Fail";
}

export default function InstallationSurveyPage({ headers }) {
  const [questions, setQuestions] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loadingContractors, setLoadingContractors] = useState(false);
  const [scoresByQuestion, setScoresByQuestion] = useState({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

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

  useEffect(() => {
    const loadQuestions = async () => {
      setLoadingQuestions(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/installation/questions`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed to load questions");
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingQuestions(false);
      }
    };
    loadQuestions();
    loadContractors();
  }, [headers]);

  const answeredCount = useMemo(() => {
    return questions.filter((q) => Number(scoresByQuestion[q.question_number]) >= 1).length;
  }, [questions, scoresByQuestion]);

  const averageScore = useMemo(() => {
    if (!questions.length) return null;
    const values = questions
      .map((q) => Number(scoresByQuestion[q.question_number]))
      .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
    if (!values.length) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }, [questions, scoresByQuestion]);

  const canSubmit = useMemo(() => {
    const cleanedFieldTeamMembers = (formData.field_team_members || []).map((member) => member.trim()).filter(Boolean);
    const workerSpecificValid =
      formData.job_done_by === "Contractor"
        ? Boolean(formData.contractor_name.trim())
        : cleanedFieldTeamMembers.length > 0 && cleanedFieldTeamMembers.length <= 5;

    const requiredMeta =
      formData.inspector_name.trim() &&
      formData.work_order.trim() &&
      formData.customer_name.trim() &&
      formData.location.trim() &&
      formData.date_work_done &&
      CUSTOMER_TYPES.includes(formData.customer_type) &&
      WORKER_TYPES.includes(formData.job_done_by) &&
      workerSpecificValid;
    return Boolean(requiredMeta && questions.length > 0 && answeredCount === questions.length && !submitting);
  }, [answeredCount, formData, questions.length, submitting]);

  const updateForm = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const setQuestionScore = (questionNumber, scoreValue) => {
    setScoresByQuestion((prev) => ({ ...prev, [questionNumber]: scoreValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const responses = questions.map((q) => ({
      question_number: q.question_number,
      score: Number(scoresByQuestion[q.question_number]),
    }));

    setSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/installation/surveys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          inspector_name: formData.inspector_name.trim(),
          work_order: formData.work_order.trim(),
          customer_name: formData.customer_name.trim(),
          customer_type: formData.customer_type,
          location: formData.location.trim(),
          date_work_done: formData.date_work_done,
          job_done_by: formData.job_done_by,
          contractor_name: formData.job_done_by === "Contractor" ? formData.contractor_name.trim() : null,
          field_team_members:
            formData.job_done_by === "Field Team"
              ? (formData.field_team_members || []).map((member) => member.trim()).filter(Boolean).slice(0, 5)
              : [],
          responses,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to submit survey");

      setSuccess({
        survey_id: data.survey_id,
        overall_score: Number(data.overall_score),
      });

      setScoresByQuestion({});
      setFormData((prev) => ({
        ...prev,
        work_order: "",
        customer_name: "",
        location: "",
        date_work_done: "",
        contractor_name: "",
        field_team_members: [""],
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Installation Assessment</h1>
        <p className="text-muted-foreground mt-2">Complete the quality assessment checklist and submit.</p>
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
                {success && (
                  <div className="rounded-md border border-success/50 bg-success/10 p-3 text-sm text-success">
                    <div>Survey submitted. Reference: <strong>{success.survey_id}</strong></div>
                    <div>Overall score: <strong>{success.overall_score.toFixed(2)}</strong> ({scoreBandLabel(success.overall_score)})</div>
                  </div>
                )}

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
                              onChange={(event) =>
                                setFormData((prev) => {
                                  const nextMembers = [...(prev.field_team_members || [])];
                                  nextMembers[index] = event.target.value;
                                  return { ...prev, field_team_members: nextMembers.slice(0, 5) };
                                })
                              }
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
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Question Scores</CardTitle>
                <CardDescription>{answeredCount}/{questions.length || 0} answered</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingQuestions ? (
                  <div className="space-y-4">
                    {[1,2,3,4,5,6,7].map((n) => (
                      <Skeleton key={n} className="h-24 w-full" />
                    ))}
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
                      <div className="flex flex-wrap gap-3">
                        {[1,2,3,4,5].map((score) => (
                          <Button
                            key={score}
                            type="button"
                            variant={Number(scoresByQuestion[question.question_number]) === score ? "default" : "outline"}
                            size="sm"
                            onClick={() => setQuestionScore(question.question_number, score)}
                          >
                            {score}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
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
                  <p className="font-medium">3 to 4 - Pass (Needs Improvement)</p>
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
                <CardTitle>Overall Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">{averageScore ? averageScore.toFixed(2) : "--"}</div>
                <p className="text-xs text-muted-foreground">Scale: 1 (Critical Fail) to 5 (Pass - Excellent)</p>
                <div className="pt-4">
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
