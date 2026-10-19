import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const SCORE_MAX = 5;
const SERIES_COLORS = ["#2563eb", "#7c3aed", "#059669", "#f97316", "#dc2626", "#0891b2"];

function formatPeriod(period) {
  return period ? period.slice(0, 7) : "Unknown month";
}

function groupTrendSeries(rows, keyField, valueField = "average_score") {
  const byPeriod = {};
  rows.forEach((row) => {
    if (row[valueField] == null) return;
    const period = formatPeriod(row.period);
    if (!byPeriod[period]) byPeriod[period] = { period };
    byPeriod[period][row[keyField]] = Number(row[valueField]);
  });
  return Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period));
}

function EmptyTrend({ children }) {
  return <div className="flex h-full items-center justify-center rounded-md border bg-muted/20 p-5 text-center text-sm text-muted-foreground">{children}</div>;
}

function ScoreTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>{entry.name || entry.dataKey}: {Number(entry.value).toFixed(2)} / {SCORE_MAX}</p>
      ))}
      {payload[0]?.payload?.count != null ? <p className="mt-1 text-muted-foreground">{payload[0].payload.count} submitted assessments</p> : null}
    </div>
  );
}

function TrendChart({ data, children, emptyText, heightClass = "h-[360px]" }) {
  return (
    <CardContent className={`min-w-0 ${heightClass}`}>
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis domain={[0, SCORE_MAX]} />
            <Tooltip content={<ScoreTooltip />} />
            {children}
          </LineChart>
        </ResponsiveContainer>
      ) : <EmptyTrend>{emptyText}</EmptyTrend>}
    </CardContent>
  );
}

export default function InstallationTrendsView({ trends, loading }) {
  const overallTrend = useMemo(
    () => (trends?.overall_trend || [])
      .filter((item) => item.average_score != null)
      .map((item) => ({ period: formatPeriod(item.period), average: Number(item.average_score), count: Number(item.survey_count || 0) })),
    [trends],
  );

  const customerRows = trends?.customer_type_trends || [];
  const workerRows = trends?.worker_type_trends || [];
  const questionRows = trends?.question_trends || [];
  const customerTrend = useMemo(() => groupTrendSeries(customerRows, "customer_type"), [customerRows]);
  const workerTrend = useMemo(() => groupTrendSeries(workerRows, "worker_type"), [workerRows]);
  const questionTrend = useMemo(
    () => groupTrendSeries(questionRows.map((row) => ({ ...row, question_key: `Q${row.question_number}` })), "question_key"),
    [questionRows],
  );
  const questionKeys = useMemo(() => {
    const keys = new Set(questionRows.filter((row) => row.average_score != null).map((row) => `Q${row.question_number}`));
    return Array.from(keys).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  }, [questionRows]);

  const hasAnyTrend = overallTrend.length || customerTrend.length || workerTrend.length || questionTrend.length;

  if (loading && !trends) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground" role="status">Loading installation trends...</CardContent></Card>;
  }

  if (!loading && trends && !hasAnyTrend) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No installation trend data</CardTitle>
          <CardDescription>No submitted assessments with scores match the selected month, customer type and worker type. Empty charts are not plotted as zero.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6" aria-busy={loading}>
      {loading ? <p className="text-sm text-muted-foreground" role="status">Refreshing installation trends...</p> : null}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Track the overall installation score by month</CardTitle>
          <CardDescription>Each point is the mean overall score, out of 5, for submitted assessments in that month. Missing months are not zero.</CardDescription>
        </CardHeader>
        <TrendChart data={overallTrend} emptyText="No monthly overall scores match the current filters.">
          <Line type="monotone" dataKey="average" name="Overall mean score" stroke="#0ea5e9" strokeWidth={2.5} connectNulls={false} />
        </TrendChart>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Compare B2B and B2C scores by month</CardTitle>
            <CardDescription>Monthly mean overall installation score, out of 5, for each customer type with submitted assessments.</CardDescription>
          </CardHeader>
          <TrendChart data={customerTrend} emptyText="No customer-type trend scores match the current filters.">
            <Legend />
            <Line type="monotone" dataKey="B2B" name="B2B mean score" stroke="#2563eb" strokeWidth={2.5} connectNulls={false} />
            <Line type="monotone" dataKey="B2C" name="B2C mean score" stroke="#7c3aed" strokeWidth={2.5} connectNulls={false} />
          </TrendChart>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Compare Field Team and Contractor scores by month</CardTitle>
            <CardDescription>Monthly mean overall installation score, out of 5, for each worker type with submitted assessments.</CardDescription>
          </CardHeader>
          <TrendChart data={workerTrend} emptyText="No worker-type trend scores match the current filters.">
            <Legend />
            <Line type="monotone" dataKey="Field Team" name="Field Team mean score" stroke="#059669" strokeWidth={2.5} connectNulls={false} />
            <Line type="monotone" dataKey="Contractor" name="Contractor mean score" stroke="#f97316" strokeWidth={2.5} connectNulls={false} />
          </TrendChart>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Track each installation question by month</CardTitle>
          <CardDescription>Each line is the monthly mean from scored responses to one question, out of 5. Missing responses are not plotted as zero.</CardDescription>
        </CardHeader>
        <TrendChart data={questionTrend} emptyText="No question-level trend scores match the current filters." heightClass="h-[420px]">
          <Legend />
          {questionKeys.map((key, index) => (
            <Line key={key} type="monotone" dataKey={key} name={`${key} mean score`} strokeWidth={2} stroke={SERIES_COLORS[index % SERIES_COLORS.length]} dot={false} connectNulls={false} />
          ))}
        </TrendChart>
      </Card>
    </div>
  );
}
