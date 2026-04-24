import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import SimpleStatusDataTable from "../../../components/shared/SimpleStatusDataTable";

export default function MysteryPurposesSection({
  newMysteryPurpose,
  setNewMysteryPurpose,
  createMysteryPurpose,
  loadMysteryPurposes,
  mysteryPurposesLoading,
  mysteryPurposes,
  reactivateMysteryPurpose,
  deactivateMysteryPurpose,
  deleteMysteryPurpose,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Purposes</CardTitle>
        <CardDescription>Manage visit purpose options used when completing Mystery Shopper surveys.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input value={newMysteryPurpose} onChange={(event) => setNewMysteryPurpose(event.target.value)} placeholder="Add new purpose" />
          <Button type="button" onClick={createMysteryPurpose}>Add Purpose</Button>
          <Button type="button" variant="outline" onClick={loadMysteryPurposes}>{mysteryPurposesLoading ? "Refreshing..." : "Refresh"}</Button>
        </div>

        <SimpleStatusDataTable
          data={mysteryPurposes}
          entityLabel="Purpose"
          onActivate={reactivateMysteryPurpose}
          onDeactivate={deactivateMysteryPurpose}
          onDelete={deleteMysteryPurpose}
        />
      </CardContent>
    </Card>
  );
}
