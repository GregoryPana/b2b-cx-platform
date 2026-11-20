import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import Disclosure from "../../../components/shared/Disclosure";
import EmailRecipientsInput from "../../../components/shared/EmailRecipientsInput";
import Field from "../../../components/shared/Field";
import ReportStep from "../../../components/shared/ReportStep";
import ReportTypePicker from "../../../components/shared/ReportTypePicker";
import { cn, getTrafficLightMetric } from "../../../lib/utils";

const STEP_TWO_HINT = {
  lifetime: "The Lifetime Overview covers all mystery shopping data. Optionally limit it to a date range.",
  survey: "Choose a location, then pick a completed and approved visit from the list that appears.",
  date: "Choose a start and end date to include every visit in that period.",
};

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
  const optionalDateRange = (
    <Disclosure
      summary="Limit by date range (optional)"
      meta={reportDateFrom || reportDateTo ? "Active" : null}
      defaultOpen={Boolean(reportDateFrom || reportDateTo)}
      className="bg-muted/30"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="From date">
          <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} />
        </Field>
        <Field label="To date">
          <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} />
        </Field>
      </div>
    </Disclosure>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mystery Shopper Reports</CardTitle>
          <CardDescription>Create a report from mystery shopping visits. Choose what you want to see, then preview it, save it as a file, or send it by email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ReportStep number={1} title="What kind of report do you need?">
            <ReportTypePicker
              options={reportTypeOptions}
              value={reportType}
              onSelect={(key) => { setReportType(key); setReportBusinessId(""); setReportVisitId(""); }}
            />
          </ReportStep>

          <ReportStep number={2} title="Narrow it down" hint={STEP_TWO_HINT[reportType]}>
            {reportType === "survey" ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Location">
                    <Input
                      type="text"
                      list="report-mystery-location-list"
                      placeholder="Type to search location..."
                      value={mysteryLocations.find((item) => String(item.id) === reportBusinessId)?.name || ""}
                      onChange={(event) => {
                        const match = mysteryLocations.find((item) => item.name === event.target.value);
                        setReportBusinessId(match ? String(match.id) : "");
                        setReportVisitId("");
                      }}
                    />
                    <datalist id="report-mystery-location-list">
                      {mysteryLocations.map((item) => (
                        <option key={item.id} value={item.name} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Survey">
                    <Select aria-label="Approved Mystery Shopper visit" value={reportVisitId} onChange={(event) => setReportVisitId(event.target.value)} disabled={!reportBusinessId || reportSurveyLoading}>
                      <option value="">Select approved survey</option>
                      {reportEligibleSurveys.map((visit) => (
                        <option key={visit.visit_id} value={visit.visit_id}>Survey on {visit.visit_date || "--"} ({visit.status})</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {reportSurveyLoading ? <p className="text-sm text-muted-foreground" role="status">Loading available surveys...</p> : null}
                {!reportSurveyLoading && reportBusinessId && reportEligibleSurveys.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">No completed or approved surveys are available for this location yet.</p>
                ) : null}
                {reportIneligibleSurveys.length > 0 ? (
                  <Disclosure
                    summary="Some visits cannot be included yet"
                    meta={`${reportIneligibleSurveys.length} not approved`}
                    className="border-warning/40 bg-warning/10"
                  >
                    <p className="mb-2 text-xs text-muted-foreground">Reports can only be generated from approved visits. These visits are not approved yet:</p>
                    <ul className="space-y-1 text-xs">
                      {reportIneligibleSurveys.slice(0, 8).map((visit) => (
                        <li key={`ineligible-${visit.visit_id}`}>
                          Visit on {visit.visit_date || "--"} - currently <strong>{visit.status}</strong>{visit.reason ? ` (${visit.reason})` : ""}
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                ) : null}
                {optionalDateRange}
              </>
            ) : null}

            {reportType === "date" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="From date" hint="Use the same date in both fields to see a single day.">
                  <Input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} />
                </Field>
                <Field label="To date" hint="Pick a later date to cover a week, month, or quarter.">
                  <Input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} />
                </Field>
              </div>
            ) : null}

            {reportType === "lifetime" ? optionalDateRange : null}
          </ReportStep>

          <ReportStep number={3} title="Preview, download, or share">
            <Disclosure
              summary="Email this report"
              meta={reportEmailRecipients.length > 0 ? `${reportEmailRecipients.length} recipient${reportEmailRecipients.length === 1 ? "" : "s"}` : null}
              defaultOpen={reportEmailRecipients.length > 0}
              className="bg-muted/30"
            >
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
            </Disclosure>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePreviewReport} disabled={reportLoading}>{reportLoading ? "Generating..." : "Preview report"}</Button>
              <Button type="button" variant="outline" onClick={handleDownloadReport}>Download HTML</Button>
              <Button type="button" variant="outline" onClick={handleDownloadPdfReport}>Download PDF</Button>
              <Button type="button" variant="outline" onClick={handleEmailReport} disabled={reportSending}>{reportSending ? "Sending..." : "Email report"}</Button>
            </div>

            {reportPreview ? (
              <div className="space-y-4 rounded-lg border p-4">
                <h4 className="text-sm font-semibold">Report preview summary</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Visits</p><p className="text-lg font-semibold tabular-nums">{reportPreview.summary?.total_visits ?? 0}</p></div>
                  <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Locations</p><p className="text-lg font-semibold tabular-nums">{reportPreview.summary?.total_locations ?? 0}</p></div>
                  {mysteryReportMetricCards.filter((card) => card.value !== "--" && card.value !== "--%").map((card) => {
                    const grade = getTrafficLightMetric(card.metric, card.value);
                    return (
                      <div key={card.title} className={cn("rounded-md border p-3", grade.card)}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{card.title}</p>
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", grade.badge)}>{grade.label}</span>
                        </div>
                        <p className={cn("text-lg font-semibold tabular-nums", grade.value)}>{card.value}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Green means the score is good, yellow needs attention, red is a concern. Use Download PDF for a print-ready version.</p>
                {reportPreviewHtml ? (
                  <iframe title="Report Preview" srcDoc={reportPreviewHtml} className="h-[720px] w-full rounded-md border bg-white" />
                ) : null}
              </div>
            ) : null}
          </ReportStep>
        </CardContent>
      </Card>
    </div>
  );
}
