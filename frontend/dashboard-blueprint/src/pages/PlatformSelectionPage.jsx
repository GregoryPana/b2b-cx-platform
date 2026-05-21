import { LogOut, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const BRAND_ASSET_BASE = `${import.meta.env.BASE_URL || "/"}branding/`;
const SURVEY_ICON_SRC = `${BRAND_ASSET_BASE}online-survey.png`;
const CWS_LOGO_SRC = `${BRAND_ASSET_BASE}cws-logo.png`;
const CWS_BANNER_SRC = `${BRAND_ASSET_BASE}cws-banner.png`;

export default function PlatformSelectionPage({ userName, userEmail, availablePlatforms, onSelectPlatform, onLogout }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-8">
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <img src={CWS_BANNER_SRC} alt="Cable and Wireless Seychelles banner" className="h-32 w-full object-cover md:h-40" />
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-center gap-4">
              <img src={CWS_LOGO_SRC} alt="Cable and Wireless Seychelles logo" className="h-14 w-14 rounded-lg border bg-background p-2 object-contain" />
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background/80 shadow-sm">
                  <img src={SURVEY_ICON_SRC} alt="Online survey icon" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">CX Governance</p>
                  <h1 className="text-2xl font-semibold tracking-tight">Select a platform dashboard</h1>
                  <p className="text-sm text-muted-foreground">Open the right workspace for your customer experience responsibilities.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <header className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <h2 className="text-2xl font-semibold">Platform Access</h2>
            <p className="text-sm text-muted-foreground">Your available platforms are based on your Entra role assignments.</p>
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
            {availablePlatforms.map((platform) => (
              <Card key={platform.name} className="h-full min-w-0 overflow-visible">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40">
                      <img src={SURVEY_ICON_SRC} alt="Survey platform icon" className="h-5 w-5 object-contain" />
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
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
