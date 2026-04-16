import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

function formatPeriod(period) {
  return period ? period.slice(0, 7) : "--";
}

function groupTrendSeries(rows, keyField, valueField = "average_score") {
  const byPeriod = {};
  rows.forEach((row) => {
    const period = formatPeriod(row.period);
    if (!byPeriod[period]) byPeriod[period] = { period };
    byPeriod[period][row[keyField]] = Number(row[valueField] || 0);
  });
  return Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period));
}

export default function InstallationTrendsView({ trends, loading }) {
  const overallTrend = useMemo(
    () => (trends?.overall_trend || []).map((item) => ({ period: formatPeriod(item.period), average: Number(item.average_score || 0) })),
    [trends],
  );

  const customerTrend = useMemo(() => groupTrendSeries(trends?.customer_type_trends || [], "customer_type"), [trends]);
  const workerTrend = useMemo(() => groupTrendSeries(trends?.worker_type_trends || [], "worker_type"), [trends]);
  const questionTrend = useMemo(() => {
    const rows = trends?.question_trends || [];
    return groupTrendSeries(rows.map((row) => ({ ...row, question_key: `Q${row.question_number}` })), "question_key");
  }, [trends]);
  const questionKeys = useMemo(() => {
    const keys = new Set((trends?.question_trends || []).map((row) => `Q${row.question_number}`));
    return Array.from(keys).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  }, [trends]);

  return (
    <div className="space-y-6">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Overall Score Trend</CardTitle>
          <CardDescription>Average installation assessment score over time, grouped by month.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 h-[360px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
            <LineChart data={overallTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Line type="monotone" dataKey="average" stroke="#0ea5e9" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Customer Type Trends</CardTitle>
            <CardDescription>Monthly average score trend for B2B and B2C installation surveys.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 h-[360px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <LineChart data={customerTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="B2B" stroke="#2563eb" strokeWidth={2.5} />
                <Line type="monotone" dataKey="B2C" stroke="#7c3aed" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Worker Type Trends</CardTitle>
            <CardDescription>Monthly average score trend for Field Team and Contractor work.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 h-[360px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <LineChart data={workerTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Field Team" stroke="#059669" strokeWidth={2.5} />
                <Line type="monotone" dataKey="Contractor" stroke="#f97316" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Question Trends</CardTitle>
          <CardDescription>Monthly average score trend for each installation assessment question.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 h-[420px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
            <LineChart data={questionTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              {questionKeys.map((key, index) => (
                <Line key={key} type="monotone" dataKey={key} strokeWidth={2} stroke={`hsl(${(index * 47) % 360} 70% 50%)`} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
