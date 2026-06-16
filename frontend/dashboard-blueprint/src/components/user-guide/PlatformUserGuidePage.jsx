import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const guideAssetBase = (path) => `${import.meta.env.BASE_URL}guides/${path}`;

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const GUIDE_CONTENT = {
  b2b: {
    title: "Dashboard User Guide: B2B Platform",
    description: "Reference guide for the B2B dashboard modules and screenshots.",
    sections: [
      {
        title: "How The B2B Platform Works End To End",
        summary: "The full lifecycle of a B2B survey, so you know which page belongs to which stage.",
        steps: [
          "Administrators maintain master data here first: Businesses (the companies surveyed) and Account Executives (who owns each relationship).",
          "Visits are planned on the Planned Visits page so surveyors know which business to assess and when.",
          "A surveyor completes the B2B survey in the separate survey frontend, signing in with their organisation Entra account.",
          "Submitted surveys arrive in the Review queue, where a reviewer approves them into official results or sends them back for changes.",
          "Approved results feed Analytics, Trends, Surveys, Action Points, and Reports automatically; follow-up work is tracked to completion in Action Points.",
        ],
        notes: [
          "All B2B users sign in with their organisation Entra account on both the dashboard and the survey frontend - there is no separate password.",
          "Numeric survey questions use fixed scales where the lowest number is always the worst experience and the highest the best.",
        ],
        images: [],
      },
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
        title: "How The Installation Platform Works End To End",
        summary: "The full lifecycle of an installation assessment, so you know which page belongs to which stage.",
        steps: [
          "Administrators maintain the Contractors directory here first, since assessments are recorded against contractors.",
          "An assessor completes the installation survey in the separate survey frontend after inspecting an installation, signing in with their organisation Entra account.",
          "Submitted assessments appear under Surveys; results feed Analytics and Trends automatically.",
          "Use Reports to produce formal outputs for a contractor, a period, or the whole programme.",
        ],
        notes: [
          "All installation users sign in with their organisation Entra account on both the dashboard and the survey frontend.",
          "Keeping contractor names consistent in the directory is what keeps analytics and reporting clean.",
        ],
        images: [],
      },
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
  mystery: {
    title: "Dashboard User Guide: Mystery Shopper Platform",
    description: "Complete guide for administrators and reviewers: how the platform works end to end, what shoppers do, and every duty that belongs to the dashboard side.",
    sections: [
      {
        title: "How The Platform Works End To End",
        summary: "The big picture before any individual page: who does what, in what order, on which system.",
        steps: [
          "An administrator prepares reference data here in the dashboard: the customer service Locations that can be visited and the visit Purposes shoppers choose from.",
          "An administrator invites each mystery shopper on the Users page, which generates a one-time enrollment link (copied or emailed directly from the dashboard).",
          "The shopper opens the link on the public survey site, sets a password, links an authenticator app (two-factor authentication), and saves their recovery codes.",
          "The shopper visits a location as a normal customer, then signs in (VPN + email + password + authenticator code) and completes the survey, saving answers as they go and submitting when all mandatory questions are answered.",
          "A reviewer processes the submitted visit on the Review page: approve it into the official results, or send it back / reject it.",
          "Approved results feed Analytics, Trends, Surveys, and Reports automatically.",
        ],
        notes: [
          "Two separate frontends exist by design: this internal dashboard (organisation Entra sign-in) and the public survey site (password + authenticator code for external shoppers).",
          "Organisation staff with mystery shopper roles can also open the internal survey frontend with their Entra account - they never need the public two-factor flow (see the access section below).",
        ],
        images: [],
      },
      {
        title: "Accessing The Platform",
        summary: "Use this when starting work in the Mystery Shopper dashboard and confirming you selected the correct platform.",
        steps: [
          "Open the dashboard and sign in with your work (Entra) account.",
          "Choose Mystery Shopper from the platform selector.",
          "Confirm the analytics landing page shows Mystery Shopper metrics, locations, and review counts.",
        ],
        notes: [
          "Dashboard access requires a Mystery Shopper role on your Entra account (MYSTERY_ADMIN or CX_SUPER_ADMIN for management pages; MYSTERY_SURVEYOR is enough for survey completion only).",
          "Actual mystery shopper assessments are completed in the survey frontend, not here.",
          "If you selected the wrong platform, the side menu and report filters will not match your task.",
        ],
        images: [],
      },
      {
        title: "Setting Up Reference Data (Admin Duty)",
        summary: "Shoppers can only pick from what you maintain here. Do this before inviting anyone.",
        steps: [
          "Use Locations to add every customer service centre that can be mystery-shopped. Archive (deactivate) locations that close rather than deleting them, so history is kept.",
          "Use Purposes to maintain the list of visit reasons shoppers choose from (for example bill payment, new connection, fault report).",
          "Review both lists periodically - a missing location is the most common reason a shopper cannot start a survey.",
        ],
        notes: [
          "Changes appear in the survey frontend immediately; no deployment is needed.",
          "Deactivated entries disappear from the shopper's dropdowns but remain attached to historical visits.",
        ],
        images: [],
      },
      {
        title: "Managing Mystery Shopper Users (Admin Duty)",
        summary: "The Users page is the allow-list for the public survey site. Nobody can sign up on their own.",
        steps: [
          "Open Users and invite a shopper with their email address and full name. The platform generates a one-time enrollment link.",
          "Send the link: either press Copy and deliver it yourself over a trusted channel, or press Email link so the platform sends a pre-formatted invitation (it explains the enrollment steps, reminds the user to connect to the VPN, and lists you as the contact for problems).",
          "Watch the Status column: invited means the link was issued but enrollment is not finished; active means the shopper has enrolled and can sign in; recovery pending means they used a recovery code and must finish re-enrolling; suspended means access is blocked.",
          "Use Last sign-in to see whether a shopper has actually been using the platform.",
          "Use Reset / new link when a shopper has lost their password, authenticator app, and recovery codes - it issues a fresh enrollment link so they can set everything up again.",
          "Use Suspend to immediately block access and revoke active sessions (for example when an engagement ends); Reactivate restores a suspended account.",
        ],
        notes: [
          "Enrollment links are single-use and expire (30 minutes by default), so send them when the shopper is ready to act.",
          "Each shopper receives recovery codes during enrollment. A shopper who still has a recovery code can recover their own access from the sign-in page without your help.",
          "Treat enrollment links like passwords: anyone holding an unused link can claim that account.",
        ],
        images: [],
      },
      {
        title: "Reviewing Submitted Visits",
        summary: "Submitted visits wait in the Review queue until a reviewer makes a decision. Only approved visits count in analytics.",
        steps: [
          "Open Review to see all visits with Pending status.",
          "Open a visit to read every answer, score, and comment the shopper recorded.",
          "Approve the visit to accept it into official results, or reject / send it back if something is wrong or incomplete.",
        ],
        notes: [
          "The review count badge in the sidebar updates automatically so you can see waiting work at a glance.",
          "Use Surveys afterwards to inspect any approved record in full detail.",
        ],
        images: [],
      },
      {
        title: "Analytics, Trends, And Reports",
        summary: "Move from summary information into record-level detail based on the task you are working on.",
        steps: [
          "Use Analytics to review CX score trends, location performance, question breakdowns, and KPI summaries.",
          "Use Trends to inspect how scores move over time.",
          "Use Surveys to inspect completed survey records and see the full response details.",
          "Use Reports to preview, download, or email formatted outputs for the selected scope.",
        ],
        notes: [
          "Numeric questions use fixed scales where the lowest number is always the worst experience and the highest is the best: most questions are scored 1-5, recommendation-style questions 0-10.",
          "If a report looks too broad, narrow the scope using location, date, or other available filters before generating output.",
          "Report automation is planned for a future phase, so current reporting remains manually triggered.",
        ],
        images: [],
      },
      {
        title: "Admin Access To The Survey Frontend (No 2FA Needed)",
        summary: "Organisation staff do not use the public password + authenticator sign-in. The internal survey frontend accepts your Entra account directly.",
        steps: [
          "Open the internal survey frontend URL (on the internal host under /surveys/mystery-shopper/, alongside this dashboard).",
          "Sign in with your organisation Entra account when prompted - the same account you use for this dashboard.",
          "Complete or inspect surveys exactly as a shopper would; your submissions follow the same review flow.",
        ],
        notes: [
          "Your Entra account needs a Mystery Shopper role (MYSTERY_SURVEYOR, MYSTERY_ADMIN, or CX_SUPER_ADMIN).",
          "The public internet-facing copy of the survey site only offers the password + authenticator sign-in; it is intended for external shoppers and is the one enrollment links point to.",
          "Never enroll your work account on the public site - use the internal URL instead.",
        ],
        images: [],
      },
    ],
  },
};

export default function PlatformUserGuidePage({ platform }) {
  const guide = GUIDE_CONTENT[platform];
  const [selectedImage, setSelectedImage] = useState(null);
  const [activeSlug, setActiveSlug] = useState(null);
  const sectionRefs = useRef({});

  const sectionSlugs = guide ? guide.sections.map((s) => slugify(s.title)) : [];

  /* Scroll to hash on first load */
  useEffect(() => {
    if (!guide) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      setActiveSlug(hash);
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (sectionSlugs.length) {
      setActiveSlug(sectionSlugs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  /* Track active section via IntersectionObserver */
  useEffect(() => {
    if (!guide) return;
    const observers = [];
    sectionSlugs.forEach((slug) => {
      const el = document.getElementById(slug);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSlug(slug);
        },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, guide]);

  function scrollToSection(slug) {
    setActiveSlug(slug);
    window.history.pushState(null, "", `#${slug}`);
    const el = document.getElementById(slug);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    <div className="flex gap-6">
      {/* Sticky TOC sidebar */}
      <aside className="hidden w-52 flex-shrink-0 lg:block">
        <div className="sticky top-4 space-y-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
          {guide.sections.map((section, i) => {
            const slug = sectionSlugs[i];
            const isActive = activeSlug === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => scrollToSection(slug)}
                className={[
                  "block w-full rounded px-3 py-1.5 text-left text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                {section.title}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">{guide.title}</CardTitle>
            <CardDescription>{guide.description}</CardDescription>
          </CardHeader>
        </Card>

        {guide.sections.map((section, i) => {
          const slug = sectionSlugs[i];
          return (
            <Card key={slug} id={slug} ref={(el) => { sectionRefs.current[slug] = el; }}>
              <CardHeader>
                <CardTitle>
                  <a
                    href={`#${slug}`}
                    className="hover:underline"
                    onClick={(e) => { e.preventDefault(); scrollToSection(slug); }}
                  >
                    {section.title}
                  </a>
                </CardTitle>
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
                        <button
                          type="button"
                          onClick={() => setSelectedImage(image)}
                          className="block w-full overflow-hidden rounded border bg-background transition hover:opacity-95"
                        >
                          <img src={image.src} alt={image.alt} className="w-full rounded object-contain" />
                        </button>
                        <figcaption className="text-xs text-muted-foreground">{image.alt}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-h-full w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-2 top-2 rounded bg-black/70 px-3 py-1 text-sm text-white"
              onClick={() => setSelectedImage(null)}
            >
              Close
            </button>
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-h-[90vh] w-full rounded object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
