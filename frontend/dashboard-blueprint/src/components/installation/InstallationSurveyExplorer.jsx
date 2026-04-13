import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import InstallationSurveysDataTable from "./InstallationSurveysDataTable";
import InstallationResponsesDataTable from "./InstallationResponsesDataTable";

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
          <CardDescription>Review submitted installation surveys with built-in table sorting, filtering, and pagination, including work order search.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <InstallationSurveysDataTable data={surveys} loading={loading} onView={onView} />
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
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Quality Assurance Inspector</p><p className="font-medium">{selectedSurvey.inspector_name || "--"}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Work Order</p><p className="font-medium">{selectedSurvey.work_order || "--"}</p></div>
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
                  <InstallationResponsesDataTable responses={responses} />
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
