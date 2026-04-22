import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const guideAssetBase = (path) => `${import.meta.env.BASE_URL}guides/${path}`;

const GUIDE_CONTENT = {
  b2b: {
    title: "Dashboard User Guide: B2B Platform",
    description: "Reference guide for the B2B dashboard modules and screenshots.",
    sections: [
      {
        title: "Accessing The Platform",
        steps: [
          "Open the dashboard and sign in with your work account.",
          "Choose B2B from the platform selector.",
          "Confirm the Analytics page loads with B2B metrics.",
        ],
        images: [
          { src: guideAssetBase("dashboard-b2b/analytics.png"), alt: "B2B analytics landing" },
        ],
      },
      {
        title: "Key Dashboard Areas",
        steps: [
          "Use Analytics for KPI monitoring and trends.",
          "Use Review Queue to process pending submissions.",
          "Use Businesses and Planned Visits to maintain working data.",
          "Use Survey Results to inspect submitted records.",
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
        steps: [
          "Open the dashboard and sign in with your work account.",
          "Choose Installation Assessment from the platform selector.",
          "Confirm the installation analytics landing page loads.",
        ],
        images: [
          { src: guideAssetBase("dashboard-installation/landing.png"), alt: "Installation dashboard landing" },
        ],
      },
      {
        title: "Using The Installation Dashboard",
        steps: [
          "Use Analytics to review average scores and contractor performance.",
          "Use Trends to inspect score changes over time.",
          "Use Surveys and Reports to review submitted assessments and outputs.",
          "Use Contractors to maintain the contractor directory used in the survey app.",
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
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
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
