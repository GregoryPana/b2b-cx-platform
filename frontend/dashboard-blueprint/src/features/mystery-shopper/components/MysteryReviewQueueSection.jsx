import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import MysteryReviewQueueTable from "./MysteryReviewQueueTable";

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Review Queue</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Submitted mystery shopper visits waiting for review. Approve, reject, or view each visit in detail.
            </CardDescription>
          </div>
          {pendingVisits.length > 0 && (
            <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-red-500 px-2 text-sm font-bold text-white">
              {pendingVisits.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <MysteryReviewQueueTable
          data={pendingVisits}
          loadingVisitId={loadingVisitId}
          onView={onView}
          onApprove={onApprove}
          onReject={onReject}
        />
      </CardContent>
    </Card>
  );
}
