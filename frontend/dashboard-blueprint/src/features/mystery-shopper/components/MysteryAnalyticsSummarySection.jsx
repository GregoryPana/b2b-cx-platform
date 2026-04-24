import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

export default function MysteryAnalyticsSummarySection({ mysteryAnalyticsSummary, analytics }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Overall Experience</CardTitle>
          <CardDescription>Weighted average from overall-experience scoring questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-4xl font-semibold">{mysteryAnalyticsSummary.overallExperienceAvg?.toFixed?.(2) ?? "--"}</div>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded bg-muted p-3">
              <p className="text-muted-foreground">Service Quality Avg</p>
              <p className="font-medium">{mysteryAnalyticsSummary.qualityAvg?.toFixed?.(2) ?? "--"}</p>
            </div>
            <div className="rounded bg-muted p-3">
              <p className="text-muted-foreground">NPS Score</p>
              <p className="font-medium">{analytics?.nps?.nps ?? "--"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Operational Efficiency</CardTitle>
          <CardDescription>CSAT, waiting time, and service completion distribution by selected location scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded bg-muted p-3">
              <p className="text-muted-foreground">CSAT Average</p>
              <p className="font-medium">{analytics?.mystery_shopper?.csat_average?.toFixed?.(2) ?? "--"}</p>
            </div>
            <div className="rounded bg-muted p-3">
              <p className="text-muted-foreground">CSAT Responses</p>
              <p className="font-medium">{analytics?.mystery_shopper?.csat_response_count ?? 0}</p>
            </div>
          </div>
          <div className="rounded bg-muted p-3">
            <p className="text-muted-foreground">Waiting Time</p>
            <p>{(analytics?.mystery_shopper?.waiting_time_distribution || []).map((item) => `${item.label}: ${item.count}`).join(" | ") || "No data"}</p>
          </div>
          <div className="rounded bg-muted p-3">
            <p className="text-muted-foreground">Service Completion</p>
            <p>{(analytics?.mystery_shopper?.service_completion_distribution || []).map((item) => `${item.label}: ${item.count}`).join(" | ") || "No data"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
