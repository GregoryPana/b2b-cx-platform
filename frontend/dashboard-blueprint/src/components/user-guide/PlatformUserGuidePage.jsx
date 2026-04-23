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
          "Use Analytics (Chart icon) for KPI monitoring and trend summaries.",
          "Use Review (Scan icon) to process pending submissions.",
          "Use Planned Visits (Calendar icon) to manage survey scheduling.",
          "Use Businesses (Building icon) to maintain business records used by surveys and analytics.",
          "Use Surveys (List icon) to inspect submitted records in detail.",
        ],
        notes: [
          "Start with Analytics when you need a quick picture of performance.",
          "Use Review when you need to make a decision on pending survey records.",
          "Use Businesses and Planned Visits when master data or scheduling needs to be corrected.",
          "On the Businesses page, the table includes details such as Name, Location, Business Type, Account Executive, Status, and Actions.",
          "Typical business actions are Edit, Retire, and Delete. Retire hides the business from normal active use while keeping historical records.",
        ],
        images: [
          { src: guideAssetBase("dashboard-b2b/review-queue.png"), alt: "B2B review queue" },
          { src: guideAssetBase("dashboard-b2b/business-directory.png"), alt: "B2B business directory" },
          { src: guideAssetBase("dashboard-b2b/planned-visits.png"), alt: "B2B planned visits" },
          { src: guideAssetBase("dashboard-b2b/survey-results.png"), alt: "B2B survey results" },
        ],
      },
      {
        title: "Other B2B Pages You Can Use",
        summary: "The rest of the B2B dashboard pages support detailed monitoring, follow-up, setup, and self-help.",
        steps: [
          "Use Trends (Trend icon) to understand how results move over time.",
          "Use Action Points (Action icon) to track follow-up work and update statuses and comments.",
          "Use Reports (Report icon) to preview, download, or email formal outputs.",
          "Use Account Executives (Building icon) to maintain the executive directory used across business records and reports.",
          "Use User Guide (Book icon) when you need help understanding the system.",
        ],
        notes: [
          "You do not need to use every page every day. Start with the page that matches your task.",
          "If you are reviewing performance, begin with Analytics or Trends. If you are maintaining data, begin with Businesses, Executives, or Planned Visits.",
        ],
        images: [],
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
          "Use Analytics (Chart icon) to review average scores and contractor performance.",
          "Use Trends (Trend icon) to inspect score changes over time.",
          "Use Surveys (List icon) and Reports (Report icon) to review submitted assessments and outputs.",
          "Use Contractors (Building icon) to maintain the contractor directory used in the survey app.",
        ],
        notes: [
          "Use Analytics first for the high-level picture.",
          "Use Surveys when you need the exact record behind a score.",
          "Use Contractors to keep contractor names consistent, which keeps reporting clean.",
          "The Surveys page includes worker details such as contractor name or field team members so you can inspect the full context behind an assessment.",
        ],
        images: [
          { src: guideAssetBase("dashboard-installation/overview.png"), alt: "Installation dashboard overview" },
          { src: guideAssetBase("dashboard-installation/modules.png"), alt: "Installation dashboard modules" },
        ],
      },
      {
        title: "Other Installation Pages You Can Use",
        summary: "The installation dashboard pages work together to help you move from summary information to detailed records and reporting.",
        steps: [
          "Use Surveys (List icon) to inspect one submitted assessment in detail.",
          "Use Reports (Report icon) to preview and send report output.",
          "Use Contractors (Building icon) to maintain the contractor list used by the survey app.",
          "Use User Guide (Book icon) whenever you need help while working.",
        ],
        notes: [
          "If a score looks unusual, use Surveys to inspect the exact assessment behind it.",
          "If contractor reporting looks split across similar names, review the Contractors page.",
        ],
        images: [],
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
            {section.images.length ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {section.images.map((image) => (
                  <figure key={image.src} className="space-y-2 rounded-md border p-3">
                    <img src={image.src} alt={image.alt} className="w-full rounded border object-contain" />
                    <figcaption className="text-xs text-muted-foreground">{image.alt}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
