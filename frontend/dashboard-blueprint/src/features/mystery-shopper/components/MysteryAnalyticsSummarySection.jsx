import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

const CATEGORY_COLORS = {
  "External Environment & First Impression": "#3b82f6",
  "Store Environment & Comfort": "#10b981",
  "Staff Appearance & Professionalism": "#f59e0b",
  "Customer Service Interaction": "#8b5cf6",
  "Time & Efficiency": "#ef4444",
  "Overall Experience (CSAT & NPS)": "#ec4899",
};

const DEFAULT_BAR_COLOR = "#6b7280";

const CATEGORY_ORDER = [
  "External Environment & First Impression",
  "Store Environment & Comfort",
  "Staff Appearance & Professionalism",
  "Customer Service Interaction",
  "Time & Efficiency",
  "Overall Experience (CSAT & NPS)",
];

function toPercent(score, max) {
  if (score == null || !max) return 0;
  return Math.round((Number(score) / Number(max)) * 100);
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};
  return (
    <div className="max-w-[220px] rounded border bg-background p-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{item.question_text}</p>
      <p className="text-muted-foreground">{item.category}</p>
      <p className="mt-1 text-foreground">
        {Number(item.average_score)?.toFixed(1)} / {item.score_max} ({toPercent(item.average_score, item.score_max)}%)
      </p>
    </div>
  );
}

function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};
  return (
    <div className="max-w-[200px] rounded border bg-background p-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{item.category}</p>
      <p className="mt-1 text-foreground">
        Avg {Number(item.avg_score)?.toFixed(2)} / {item.score_max} ({item.pct}%)
      </p>
      <p className="text-muted-foreground">{item.response_count} responses</p>
    </div>
  );
}

function LocationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};
  return (
    <div className="rounded border bg-background p-2 text-xs shadow-md">
      <p className="font-medium">{item.location_name}</p>
      <p className="text-muted-foreground">{item.visits} visit{item.visits !== 1 ? "s" : ""}</p>
      <p>CSAT: {item.csat_average?.toFixed?.(2) ?? "--"} / 10</p>
    </div>
  );
}

function StaffTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};
  return (
    <div className="rounded border bg-background p-2 text-xs shadow-md">
      <p className="font-medium">{item.staff_name}</p>
      <p className="text-muted-foreground">{item.visits} visit{item.visits !== 1 ? "s" : ""}</p>
      <p>CSAT: {item.csat_average?.toFixed?.(2) ?? "--"} / 10</p>
    </div>
  );
}

function YesNoTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};
  return (
    <div className="max-w-[220px] rounded border bg-background p-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{item.question_text}</p>
      <p className="mt-1 text-foreground">Yes: {item.yes_count} ({item.yes_percent}%)</p>
      <p className="text-foreground">No: {item.no_count} ({item.no_percent}%)</p>
      <p className="text-muted-foreground">{item.total_count} responses</p>
    </div>
  );
}

