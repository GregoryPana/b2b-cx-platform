import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const guideAssetBase = (path) => `${import.meta.env.BASE_URL}guides/${path}`;

const GUIDE_CONTENT = {
  b2b: {
    title: "Dashboard User Guide: B2B Platform",
    description: "Reference guide for the B2B dashboard modules and screenshots.",
    sections: [
      {
        title: "Accessing The Platform",
        summary: "Use this when opening the dashboard for the first time or when checking that you selected the correct platform.",
        steps: [
          "Open the dashboard and sign in with your work account.",
          "Choose B2B from the platform selector.",
          "Confirm the Analytics page loads with B2B metrics.",
        ],
        notes: [
          "If you choose the wrong platform, the menu and data will not match the work you are trying to do.",
          "The dashboard is mainly for review, monitoring, setup, and reporting rather than filling out surveys.",
        ],
        images: [
          { src: guideAssetBase("dashboard-b2b/analytics.png"), alt: "B2B analytics landing" },
        ],
      },
      {
        title: "Key Dashboard Areas",
        summary: "Each page has a different purpose. Use the menu in order from overview pages to detail pages.",
        steps: [
          "Use Analytics for KPI monitoring and trends.",
          "Use Review Queue to process pending submissions.",
          "Use Businesses and Planned Visits to maintain working data.",
          "Use Survey Results to inspect submitted records.",
        ],
        notes: [
          "Start with Analytics when you need a quick picture of performance.",
          "Use Review when you need to make a decision on pending survey records.",
          "Use Businesses and Planned Visits when master data or scheduling needs to be corrected.",
        ],
        images: [
          { src: guideAssetBase("dashboard-b2b/review-queue.png"), alt: "B2B review queue" },
          { src: guideAssetBase("dashboard-b2b/business-directory.png"), alt: "B2B business directory" },
          { src: guideAssetBase("dashboard-b2b/planned-visits.png"), alt: "B2B planned visits" },
          { src: guideAssetBase("dashboard-b2b/survey-results.png"), alt: "B2B survey results" },
        ],
      },
    ],
  },
  installation: {
    title: "Dashboard User Guide: Installation Platform",
    description: "Reference guide for the Installation Assessment dashboard modules and screenshots.",
    sections: [
      {
        title: "Accessing The Platform",
        summary: "Use this when starting work in the Installation dashboard and when confirming you selected the correct platform.",
        steps: [
          "Open the dashboard and sign in with your work account.",
          "Choose Installation Assessment from the platform selector.",
          "Confirm the installation analytics landing page loads.",
        ],
        notes: [
          "This dashboard is for reviewing, reporting, and setup. The actual installation survey is completed in the separate survey frontend.",
          "If the page content does not match installation work, recheck the selected platform.",
        ],
        images: [
          { src: guideAssetBase("dashboard-installation/landing.png"), alt: "Installation dashboard landing" },
        ],
      },
      {
        title: "Using The Installation Dashboard",
        summary: "Move from summary information to detailed records so you understand not only the score, but the reason behind it.",
        steps: [
          "Use Analytics to review average scores and contractor performance.",
          "Use Trends to inspect score changes over time.",
          "Use Surveys and Reports to review submitted assessments and outputs.",
          "Use Contractors to maintain the contractor directory used in the survey app.",
        ],
        notes: [
          "Use Analytics first for the high-level picture.",
          "Use Surveys when you need the exact record behind a score.",
          "Use Contractors to keep contractor names consistent, which keeps reporting clean.",
        ],
        images: [
          { src: guideAssetBase("dashboard-installation/overview.png"), alt: "Installation dashboard overview" },
          { src: guideAssetBase("dashboard-installation/modules.png"), alt: "Installation dashboard modules" },
        ],
      },
    ],
  },
};

export default function PlatformUserGuidePage({ platform }) {
  const guide = GUIDE_CONTENT[platform];

  if (!guide) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Guide</CardTitle>
          <CardDescription>No in-app guide is available for this platform yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight">{guide.title}</CardTitle>
          <CardDescription>{guide.description}</CardDescription>
        </CardHeader>
      </Card>

      {guide.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="rounded-md border bg-muted/20 p-4 text-sm">
              <p className="font-medium">Helpful notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {section.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {section.images.map((image) => (
                <figure key={image.src} className="space-y-2 rounded-md border p-3">
                  <img src={image.src} alt={image.alt} className="w-full rounded border object-contain" />
                  <figcaption className="text-xs text-muted-foreground">{image.alt}</figcaption>
                </figure>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
