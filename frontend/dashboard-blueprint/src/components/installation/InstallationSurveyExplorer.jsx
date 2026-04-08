import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";

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
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">Installation Survey Explorer</CardTitle>
          <CardDescription>Search and filter submitted installation surveys by customer, inspector, location, date, customer type, and worker type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Customer name"
              value={filters.customer_name}
              onChange={(event) => onFilterChange("customer_name", event.target.value)}
            />
            <Input
              placeholder="Inspector/Auditor name"
              value={filters.inspector_name}
              onChange={(event) => onFilterChange("inspector_name", event.target.value)}
            />
            <Input
              placeholder="Location"
              value={filters.location}
              onChange={(event) => onFilterChange("location", event.target.value)}
            />
            <Input
              type="date"
              value={filters.date_work_done}
              onChange={(event) => onFilterChange("date_work_done", event.target.value)}
            />
            <Input
              type="date"
              value={filters.date_from}
              onChange={(event) => onFilterChange("date_from", event.target.value)}
            />
            <Input
              type="date"
              value={filters.date_to}
              onChange={(event) => onFilterChange("date_to", event.target.value)}
            />
            <Select value={filters.customer_type} onChange={(event) => onFilterChange("customer_type", event.target.value)}>
              <option value="">All customer types</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </Select>
            <Select value={filters.worker_type} onChange={(event) => onFilterChange("worker_type", event.target.value)}>
              <option value="">All worker types</option>
              <option value="Field Team">Field Team</option>
              <option value="Contractor">Contractor</option>
            </Select>
          </div>

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
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Inspector/Auditor</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date Work Done</TableHead>
                <TableHead>Customer Type</TableHead>
                <TableHead>Worker Type</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading installation surveys...</TableCell>
                </TableRow>
              ) : surveys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No installation surveys found for the selected filters.</TableCell>
                </TableRow>
              ) : (
                surveys.map((survey) => (
                  <TableRow key={survey.survey_id}>
                    <TableCell>{survey.customer_name || "--"}</TableCell>
                    <TableCell>{survey.inspector_name || "--"}</TableCell>
                    <TableCell>{survey.location || "--"}</TableCell>
                    <TableCell>{survey.date_work_done || "--"}</TableCell>
                    <TableCell>{survey.customer_type || "--"}</TableCell>
                    <TableCell>{survey.job_done_by || "--"}</TableCell>
                    <TableCell>{survey.overall_score != null ? Number(survey.overall_score).toFixed(2) : "--"}</TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" onClick={() => onView(survey.survey_id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Inspector/Auditor</p><p className="font-medium">{selectedSurvey.inspector_name || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Customer Name</p><p className="font-medium">{selectedSurvey.customer_name || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{selectedSurvey.location || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Customer Type</p><p className="font-medium">{selectedSurvey.customer_type || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Worker Type</p><p className="font-medium">{selectedSurvey.job_done_by || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Date Work Done</p><p className="font-medium">{selectedSurvey.date_work_done || "--"}</p></div>
            </div>

            {/* Group responses by category */}
            {(() => {
              const groups = (selectedSurvey.responses || []).reduce((acc, resp) => {
                const cat = resp.category || "Uncategorized";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(resp);
                return acc;
              }, {});
              return Object.entries(groups).map(([category, responses]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">{category}</h4>
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Score (1-5)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((response) => (
                        <TableRow key={`${selectedSurvey.survey_id}-${response.question_number}`}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Q{response.question_number}</span>
                              <span>{response.question_text || "--"}</span>
                            </div>
                          </TableCell>
                          <TableCell>{response.score}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ));
            })()}

            <Button type="button" variant="outline" onClick={onCloseDetails}>Close Details</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
