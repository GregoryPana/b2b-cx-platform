import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { cn, getTrafficLightMetric } from "../../../lib/utils";

export default function MysteryReportsSection({
  reportTypeOptions,
  reportType,
  setReportType,
  reportBusinessId,
  setReportBusinessId,
  mysteryLocations,
  reportVisitId,
  setReportVisitId,
  reportEligibleSurveys,
  reportDateFrom,
  setReportDateFrom,
  reportDateTo,
  setReportDateTo,
  reportSurveyLoading,
  reportIneligibleSurveys,
  reportEmailTo,
  setReportEmailTo,
  handlePreviewReport,
  handleDownloadReport,
  handleEmailReport,
  reportLoading,
  reportSending,
  reportPreview,
  reportPreviewHtml,
  mysteryReportMetricCards,
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">Survey Reports</CardTitle>
          <CardDescription>Create Mystery Shopper reports by date or location, then preview, download, or email them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-5 space-y-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-base font-semibold tracking-tight">Export and Share Report</p>
                <p className="text-sm text-muted-foreground">Choose a report type below. Each type has its own set of filters and options.</p>
              </div>
            </div>

            <section className="rounded-lg border bg-card p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold tracking-tight">1) Select Report Type</p>
                <p className="text-xs text-muted-foreground">Pick the report format that matches your reporting objective.</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
                {reportTypeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setReportType(option.key)}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      reportType === option.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                {reportTypeOptions.map((option) => (
                  <Card key={option.key} className="h-full min-w-0 overflow-visible">
                    <CardHeader>
                      <CardTitle className="text-base">{option.label}</CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex min-h-[8rem] flex-col gap-3">
                      <Button
                        type="button"
                        className="mt-auto w-full"
                        variant={reportType === option.key ? "default" : "outline"}
                        onClick={() => setReportType(option.key)}
                      >
                        {reportType === option.key ? "Selected" : `Use ${option.label}`}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold tracking-tight">2) Define Report Scope</p>
                {reportType === "lifetime" ? (
                  <p className="text-xs text-muted-foreground">Lifetime overview uses all Mystery Shopper data across the selected scope.</p>
                ) : reportType === "survey" ? (
                  <p className="text-xs text-muted-foreground">Select a location, then pick an approved survey to view its full details.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pick a single date to see all surveys completed that day, or a date range to cover multiple days.</p>
                )}
              </div>

              {reportType === "lifetime" ? (
                <div className="rounded-md border bg-blue-50 p-3">
                  <p className="text-sm text-blue-900">This report aggregates Mystery Shopper visits across the selected date scope and available locations.</p>
                </div>
              ) : null}

              {reportType === "survey" ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
                    <Input
                      type="text"
                      list="report-mystery-location-list"
                      placeholder="Type to search location..."
                      value={mysteryLocations.find((item) => String(item.id) === reportBusinessId)?.name || ""}
                      onChange={(event) => {
                        const match = mysteryLocations.find((item) => item.name === event.target.value);
                        setReportBusinessId(match ? String(match.id) : "");
                      }}
                    />
                    <datalist id="report-mystery-location-list">
                      {mysteryLocations.map((item) => (
                        <option key={item.id} value={item.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Survey</label>
                    <Select value={reportVisitId} onChange={(event) => setReportVisitId(event.target.value)}>
                      <option value="">Select approved survey</option>
                      {reportEligibleSurveys.map((visit) => (
                        <option key={visit.visit_id} value={visit.visit_id}>Survey on {visit.visit_date || "--"} ({visit.status})</option>
                      ))}
                    </Select>
                  </div>
                </div>
              ) : null}

              {reportType === "date" ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-md border bg-blue-50 p-3 md:col-span-2">
                    <p className="text-sm font-medium text-blue-900">Single Date vs Date Range</p>
                    <p className="text-xs text-blue-800 mt-1"><strong>Single date:</strong> Shows all surveys completed on exactly that date.</p>
                    <p className="text-xs text-blue-800 mt-1"><strong>Date range:</strong> Shows all surveys completed between two dates.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">From Date</label>
                    <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date</label>
                    <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} />
                  </div>
                </div>
              ) : null}

              {reportType === "survey" ? (
                <div className="space-y-2">
                  {reportSurveyLoading ? <p className="text-sm text-muted-foreground">Loading available surveys...</p> : null}
                  {!reportSurveyLoading && reportBusinessId && reportEligibleSurveys.length === 0 ? (
                    <p className="text-sm text-amber-700">No completed/approved surveys are available for this location yet.</p>
                  ) : null}
                  {reportIneligibleSurveys.length > 0 ? (
                    <div className="rounded-md border bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-900">Unavailable surveys (cannot generate report)</p>
                      <div className="mt-2 space-y-1 text-xs text-amber-800">
                        {reportIneligibleSurveys.slice(0, 8).map((visit) => (
                          <p key={`ineligible-${visit.visit_id}`}>Survey on {visit.visit_date || "--"} ({visit.status}) - {visit.reason || "Not report-eligible"}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold tracking-tight">3) Deliver Report</p>
                <p className="text-xs text-muted-foreground">Preview in-page, download as HTML, or send by email.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {(reportType === "lifetime" || reportType === "survey") ? (
                  <>
                    <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} placeholder="From date (optional)" />
                    <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} placeholder="To date (optional)" />
                  </>
                ) : null}
                <Input placeholder="Email recipients (comma separated)" value={reportEmailTo} onChange={(event) => setReportEmailTo(event.target.value)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handlePreviewReport} disabled={reportLoading}>{reportLoading ? "Generating..." : "Preview Report"}</Button>
                <Button type="button" variant="outline" onClick={handleDownloadReport}>Download HTML</Button>
                <Button type="button" onClick={handleEmailReport} disabled={reportSending}>{reportSending ? "Sending..." : "Email Report"}</Button>
              </div>
              {reportPreview ? (
                <div className="mt-4 space-y-3 rounded-md border bg-background p-3">
                  <p className="text-sm font-semibold">Report Preview Summary</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Visits</p><p className="text-lg font-semibold">{reportPreview.summary?.total_visits ?? 0}</p></div>
                    <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Locations</p><p className="text-lg font-semibold">{reportPreview.summary?.total_locations ?? 0}</p></div>
                    {mysteryReportMetricCards.filter((card) => card.value !== "--" && card.value !== "--%").map((card) => {
                      const grade = getTrafficLightMetric(card.metric, card.value);
                      return (
                        <div key={card.title} className={cn("rounded-md border p-2", grade.card)}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-muted-foreground">{card.title}</p>
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", grade.badge)}>{grade.label}</span>
                          </div>
                          <p className={cn("text-lg font-semibold", grade.value)}>{card.value}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Includes Mystery Shopper KPI summaries, visit scope details, and survey-level answers in a shareable report format.</p>
                  {reportPreviewHtml ? (
                    <div className="rounded-md border">
                      <iframe title="Report Preview" srcDoc={reportPreviewHtml} className="h-[720px] w-full rounded-md bg-white" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
