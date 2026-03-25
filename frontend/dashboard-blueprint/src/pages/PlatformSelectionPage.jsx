import { LayoutGrid, LogOut, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function PlatformSelectionPage({ userName, userEmail, availablePlatforms, onSelectPlatform, onLogout }) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-lg border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Select a platform dashboard</h1>
            <p className="text-sm text-muted-foreground">Your available platforms are based on your Entra role assignments.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded border px-3 py-2 text-muted-foreground">
              <User className="h-4 w-4" />
              {userName || "Unknown user"}
            </span>
            <span className="rounded border px-3 py-2 text-muted-foreground">{userEmail || "No email"}</span>
            <Button type="button" variant="outline" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        {availablePlatforms.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No platform access detected</CardTitle>
              <CardDescription>Your account authenticated successfully, but no platform role is currently assigned.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Ask an administrator to assign one of these roles: B2B, Mystery Shopper, or Installation Assessment.</p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availablePlatforms.map((platform) => (
              <Card key={platform.name} className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    {platform.name}
                  </CardTitle>
                  <CardDescription>Open the dashboard for this platform.</CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col justify-between gap-4">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {platform.keyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <Button type="button" onClick={() => onSelectPlatform(platform.name)}>
                    Open {platform.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