export default function MysteryAnalyticsSummarySection({ mysteryAnalyticsSummary, analytics, questionAverages = [], yesNoAnalytics = [] }) {
  const ms = analytics?.mystery_shopper || {};

  const visitTrend = useMemo(
    () =>
      (ms.visit_trend || []).map((row) => ({
        ...row,
        date_label: formatDate(row.visit_date),
      })),
    [ms.visit_trend],
  );

  const waitingData = ms.waiting_time_distribution || [];
  const serviceData = ms.service_completion_distribution || [];
  const locationData = ms.location_breakdown || [];
  const purposeData = ms.purpose_distribution || [];
  const staffData = ms.staff_breakdown || [];

  // Per-question scored bars
  const scoredQuestions = useMemo(
    () =>
      questionAverages
        .filter((q) => q.average_score != null && q.score_max != null)
        .sort((a, b) => Number(a.question_number || 0) - Number(b.question_number || 0))
        .map((q) => {
          const rawNum = Number(q.question_number);
          const displayNum = rawNum > 1000 ? rawNum - 2000 : rawNum;
          return {
            ...q,
            label: `Q${displayNum}`,
            pct: toPercent(q.average_score, q.score_max),
            color: CATEGORY_COLORS[q.category] || DEFAULT_BAR_COLOR,
          };
        }),
    [questionAverages],
  );

  // Category-level rollup (weighted average of scored questions per category)
  const categoryRollup = useMemo(() => {
    const map = {};
    for (const q of questionAverages) {
      if (q.average_score == null || q.score_max == null) continue;
      const cat = q.category || "Uncategorized";
      if (!map[cat]) map[cat] = { scoreSum: 0, countSum: 0, score_max: Number(q.score_max) };
      const count = Number(q.response_count || 1);
      map[cat].scoreSum += Number(q.average_score) * count;
      map[cat].countSum += count;
      // use max score_max seen in category (categories are consistent)
      if (Number(q.score_max) > map[cat].score_max) map[cat].score_max = Number(q.score_max);
    }
    return CATEGORY_ORDER
      .filter((cat) => map[cat])
      .map((cat) => {
        const { scoreSum, countSum, score_max } = map[cat];
        const avg_score = countSum ? scoreSum / countSum : 0;
        return {
          category: cat,
          short_label: cat.split(" ")[0] + (cat.includes("&") ? " & …" : ""),
          avg_score: Math.round(avg_score * 100) / 100,
          score_max,
          pct: toPercent(avg_score, score_max),
          response_count: countSum,
          color: CATEGORY_COLORS[cat] || DEFAULT_BAR_COLOR,
        };
      });
  }, [questionAverages]);

  // Yes/No items for mystery shopper
  const yesNoItems = useMemo(
    () =>
      yesNoAnalytics
        .filter((q) => q.total_count > 0)
        .sort((a, b) => Number(a.question_number || 0) - Number(b.question_number || 0))
        .map((q) => {
          const rawNum = Number(q.question_number);
          const displayNum = rawNum > 1000 ? rawNum - 2000 : rawNum;
          return { ...q, label: `Q${displayNum}` };
        }),
    [yesNoAnalytics],
  );

  const legendCategories = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const q of scoredQuestions) {
      if (!seen.has(q.category)) {
        seen.add(q.category);
        result.push({ category: q.category, color: q.color });
      }
    }
    return result;
  }, [scoredQuestions]);

  return (
    <div className="mt-6 space-y-6">
      {/* Row 1: Summary stats + visit trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overall Experience</CardTitle>
            <CardDescription>Weighted averages from scored questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-4xl font-semibold">
              {mysteryAnalyticsSummary.overallExperienceAvg?.toFixed?.(2) ?? "--"}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded bg-muted p-3">
                <p className="text-muted-foreground">Service Quality Avg</p>
                <p className="font-medium">{mysteryAnalyticsSummary.qualityAvg?.toFixed?.(2) ?? "--"}</p>
              </div>
              <div className="rounded bg-muted p-3">
                <p className="text-muted-foreground">NPS</p>
                <p className="font-medium">{analytics?.nps?.nps ?? "--"}</p>
              </div>
              <div className="rounded bg-muted p-3">
                <p className="text-muted-foreground">CSAT Average</p>
                <p className="font-medium">{ms.csat_average?.toFixed?.(2) ?? "--"}</p>
              </div>
              <div className="rounded bg-muted p-3">
                <p className="text-muted-foreground">CSAT Responses</p>
                <p className="font-medium">{ms.csat_response_count ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visit Trend</CardTitle>
            <CardDescription>Approved visits per day over the last 14 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {visitTrend.length ? (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={visitTrend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date_label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="visit_count"
                    name="Visits"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No visit trend data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Category rollup */}
      {categoryRollup.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score by Category</CardTitle>
            <CardDescription>Weighted average score per category as a percentage of maximum. Higher is better.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(categoryRollup.length * 48, 160)}>
              <BarChart layout="vertical" data={categoryRollup} margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={210} />
                <Tooltip content={<CategoryTooltip />} />
                <Bar dataKey="pct" name="Score %" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v) => `${v}%` }}>
                  {categoryRollup.map((c) => (
                    <Cell key={c.category} fill={c.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Yes/No pass rates */}
      {yesNoItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pass Rate — Yes/No Questions</CardTitle>
            <CardDescription>Percentage of "Yes" responses per binary question across approved visits.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(yesNoItems.length * 36, 160)}>
              <BarChart layout="vertical" data={yesNoItems} margin={{ top: 4, right: 50, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={36} />
                <Tooltip content={<YesNoTooltip />} />
                <Bar dataKey="yes_percent" name="Yes %" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v) => `${v}%` }}>
                  {yesNoItems.map((q) => (
                    <Cell
                      key={q.question_id}
                      fill={q.yes_percent >= 80 ? "#10b981" : q.yes_percent >= 50 ? "#f59e0b" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Row 4: Distribution charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waiting Time</CardTitle>
            <CardDescription>How long shoppers waited before being served.</CardDescription>
          </CardHeader>
          <CardContent>
            {waitingData.length ? (
              <ResponsiveContainer width="100%" height={Math.max(waitingData.length * 44, 140)}>
                <BarChart layout="vertical" data={waitingData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" name="Responses" fill="#10b981" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No data.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Completion</CardTitle>
            <CardDescription>Overall time taken to complete the shopper's service.</CardDescription>
          </CardHeader>
          <CardContent>
            {serviceData.length ? (
              <ResponsiveContainer width="100%" height={Math.max(serviceData.length * 44, 140)}>
                <BarChart layout="vertical" data={serviceData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" name="Responses" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Location CSAT + Purpose of visit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {locationData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Location Performance</CardTitle>
              <CardDescription>Average CSAT score per location for approved visits.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(locationData.length * 44, 140)}>
                <BarChart layout="vertical" data={locationData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="location_name" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip content={<LocationTooltip />} />
                  <Bar dataKey="csat_average" name="CSAT Avg" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {purposeData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Purpose of Visit</CardTitle>
              <CardDescription>Distribution of visit purposes across approved visits.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(purposeData.length * 44, 140)}>
                <BarChart layout="vertical" data={purposeData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="purpose" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip />
                  <Bar dataKey="count" name="Visits" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 6: Staff on duty KPI */}
      {staffData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff on Duty — KPI</CardTitle>
            <CardDescription>Average CSAT score per staff member across approved visits. Use this to identify coaching opportunities and high performers.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(staffData.length * 44, 140)}>
              <BarChart layout="vertical" data={staffData} margin={{ top: 4, right: 60, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="staff_name" tick={{ fontSize: 11 }} width={150} />
                <Tooltip content={<StaffTooltip />} />
                <Bar dataKey="csat_average" name="CSAT Avg" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, formatter: (v) => v != null ? v.toFixed(1) : "--" }}>
                  {staffData.map((row) => (
                    <Cell
                      key={row.staff_name}
                      fill={
                        row.csat_average == null ? "#6b7280"
                          : row.csat_average >= 7 ? "#10b981"
                          : row.csat_average >= 5 ? "#f59e0b"
                          : "#ef4444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Row 7: Per-question scores */}
      {scoredQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score by Question</CardTitle>
            <CardDescription>
              Average score as a percentage of the maximum. Colours indicate category group. Hover a bar for details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {legendCategories.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-3 text-xs">
                {legendCategories.map(({ category, color }) => (
                  <span key={category} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {category}
                  </span>
                ))}
              </div>
            )}
            <ResponsiveContainer width="100%" height={Math.max(scoredQuestions.length * 28, 200)}>
              <BarChart
                layout="vertical"
                data={scoredQuestions}
                margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={36} />
                <Tooltip content={<ScoreTooltip />} />
                <Bar dataKey="pct" name="Score %" radius={[0, 3, 3, 0]}>
                  {scoredQuestions.map((q) => (
                    <Cell key={q.question_id ?? q.label} fill={q.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
