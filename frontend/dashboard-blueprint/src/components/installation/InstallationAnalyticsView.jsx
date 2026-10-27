import { useId, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { cn, getTrafficLightMetric } from "../../lib/utils";

const SCORE_MAX = 5;

function Hint({ label, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setOpen(false); }}>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      >
        <CircleHelp className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? <span id={id} role="tooltip" className="absolute right-0 top-7 z-30 w-72 max-w-[calc(100vw-3rem)] rounded-md border bg-popover p-2 text-xs font-normal text-popover-foreground shadow-md">
        {children}
      </span> : null}
    </span>
  );
}

function findSegment(items, key, target) {
  return (Array.isArray(items) ? items : []).find((item) => item[key] === target) || null;
}

function scoreText(value) {
  return value != null && Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} / ${SCORE_MAX}` : "No score";
}

function EmptyChart({ children }) {
  return <div className="flex h-full items-center justify-center rounded-md border bg-muted/20 p-4 text-center text-sm text-muted-foreground">{children}</div>;
}

function ScoreTooltip({ active, payload, label, countKey = "count", countLabel = "submitted assessments" }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{label}</p>
      <p>{Number(row.average).toFixed(2)} / {SCORE_MAX} average</p>
      {row[countKey] != null ? <p className="text-muted-foreground">{row[countKey]} {countLabel}</p> : null}
    </div>
  );
}

export default function InstallationAnalyticsView({ analytics, loading, onRefresh }) {
  const summary = analytics?.summary;
  const totalSurveys = Number(summary?.total_surveys || 0);
  const hasSubmittedAssessments = totalSurveys > 0;

  const customerChartData = (analytics?.customer_type_averages || [])
    .filter((item) => item.average_score != null && Number(item.survey_count || 0) > 0)
    .map((item) => ({ label: item.customer_type, average: Number(item.average_score), count: Number(item.survey_count) }));

  const workerChartData = (analytics?.worker_type_averages || [])
    .filter((item) => item.average_score != null && Number(item.survey_count || 0) > 0)
    .map((item) => ({ label: item.worker_type, average: Number(item.average_score), count: Number(item.survey_count) }));

  const questionChartData = (analytics?.question_averages || [])
    .filter((item) => item.average_score != null && Number(item.response_count || 0) > 0)
    .map((item) => ({
      label: `Q${item.question_number}`,
      average: Number(item.average_score),
      question_text: item.question_text,
      response_count: Number(item.response_count),
    }));

  const categoryChartData = (analytics?.category_averages || [])
    .filter((item) => item.average_score != null && Number(item.response_count || 0) > 0)
    .map((item) => ({ label: item.category, average: Number(item.average_score), response_count: Number(item.response_count) }));

  const contractorBreakdownData = (analytics?.contractor_breakdown || [])
    .filter((item) => item.average_score != null && Number(item.survey_count || 0) > 0)
    .map((item) => ({ contractor_name: item.contractor_name, average: Number(item.average_score), count: Number(item.survey_count) }));

  const customerB2B = findSegment(analytics?.customer_type_averages, "customer_type", "B2B");
  const customerB2C = findSegment(analytics?.customer_type_averages, "customer_type", "B2C");
  const fieldTeam = findSegment(analytics?.worker_type_averages, "worker_type", "Field Team");
  const contractor = findSegment(analytics?.worker_type_averages, "worker_type", "Contractor");

  const cards = [
    { title: "Submitted assessments", value: analytics ? totalSurveys : null, description: "Installation surveys in the current result set" },
    { title: "Overall installation score", value: summary?.overall_average_score, description: `${totalSurveys} submitted assessment${totalSurveys === 1 ? "" : "s"}`, metric: "installation_average" },
    { title: "B2B installation score", value: customerB2B?.average_score, description: `${Number(customerB2B?.survey_count || 0)} submitted assessment${Number(customerB2B?.survey_count || 0) === 1 ? "" : "s"}`, metric: "installation_average" },
    { title: "B2C installation score", value: customerB2C?.average_score, description: `${Number(customerB2C?.survey_count || 0)} submitted assessment${Number(customerB2C?.survey_count || 0) === 1 ? "" : "s"}`, metric: "installation_average" },
    { title: "Field Team installation score", value: fieldTeam?.average_score, description: `${Number(fieldTeam?.survey_count || 0)} submitted assessment${Number(fieldTeam?.survey_count || 0) === 1 ? "" : "s"}`, metric: "installation_average" },
    { title: "Contractor installation score", value: contractor?.average_score, description: `${Number(contractor?.survey_count || 0)} submitted assessment${Number(contractor?.survey_count || 0) === 1 ? "" : "s"}`, metric: "installation_average" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">Review installation quality results</CardTitle>
          <CardDescription>Scores are means on the Installation Assessment scale from 1 to 5. Counts show submitted assessments or scored question responses, as labelled.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing installation results..." : "Refresh installation results"}
          </Button>
        </CardContent>
      </Card>

      {loading && !analytics ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground" role="status">Loading installation analytics...</CardContent></Card>
      ) : null}

      {!loading && analytics && !hasSubmittedAssessments ? (
        <Card>
          <CardHeader>
            <CardTitle>No submitted installation assessments</CardTitle>
            <CardDescription>There are no installation scores to average yet. A score of 0 is not being reported.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {analytics ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const hasScore = card.value != null && Number.isFinite(Number(card.value));
            const grade = getTrafficLightMetric(card.metric, hasScore ? Number(card.value) : null);
            const displayValue = card.metric ? scoreText(card.value) : card.value ?? "Not loaded";
            return (
              <Card key={card.title} className={cn(card.metric && hasScore ? grade.card : "")}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardDescription>{card.title}</CardDescription>
                    {card.metric && hasScore ? <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", grade.badge)}>{grade.label}</span> : null}
                  </div>
                  <CardTitle className={cn("text-3xl", card.metric && hasScore ? grade.value : "")}>{displayValue}</CardTitle>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      ) : null}

      {analytics ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Compare scores by customer type
                  <Hint label="Help for customer type scores">Each bar is the mean overall installation score, out of 5, for submitted B2B or B2C assessments. The tooltip includes the number of assessments.</Hint>
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 h-72">
                {customerChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                    <BarChart data={customerChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, SCORE_MAX]} />
                      <Tooltip content={<ScoreTooltip />} />
                      <Bar dataKey="average" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>No customer-type scores are available for the current result set.</EmptyChart>}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Compare scores by worker type
                  <Hint label="Help for worker type scores">Each bar is the mean overall installation score, out of 5, for submitted Field Team or Contractor assessments. The tooltip includes the number of assessments.</Hint>
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 h-72">
                {workerChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                    <BarChart data={workerChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, SCORE_MAX]} />
                      <Tooltip content={<ScoreTooltip />} />
                      <Bar dataKey="average" fill="#0f766e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>No worker-type scores are available for the current result set.</EmptyChart>}
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Compare contractor installation scores
                <Hint label="Help for contractor scores">Each score is the mean overall installation score, out of 5, for assessments attributed to that contractor.</Hint>
              </CardTitle>
              <CardDescription>Only contractors with at least one submitted assessment appear.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contractorBreakdownData.length ? (
                <>
                  <div className="min-w-0 h-72">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <BarChart data={contractorBreakdownData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, SCORE_MAX]} />
                        <YAxis type="category" dataKey="contractor_name" width={220} tick={{ fontSize: 12 }} />
                        <Tooltip content={<ScoreTooltip />} />
                        <Bar dataKey="average" fill="#f97316" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/40"><th className="px-3 py-2 text-left font-medium">Contractor</th><th className="px-3 py-2 text-right font-medium">Mean score</th><th className="px-3 py-2 text-right font-medium">Submitted assessments</th></tr></thead>
                      <tbody>{contractorBreakdownData.map((row) => <tr key={row.contractor_name} className="border-b last:border-b-0"><td className="px-3 py-2">{row.contractor_name}</td><td className="px-3 py-2 text-right">{row.average.toFixed(2)} / {SCORE_MAX}</td><td className="px-3 py-2 text-right">{row.count}</td></tr>)}</tbody>
                    </table>
                  </div>
                </>
              ) : <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">No contractor assessments are available for the current result set.</div>}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Find high and low scoring questions
                  <Hint label="Help for question scores">Each bar is the mean score, out of 5, from saved responses to that question. Hover, tap or focus the help icon for this explanation; use the chart tooltip for the response count.</Hint>
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 h-72">
                {questionChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                    <BarChart data={questionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, SCORE_MAX]} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload;
                        return <div className="max-w-xs rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"><p className="font-medium">{label}: {row.question_text}</p><p>{row.average.toFixed(2)} / {SCORE_MAX} average</p><p className="text-muted-foreground">{row.response_count} scored responses</p></div>;
                      }} />
                      <Bar dataKey="average" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>No scored question responses are available for the current result set.</EmptyChart>}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Compare inspection categories
                  <Hint label="Help for category scores">Each bar is the mean of saved question scores in that category, out of 5. The tooltip counts scored responses, not surveys.</Hint>
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 h-72">
                {categoryChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                    <BarChart data={categoryChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, SCORE_MAX]} />
                      <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
                      <Tooltip content={<ScoreTooltip countKey="response_count" countLabel="scored responses" />} />
                      <Bar dataKey="average" fill="#10b981" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart>No category scores are available for the current result set.</EmptyChart>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Interpret the overall installation score</CardTitle>
              <CardDescription>These handling bands apply to the mean score for a submitted Installation Assessment on the 1-to-5 scale.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(analytics?.thresholds || []).length ? analytics.thresholds.map((item) => (
                <div key={item.range} className="rounded-md border bg-muted/30 px-3 py-2 text-sm"><p className="font-medium">{item.range} / {SCORE_MAX}: {item.label}</p><p className="text-muted-foreground">{item.action}</p></div>
              )) : <p className="text-sm text-muted-foreground">No score handling bands were returned.</p>}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
