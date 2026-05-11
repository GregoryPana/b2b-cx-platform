import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Select } from "../../../components/ui/select";
import SurveysDataTable from "../../../components/b2b/SurveysDataTable";
import MysteryVisitDetailCard from "./MysteryVisitDetailCard";

export default function MysterySurveyResultsSection({
  surveyStatusFilter,
  setSurveyStatusFilter,
  selectedSurveyLocation,
  setSelectedSurveyLocation,
  mysteryLocations,
  loadSurveyResults,
  surveyLoading,
  surveyResults,
  loadSurveyVisitDetails,
  selectedSurveyVisit,
  surveyResponseCategoryGroups,
  formatSurveyResponseValue,
  formatReadableDateTime,
  onCloseDetails,
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">Survey Results</CardTitle>
          <CardDescription>View full Mystery Shopper submissions, then open each visit to inspect all questions and answers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-2">
            <Select value={surveyStatusFilter} onChange={(event) => setSurveyStatusFilter(event.target.value)}>
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </Select>
            <Select value={selectedSurveyLocation} onChange={(event) => setSelectedSurveyLocation(event.target.value)}>
              <option value="">All Locations</option>
              {mysteryLocations.map((locationItem) => (
                <option key={locationItem.id} value={locationItem.name}>{locationItem.name}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={loadSurveyResults}>Refresh</Button>
            <span className="inline-flex items-center text-sm text-muted-foreground">{surveyLoading ? "Loading..." : `${surveyResults.length} results`}</span>
          </div>

          <SurveysDataTable
            data={surveyResults}
            loading={surveyLoading}
            isMysteryShopperPlatform
            onViewDetails={loadSurveyVisitDetails}
          />
        </CardContent>
      </Card>

      {selectedSurveyVisit ? (
        <MysteryVisitDetailCard
          visit={selectedSurveyVisit}
          responseGroups={surveyResponseCategoryGroups}
          formatSurveyResponseValue={formatSurveyResponseValue}
          formatReadableDateTime={formatReadableDateTime}
          onClose={onCloseDetails}
        />
      ) : null}
    </div>
  );
}
