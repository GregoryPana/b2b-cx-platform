import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import InstallationSurveysDataTable from "./InstallationSurveysDataTable";

function InstallationScoreBadge({ score }) {
  const n = Number(score);
  if (!Number.isFinite(n)) return <span className="text-sm text-muted-foreground">--</span>;
  let className = "inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold";
  if (n >= 4) className += " border-green-200 bg-green-50 text-green-800";
  else if (n >= 3) className += " border-amber-300 bg-amber-50 text-amber-800";
  else if (n >= 2) className += " border-red-200 bg-red-100 text-red-800";
  else className += " border-red-400 bg-red-200 text-red-900";
  const label = n >= 4 ? "Excellent" : n >= 3 ? "Satisfactory" : n >= 2 ? "Rework" : "Critical";
  return <span className={className}>{n} / 5 — {label}</span>;
}

export default function InstallationSurveyExplorer({
  filters,
  onFilterChange,
  surveys,
  loading,
  onSearch,
  onReset,
  onView,
  selectedSurvey,
  onCloseDetails,
}) {
  const categoryGroups = selectedSurvey
    ? (selectedSurvey.responses || []).reduce((acc, resp) => {
        const cat = resp.category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(resp);
        return acc;
      }, {})
    : {};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">Installation Survey Explorer</CardTitle>
          <CardDescription>Review submitted installation surveys with built-in table sorting, filtering, and pagination, including work order search.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onSearch}>{loading ? "Searching..." : "Search"}</Button>
            <Button type="button" variant="ghost" onClick={onReset}>Clear Filters</Button>
            <span className="text-sm text-muted-foreground">{loading ? "Loading..." : `${surveys.length} surveys`}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Survey Table</CardTitle>
          <CardDescription>Overall assessment = average of all 7 question scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstallationSurveysDataTable data={surveys} loading={loading} onView={onView} />
        </CardContent>
      </Card>

      {selectedSurvey ? (
        <Card>
          <CardHeader>
            <CardTitle>Survey Detail</CardTitle>
            <CardDescription>
              {selectedSurvey.customer_name || "--"} | {selectedSurvey.date_work_done || "--"} | Overall Score: {selectedSurvey.overall_score != null ? Number(selectedSurvey.overall_score).toFixed(2) : "--"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Quality Assurance Inspector</p><p className="font-medium">{selectedSurvey.inspector_name || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Work Order</p><p className="font-medium">{selectedSurvey.work_order || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Customer Name</p><p className="font-medium">{selectedSurvey.customer_name || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{selectedSurvey.location || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Customer Type</p><p className="font-medium">{selectedSurvey.customer_type || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Worker Type</p><p className="font-medium">{selectedSurvey.job_done_by || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Contractor Name</p><p className="font-medium">{selectedSurvey.contractor_name || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Field Team Members</p><p className="font-medium">{Array.isArray(selectedSurvey.field_team_members) && selectedSurvey.field_team_members.length ? selectedSurvey.field_team_members.join(", ") : "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Date Work Done</p><p className="font-medium">{selectedSurvey.date_work_done || "--"}</p></div>
            </div>

            {Object.keys(categoryGroups).length > 0 ? (
              Object.entries(categoryGroups).map(([category, responses]) => (
                <div key={category} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold tracking-tight">{category}</p>
                    <Badge variant="secondary">{responses.length} questions</Badge>
                  </div>
                  {responses.map((resp) => (
                    <div key={resp.question_number} className="rounded-md border bg-background p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Q{resp.question_number}</p>
                      <p className="text-sm font-semibold leading-snug">{resp.question_text || "--"}</p>
                      <div className="flex items-start gap-3 rounded bg-muted/30 px-3 py-2">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-0.5">Score</span>
                        <div className="min-w-0"><InstallationScoreBadge score={resp.score} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No responses found for this survey.</p>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Action Points / Recommendations</h4>
              {Array.isArray(selectedSurvey.action_points) && selectedSurvey.action_points.length ? (
                <ul className="list-disc pl-5 text-sm">
                  {selectedSurvey.action_points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No action points recorded.</p>
              )}
            </div>

            <Button type="button" variant="outline" onClick={onCloseDetails}>Close Details</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
