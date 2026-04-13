import { CircleHelp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

function Hint({ text }) {
  return (
    <details className="group relative inline-flex">
      <summary className="list-none cursor-pointer rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground">
        <CircleHelp className="h-4 w-4" />
      </summary>
      <div className="pointer-events-none absolute left-0 top-6 z-30 w-72 rounded-md border bg-popover p-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-open:opacity-100">
        {text}
      </div>
    </details>
  );
}

function findAverage(items, key, target) {
  const match = (Array.isArray(items) ? items : []).find((item) => item[key] === target);
  return match?.average_score ?? null;
}

export default function InstallationAnalyticsView({ analytics, loading, onRefresh }) {
  const customerChartData = (analytics?.customer_type_averages || []).map((item) => ({
    label: item.customer_type,
    average: Number(item.average_score || 0),
    count: Number(item.survey_count || 0),
  }));

  const workerChartData = (analytics?.worker_type_averages || []).map((item) => ({
    label: item.worker_type,
    average: Number(item.average_score || 0),
    count: Number(item.survey_count || 0),
  }));

   const questionChartData = (analytics?.question_averages || []).map((item) => ({
     label: `Q${item.question_number}`,
     average: Number(item.average_score || 0),
     question_text: item.question_text,
   }));

   const categoryChartData = (analytics?.category_averages || []).map((item) => ({
     label: item.category,
     average: Number(item.average_score || 0),
     response_count: Number(item.response_count || 0),
   }));

  const trendData = (analytics?.monthly_trend || []).map((item) => ({
    period: item.period ? item.period.slice(0, 7) : "--",
    average: Number(item.average_score || 0),
    count: Number(item.survey_count || 0),
  }));

  const overallAverage = analytics?.summary?.overall_average_score;
  const avgB2B = findAverage(analytics?.customer_type_averages, "customer_type", "B2B");
  const avgB2C = findAverage(analytics?.customer_type_averages, "customer_type", "B2C");
  const avgFieldTeam = findAverage(analytics?.worker_type_averages, "worker_type", "Field Team");
  const avgContractor = findAverage(analytics?.worker_type_averages, "worker_type", "Contractor");

  const cards = [
    { title: "Total Surveys", value: analytics?.summary?.total_surveys ?? 0 },
    { title: "Overall Average", value: overallAverage != null ? Number(overallAverage).toFixed(2) : "--" },
    { title: "B2B Average", value: avgB2B != null ? Number(avgB2B).toFixed(2) : "--" },
    { title: "B2C Average", value: avgB2C != null ? Number(avgB2C).toFixed(2) : "--" },
    { title: "Field Team Average", value: avgFieldTeam != null ? Number(avgFieldTeam).toFixed(2) : "--" },
    { title: "Contractor Average", value: avgContractor != null ? Number(avgContractor).toFixed(2) : "--" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">Installation Analytics</CardTitle>
          <CardDescription>Average score is calculated as SUM(question scores) / 7 for each completed installation survey.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Average by Customer Type
              <Hint text="Compares survey quality averages for B2B vs B2C customers." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <BarChart data={customerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value) => [Number(value).toFixed(2), "Average Score"]} />
                <Bar dataKey="average" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Average by Worker Type
              <Hint text="Compares installation quality between Field Team and Contractor work." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <BarChart data={workerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value) => [Number(value).toFixed(2), "Average Score"]} />
                <Bar dataKey="average" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Average by Question
              <Hint text="Shows which technical checkpoints are strongest or weakest across all submitted installation surveys." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {questionChartData.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                <BarChart data={questionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip
                    formatter={(value, _label, context) => [Number(value).toFixed(2), "Average Score"]}
                    labelFormatter={(label, payload) => {
                      const questionText = payload?.[0]?.payload?.question_text;
                      return questionText ? `${label}: ${questionText}` : label;
                    }}
                  />
                  <Bar dataKey="average" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No question-level data yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Average by Category
              <Hint text="Shows average scores for each of the 4 inspection categories: Technical Performance, Physical Routing, Safety & Infrastructure, and Site Cleanliness." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {categoryChartData.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                <BarChart data={categoryChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 5]} />
                  <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [Number(value).toFixed(2), "Average Score"]} />
                  <Bar dataKey="average" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No category data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scoring Thresholds</CardTitle>
          <CardDescription>Used by auditors to determine pass/fail handling after calculating the overall average.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(analytics?.thresholds || []).map((item) => (
            <div key={item.range} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{item.range} - {item.label}</p>
              <p className="text-muted-foreground">{item.action}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
