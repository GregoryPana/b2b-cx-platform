import { LogOut, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const BRAND_ASSET_BASE = `${import.meta.env.BASE_URL || "/"}branding/`;
const CWS_LOGO_SRC = `${BRAND_ASSET_BASE}cws-logo.png`;
const PLATFORM_ICON_MAP = {
  B2B: `${BRAND_ASSET_BASE}platforms/b2b.png`,
  "Mystery Shopper": `${BRAND_ASSET_BASE}platforms/mystery-shopper.png`,
  "Installation Assessment": `${BRAND_ASSET_BASE}platforms/installation-assessment.png`,
};

export default function PlatformSelectionPage({ userName, userEmail, availablePlatforms, onSelectPlatform, onLogout }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-8">
        <header className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex items-center gap-4">
            <img src={CWS_LOGO_SRC} alt="Cable and Wireless Seychelles logo" className="h-12 w-12 rounded-lg border bg-background p-2 object-contain" />
            <div>
            <h2 className="text-2xl font-semibold">Platform Access</h2>
            <p className="text-sm text-muted-foreground">Your available platforms are based on your Entra role assignments.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center">
            <span className="inline-flex items-center gap-2 rounded border px-3 py-2 text-muted-foreground">
              <User className="h-4 w-4" />
              {userName || "Unknown user"}
            </span>
            <span className="rounded border px-3 py-2 text-muted-foreground break-all">{userEmail || "No email"}</span>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        {availablePlatforms.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No platform access detected</CardTitle>
              <CardDescription>You're signed in, but this account does not have access to any platform dashboards yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Please ask an administrator to grant the dashboard role you need, and then sign in again.</p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availablePlatforms.map((platform) => {
              const platformIcon = PLATFORM_ICON_MAP[platform.name] || CWS_LOGO_SRC;
              return (
              <Card key={platform.name} className="h-full min-w-0 overflow-visible">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40">
                      <img src={platformIcon} alt={`${platform.name} icon`} className="h-5 w-5 object-contain" />
                    </span>
                    {platform.name}
                  </CardTitle>
                  <CardDescription>Open the dashboard for this platform.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-[13rem] flex-col gap-4">
                  <ul className="grow space-y-1 text-sm text-muted-foreground break-words">
                    {platform.keyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <Button type="button" className="mt-auto w-full shrink-0" onClick={() => onSelectPlatform(platform.name)}>
                    Open {platform.name}
                  </Button>
                </CardContent>
              </Card>
            );})}
          </section>
        )}
      </div>
    </main>
  );
}
