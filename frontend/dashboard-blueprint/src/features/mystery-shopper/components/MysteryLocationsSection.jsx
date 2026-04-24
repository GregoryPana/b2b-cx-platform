import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import SimpleStatusDataTable from "../../../components/shared/SimpleStatusDataTable";

export default function MysteryLocationsSection({
  newMysteryLocation,
  setNewMysteryLocation,
  createMysteryLocation,
  loadMysteryLocations,
  mysteryLocationsLoading,
  seedMysteryLegacyData,
  mysteryLegacySeeding,
  mysteryLocations,
  reactivateMysteryLocation,
  deactivateMysteryLocation,
  deleteMysteryLocation,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Locations</CardTitle>
        <CardDescription>Manage customer service center locations used by the Mystery Shopper survey.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input value={newMysteryLocation} onChange={(event) => setNewMysteryLocation(event.target.value)} placeholder="Add new location" />
          <Button type="button" onClick={createMysteryLocation}>Add Location</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={loadMysteryLocations}>{mysteryLocationsLoading ? "Refreshing..." : "Refresh"}</Button>
            <Button type="button" variant="outline" onClick={seedMysteryLegacyData} disabled={mysteryLegacySeeding}>{mysteryLegacySeeding ? "Seeding..." : "Seed Old Data"}</Button>
          </div>
        </div>

        <SimpleStatusDataTable
          data={mysteryLocations}
          entityLabel="Location"
          onActivate={reactivateMysteryLocation}
          onDeactivate={deactivateMysteryLocation}
          onDelete={deleteMysteryLocation}
        />
      </CardContent>
    </Card>
  );
}
