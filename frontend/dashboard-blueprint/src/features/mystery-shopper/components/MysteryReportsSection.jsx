import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import EmailRecipientsInput from "../../../components/shared/EmailRecipientsInput";
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
  reportEmailRecipients,
  reportEmailDraft,
  setReportEmailDraft,
  addReportRecipients,
  removeReportRecipient,
  handlePreviewReport,
  handleDownloadReport,
  handleDownloadPdfReport,
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
          <CardTitle className="text-xl font-semibold tracking-tight">Mystery Shopper Reports</CardTitle>
          <CardDescription>Create a report from mystery shopping visits. Choose what you want to see, then preview it on-screen, save it as a file, or send it by email.</CardDescription>
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
                <p className="text-sm font-semibold tracking-tight">Step 1 — What kind of report do you need?</p>
                <p className="text-xs text-muted-foreground">Pick one of the options below. Each type shows a different slice of the mystery shopping data.</p>
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
                <p className="text-sm font-semibold tracking-tight">Step 2 — Narrow it down</p>
                {reportType === "lifetime" ? (
                  <p className="text-xs text-muted-foreground">The Lifetime Overview covers all mystery shopping data. You can optionally filter it to a specific location or date range below.</p>
                ) : reportType === "survey" ? (
                  <p className="text-xs text-muted-foreground">Choose a location first, then pick a completed and approved visit from the list that appears.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Enter a start and end date to include all visits that happened in that period. You can use the same date for both fields to see a single day.</p>
                )}
              </div>

              {reportType === "lifetime" ? (
                <div className="rounded-md border bg-blue-50 p-3">
                  <p className="text-sm text-blue-900">This report brings together all mystery shopping visits into a single summary. It is ideal for management reviews, performance tracking, and sharing with senior stakeholders.</p>
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
                    <p className="text-xs text-blue-800 mt-1"><strong>Single day:</strong> Set both dates to the same date to see only that day&apos;s visits.</p>
                    <p className="text-xs text-blue-800 mt-1"><strong>Date range:</strong> Set different start and end dates to cover a full week, month, or quarter.</p>
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
                      <p className="text-sm font-medium text-amber-900">Some visits cannot be included in a report yet</p>
                      <p className="text-xs text-amber-800 mt-1 mb-2">Reports can only be generated from approved visits. The visits below are not yet approved:</p>
                      <div className="space-y-1 text-xs text-amber-800">
                        {reportIneligibleSurveys.slice(0, 8).map((visit) => (
                          <p key={`ineligible-${visit.visit_id}`}>Visit on {visit.visit_date || "--"} — currently <strong>{visit.status}</strong>{visit.reason ? ` (${visit.reason})` : ""}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border bg-background p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold tracking-tight">Step 3 — Preview, download, or share</p>
                <p className="text-xs text-muted-foreground">Click <strong>Preview</strong> to see the report on-screen first. Download it as an HTML file to open in any browser, or as a PDF to print or attach to an email. You can also send it directly to one or more email addresses.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {(reportType === "lifetime" || reportType === "survey") ? (
                  <>
                    <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} placeholder="From date (optional)" />
                    <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} placeholder="To date (optional)" />
                  </>
                ) : null}
                <EmailRecipientsInput
                  label="Email recipients"
                  placeholder="manager@example.com"
                  recipients={reportEmailRecipients}
                  draft={reportEmailDraft}
                  onDraftChange={setReportEmailDraft}
                  onAddRecipient={addReportRecipients}
                  onRemoveRecipient={removeReportRecipient}
                  onDraftBlur={addReportRecipients}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handlePreviewReport} disabled={reportLoading}>{reportLoading ? "Generating..." : "Preview Report"}</Button>
                <Button type="button" variant="outline" onClick={handleDownloadReport}>Download HTML</Button>
                <Button type="button" variant="outline" onClick={handleDownloadPdfReport}>Download PDF</Button>
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
                  <p className="text-xs text-muted-foreground">This is a live preview of what will be included in your report. The colours on each metric tell you at a glance whether the score is good (green), needs attention (yellow), or is a concern (red). Click Download PDF to get a print-ready version.</p>
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
