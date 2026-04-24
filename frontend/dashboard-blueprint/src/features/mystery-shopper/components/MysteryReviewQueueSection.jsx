import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import ReviewQueueDataTable from "../../../components/b2b/ReviewQueueDataTable";

export default function MysteryReviewQueueSection({
  pendingVisits,
  loadingVisitId,
  onView,
  onApprove,
  onReject,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">Review Queue</CardTitle>
        <CardDescription className="text-sm">These submitted visits are waiting for manager review. You can approve or reject each one.</CardDescription>
      </CardHeader>
      <CardContent>
        <ReviewQueueDataTable
          data={pendingVisits}
          isMysteryShopperPlatform
          loadingVisitId={loadingVisitId}
          onView={onView}
          onApprove={onApprove}
          onReject={onReject}
        />
      </CardContent>
    </Card>
  );
}
