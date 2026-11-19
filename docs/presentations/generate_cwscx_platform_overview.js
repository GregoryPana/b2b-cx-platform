const path = require("path");
const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenCode";
pptx.company = "Cable and Wireless Seychelles";
pptx.subject = "CX Platform overview";
pptx.title = "CX Platform Overview";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US",
};

const COLORS = {
  navy: "143B63",
  blue: "2E75B6",
  lightBlue: "EAF3FB",
  slate: "334155",
  muted: "667085",
  border: "D8E1EB",
  soft: "F7F9FC",
  white: "FFFFFF",
  green: "0F9D58",
  amber: "B7791F",
};

const ROOT = path.resolve(__dirname, "../..");
const assets = {
  logo: path.join(ROOT, "Cable-and-Wireless-Seychelles.png"),
  b2b: path.join(ROOT, "frontend/shared-assets/branding/platforms/b2b.png"),
  mystery: path.join(ROOT, "frontend/shared-assets/branding/platforms/mystery-shopper.png"),
  install: path.join(ROOT, "frontend/shared-assets/branding/platforms/installation-assessment.png"),
  dashboardAnalytics: path.join(ROOT, "frontend/user-guides/images/dashboard-b2b/analytics.png"),
  plannedVisits: path.join(ROOT, "frontend/user-guides/images/dashboard-b2b/planned-visits.png"),
  mysteryLanding: path.join(ROOT, "frontend/user-guides/images/dashboard-mystery-shopper/landing.png"),
  installationLanding: path.join(ROOT, "frontend/user-guides/images/dashboard-installation/landing.png"),
};

function addHeader(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.45, y: 0.2, w: 9.1, h: 0.5,
    fontFace: "Aptos Display", fontSize: 24, bold: true, color: COLORS.navy,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.45, y: 0.7, w: 9.0, h: 0.25,
      fontFace: "Aptos", fontSize: 10, color: COLORS.muted,
      margin: 0,
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.45, y: 0.98, w: 8.9, h: 0,
    line: { color: COLORS.border, pt: 1.2 },
  });
}

function addFooter(slide, text = "Source: CX Platform repository, operational documentation, and internal screenshots (May 2026)") {
  slide.addText(text, {
    x: 0.45, y: 5.28, w: 9.0, h: 0.16,
    fontFace: "Aptos", fontSize: 8, color: COLORS.muted, align: "left",
    margin: 0,
  });
}

function addBulletList(slide, items, x, y, w, h, fontSize = 17, color = COLORS.slate, paraSpaceAfterPt = 10) {
  slide.addText(items.map((item) => ({ text: item, options: { bullet: { indent: 14 } } })), {
    x, y, w, h,
    fontFace: "Aptos",
    fontSize,
    color,
    breakLine: true,
    paraSpaceAfterPt,
    margin: 0,
    valign: "top",
  });
}

function addRoundedCard(slide, x, y, w, h, fill = COLORS.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: COLORS.border, pt: 1 },
    shadow: { type: "outer", color: "C7D2E0", angle: 45, blur: 2, distance: 1, opacity: 0.12 },
  });
}

// Slide 1: Title
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.soft };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: COLORS.soft }, line: { color: COLORS.soft, pt: 0 } });
  slide.addImage({ path: assets.logo, x: 0.6, y: 0.45, w: 0.85, h: 0.85, contain: true });
  slide.addText("CX Platform gives one operating platform for customer experience surveys, governance, review, and reporting", {
    x: 0.6, y: 1.0, w: 8.7, h: 1.05,
    fontFace: "Aptos Display", fontSize: 24, bold: true, color: COLORS.navy,
    margin: 0,
  });
  slide.addText("A platform overview for new users, business leaders, and operational teams", {
    x: 0.6, y: 2.15, w: 7.5, h: 0.3,
    fontFace: "Aptos", fontSize: 15, color: COLORS.muted,
    margin: 0,
  });
  slide.addText("Cable and Wireless Seychelles | Digital Transformation Office | May 2026", {
    x: 0.6, y: 2.55, w: 6.6, h: 0.2,
    fontFace: "Aptos", fontSize: 10, color: COLORS.muted,
    margin: 0,
  });

  const cards = [
    { x: 0.6, icon: assets.b2b, title: "B2B Survey", text: "Planned visits, relationship feedback, and follow-up actions." },
    { x: 3.18, icon: assets.install, title: "Installation Assessment", text: "Quality checks, scoring, and operational auditability." },
    { x: 5.76, icon: assets.mystery, title: "Mystery Shopper", text: "Service-centre assessment, review workflow, and location reporting." },
  ];
  cards.forEach((card) => {
    addRoundedCard(slide, card.x, 3.0, 2.35, 1.7, COLORS.white);
    slide.addImage({ path: card.icon, x: card.x + 0.15, y: 3.2, w: 0.48, h: 0.48, contain: true });
    slide.addText(card.title, { x: card.x + 0.7, y: 3.18, w: 1.45, h: 0.25, fontSize: 13, bold: true, color: COLORS.navy, margin: 0 });
    slide.addText(card.text, { x: card.x + 0.15, y: 3.75, w: 2.0, h: 0.74, fontSize: 10.5, color: COLORS.slate, margin: 0 });
  });
  addFooter(slide);
}

// Slide 2: What it is
{
  const slide = pptx.addSlide();
  addHeader(slide, "CX Platform combines four user journeys into one controlled customer-experience operating platform", "What the platform is and why it exists");
  addRoundedCard(slide, 0.45, 1.12, 4.25, 4.0, COLORS.white);
  slide.addText("In simple terms", { x: 0.7, y: 1.38, w: 1.8, h: 0.25, fontSize: 15, bold: true, color: COLORS.blue, margin: 0 });
  addBulletList(slide, [
    "CWSCX helps teams collect survey information, review it, and turn it into usable insight.",
    "It supports several programmes inside one platform instead of separate disconnected tools.",
    "It is built for day-to-day operational use, not just one-off reporting.",
    "It reduces manual chasing, fragmented spreadsheets, and inconsistent review practices.",
  ], 0.72, 1.76, 3.6, 3.0, 15, COLORS.slate, 8);

  addRoundedCard(slide, 4.95, 1.12, 4.45, 4.0, COLORS.lightBlue);
  slide.addText("Business value", { x: 5.2, y: 1.38, w: 1.8, h: 0.25, fontSize: 15, bold: true, color: COLORS.blue, margin: 0 });
  addBulletList(slide, [
    "Creates one source of truth for survey capture, review status, and reporting.",
    "Makes it easier for admins to monitor outstanding work and validate submissions.",
    "Supports trend analysis across businesses, installations, and service centre experiences.",
    "Provides a platform that can evolve into controlled public-facing survey access where needed.",
  ], 5.15, 1.76, 3.8, 3.0, 15, COLORS.slate, 8);
  addFooter(slide);
}

// Slide 3: modules
{
  const slide = pptx.addSlide();
  addHeader(slide, "Three survey frontends and one governance dashboard cover the full customer-experience workflow", "Main modules and who they serve");
  const blocks = [
    { x: 0.45, y: 1.18, w: 2.15, h: 1.68, icon: assets.b2b, title: "B2B Survey", body: ["Used by surveyors and representatives", "Captures planned visits and action points"] },
    { x: 2.67, y: 1.18, w: 2.15, h: 1.68, icon: assets.install, title: "Installation Assessment", body: ["Used for quality assurance checks", "Scores field or contractor work"] },
    { x: 4.89, y: 1.18, w: 2.15, h: 1.68, icon: assets.mystery, title: "Mystery Shopper", body: ["Used for service-centre evaluation", "Supports review and location reporting"] },
    { x: 7.11, y: 1.18, w: 2.15, h: 1.68, icon: assets.logo, title: "Governance Dashboard", body: ["Used by admins and reviewers", "Shows analytics, queues, and management screens"] },
  ];
  blocks.forEach((b) => {
    addRoundedCard(slide, b.x, b.y, b.w, b.h, COLORS.white);
    slide.addImage({ path: b.icon, x: b.x + 0.12, y: b.y + 0.15, w: 0.38, h: 0.38, contain: true });
    slide.addText(b.title, { x: b.x + 0.58, y: b.y + 0.16, w: 1.3, h: 0.22, fontSize: 12, bold: true, color: COLORS.navy, margin: 0 });
    addBulletList(slide, b.body, b.x + 0.16, b.y + 0.55, b.w - 0.3, 0.9, 10.5, COLORS.slate, 6);
  });

  slide.addText("The dashboard and survey frontends are separate experiences, but they share one backend, one data model, and one operational control approach.", {
    x: 0.55, y: 3.0, w: 8.8, h: 0.42, fontSize: 15, color: COLORS.slate, margin: 0,
  });

  slide.addImage({ path: assets.dashboardAnalytics, x: 0.55, y: 3.48, w: 2.82, h: 1.58 });
  slide.addImage({ path: assets.plannedVisits, x: 3.53, y: 3.48, w: 2.82, h: 1.58 });
  slide.addImage({ path: assets.mysteryLanding, x: 6.5, y: 3.48, w: 2.82, h: 1.58 });
  addFooter(slide);
}

// Slide 4: Flow
{
  const slide = pptx.addSlide();
  addHeader(slide, "Users follow a simple flow from preparing visits to submitting and reviewing them", "How the platform works day to day");
  const steps = [
    "Prepare or open a survey",
    "Capture responses and notes",
    "Submit for review",
    "Review and approve",
    "Use analytics and reports",
  ];
  steps.forEach((step, idx) => {
    const x = 0.5 + idx * 1.85;
    addRoundedCard(slide, x, 1.82, 1.55, 1.22, idx % 2 === 0 ? COLORS.white : COLORS.lightBlue);
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.06, y: 1.94, w: 0.28, h: 0.28, fill: { color: COLORS.blue }, line: { color: COLORS.blue, pt: 0 } });
    slide.addText(String(idx + 1), { x: x + 0.06, y: 1.96, w: 0.28, h: 0.14, fontSize: 10, bold: true, color: COLORS.white, align: "center", margin: 0 });
    slide.addText(step, { x: x + 0.18, y: 1.99, w: 1.12, h: 0.56, fontSize: 13, bold: true, color: COLORS.navy, margin: 0, align: "center" });
    if (idx < steps.length - 1) {
      slide.addShape(pptx.ShapeType.chevron, { x: x + 1.57, y: 2.33, w: 0.22, h: 0.22, fill: { color: COLORS.blue }, line: { color: COLORS.blue, pt: 0 } });
    }
  });
  addBulletList(slide, [
    "Survey users do not need to understand the full platform to complete their tasks.",
    "Reviewers work from queues and detail views rather than ad hoc email follow-up.",
    "Leaders and managers see trends, completion state, and operational outcomes in the dashboard.",
  ], 0.7, 3.42, 8.5, 1.45, 15);
  addFooter(slide);
}

// Slide 5 Roles
{
  const slide = pptx.addSlide();
  addHeader(slide, "The platform separates tasks clearly by role so new users can adopt it quickly", "Who uses CWSCX and what they do");
  const cols = [
    { x: 0.5, title: "Surveyor / Representative", color: COLORS.lightBlue, bullets: ["Creates or continues planned visits", "Captures responses and action items", "Submits surveys for review"] },
    { x: 3.35, title: "Admin / Reviewer", color: COLORS.white, bullets: ["Reviews pending submissions", "Manages businesses, locations, and support data", "Uses reports and analytics to monitor outcomes"] },
    { x: 6.2, title: "Platform Owner / Ops", color: COLORS.lightBlue, bullets: ["Oversees deployment and health", "Monitors backups and observability", "Coordinates future platform improvements"] },
  ];
  cols.forEach((col) => {
    addRoundedCard(slide, col.x, 1.28, 2.5, 3.7, col.color);
    slide.addText(col.title, { x: col.x + 0.18, y: 1.55, w: 2.1, h: 0.55, fontSize: 16, bold: true, color: COLORS.navy, margin: 0, align: "center" });
    addBulletList(slide, col.bullets, col.x + 0.18, 2.28, 2.05, 2.35, 13, COLORS.slate, 8);
  });
  addFooter(slide);
}

// Slide 6 architecture
{
  const slide = pptx.addSlide();
  addHeader(slide, "A single-domain internal deployment keeps the user journey simple while centralising control", "Current internal architecture");
  const boxes = [
    { x: 0.6, y: 2.1, w: 1.6, h: 0.85, label: "Users\n(Browser)", fill: COLORS.lightBlue },
    { x: 2.7, y: 1.65, w: 2.1, h: 1.75, label: "NGINX\n/dashboard\n/surveys/*\n/api/*", fill: COLORS.white },
    { x: 5.25, y: 1.65, w: 1.9, h: 1.75, label: "FastAPI Backend\nBusiness logic\nReview & analytics", fill: COLORS.white },
    { x: 7.55, y: 1.9, w: 1.6, h: 1.2, label: "PostgreSQL 16\nShared platform data", fill: COLORS.lightBlue },
  ];
  boxes.forEach((b) => {
    addRoundedCard(slide, b.x, b.y, b.w, b.h, b.fill);
    slide.addText(b.label, { x: b.x + 0.08, y: b.y + 0.18, w: b.w - 0.16, h: b.h - 0.2, fontSize: 16, bold: true, color: COLORS.navy, align: "center", valign: "mid", margin: 0 });
  });
  slide.addShape(pptx.ShapeType.chevron, { x: 2.25, y: 2.35, w: 0.28, h: 0.28, fill: { color: COLORS.blue }, line: { color: COLORS.blue, pt: 0 } });
  slide.addShape(pptx.ShapeType.chevron, { x: 4.95, y: 2.35, w: 0.28, h: 0.28, fill: { color: COLORS.blue }, line: { color: COLORS.blue, pt: 0 } });
  slide.addShape(pptx.ShapeType.chevron, { x: 7.15, y: 2.35, w: 0.28, h: 0.28, fill: { color: COLORS.blue }, line: { color: COLORS.blue, pt: 0 } });
  addBulletList(slide, [
    "The internal platform currently uses one domain and path-based routing to keep access simple for staff.",
    "Governance dashboard and survey applications are separate frontends, but they rely on the same backend and data foundation.",
    "This model is strong for internal users, but it is not appropriate for unauthenticated public external access.",
  ], 0.7, 3.8, 8.55, 1.2, 14, COLORS.slate, 8);
  addFooter(slide, "Source: README.md, EXIT.md, deployment-topology.md, handover guide (May 2026)");
}

// Slide 7 operations
{
  const slide = pptx.addSlide();
  addHeader(slide, "Monitoring, backups, and controlled deployments reduce operational risk", "What supports reliability today");
  const cards = [
    { x: 0.55, title: "Controlled Deployment", bullets: ["GitHub Actions with self-hosted runners", "Manual staging and production triggers", "Release bundles retained for rollback"] },
    { x: 3.4, title: "Operational Monitoring", bullets: ["Health and readiness endpoints", "Uptime Kuma monitors and status pages", "pgAdmin access from observability VM"] },
    { x: 6.25, title: "Data Protection", bullets: ["PostgreSQL backups on schedule", "Restore readiness and verification checks", "Migration-upgrade-only deploy discipline"] },
  ];
  cards.forEach((c) => {
    addRoundedCard(slide, c.x, 1.38, 2.55, 3.35, COLORS.white);
    slide.addText(c.title, { x: c.x + 0.18, y: 1.66, w: 2.15, h: 0.35, fontSize: 16, bold: true, color: COLORS.navy, align: "center", margin: 0 });
    addBulletList(slide, c.bullets, c.x + 0.18, 2.12, 2.12, 2.3, 13, COLORS.slate, 8);
  });
  addFooter(slide);
}

// Slide 8 Public mystery
{
  const slide = pptx.addSlide();
  addHeader(slide, "Mystery Shopper is moving to a separate DMZ deployment while the internal platform stays protected", "Next-phase public access architecture");
  addRoundedCard(slide, 0.55, 1.45, 4.1, 3.2, COLORS.white);
  slide.addText("Current state", { x: 0.8, y: 1.72, w: 1.6, h: 0.3, fontSize: 16, bold: true, color: COLORS.blue, margin: 0 });
  addBulletList(slide, [
    "Mystery Shopper currently sits inside the internal CX Platform path.",
    "Internal Entra-based access works for staff, but not for external users.",
    "The internal platform should not be opened broadly just to make one survey public.",
  ], 0.82, 2.08, 3.4, 1.82, 14, COLORS.slate, 8);
  slide.addText("Current internal production VM: `cwscx-app01.cwsey.com`", { x: 0.82, y: 4.0, w: 3.2, h: 0.22, fontSize: 10, color: COLORS.muted, margin: 0 });

  addRoundedCard(slide, 5.0, 1.45, 4.15, 3.2, COLORS.lightBlue);
  slide.addText("Next state", { x: 5.25, y: 1.72, w: 1.6, h: 0.3, fontSize: 16, bold: true, color: COLORS.blue, margin: 0 });
  addBulletList(slide, [
    "A separate DMZ VM will host the public Mystery Shopper frontend and backend path.",
    "Internal dashboard and other internal frontends remain on the internal environment.",
    "The public Mystery path will connect inward only to approved backend and database services.",
  ], 5.25, 2.08, 3.45, 1.82, 14, COLORS.slate, 8);
  slide.addText("Target DMZ VM: `cwscx-web01.cwsey.com` | `172.17.0.200`", { x: 5.25, y: 4.0, w: 3.4, h: 0.22, fontSize: 10, color: COLORS.muted, margin: 0 });
  addFooter(slide, "Source: MYSTERY_PUBLIC_DMZ_SETUP.md and current deployment docs (May 2026)");
}

// Slide 9 auth options
{
  const slide = pptx.addSlide();
  addHeader(slide, "Signed links, OTP, and link-plus-OTP each trade user friction against access control", "Public Mystery Shopper access options");
  addRoundedCard(slide, 0.55, 1.45, 8.9, 3.45, COLORS.white);
  slide.addText("Recommended comparison", { x: 0.8, y: 1.64, w: 2.0, h: 0.25, fontSize: 15, bold: true, color: COLORS.blue, margin: 0 });
  slide.addTable([
    [{ text: "Option" }, { text: "User friction" }, { text: "Security assurance" }, { text: "Best fit" }],
    ["Signed invitation link", "Low", "Medium", "Fastest and simplest invited access"],
    ["OTP login", "Medium", "Higher", "Stronger verification with no permanent account"],
    ["Signed link + OTP", "Medium-high", "Highest of the three", "Invitation-only access with stronger control"],
  ], {
    x: 0.82, y: 1.96, w: 8.3, h: 1.75,
    border: { type: "solid", color: COLORS.border, pt: 1 },
    fill: COLORS.white,
    color: COLORS.slate,
    fontFace: "Aptos",
    fontSize: 11,
    rowH: 0.38,
    bold: true,
    colW: [2.1, 1.4, 1.7, 3.1],
    autoFit: false,
    valign: "mid",
    margin: 0.04,
  });
  addBulletList(slide, [
    "The strongest balance for this use case may be invitation link plus OTP, especially if forwarded-link risk matters.",
    "The team has intentionally deferred Entra external-user decisions for a later stage because that introduces more management overhead.",
  ], 0.85, 4.02, 8.1, 0.96, 14, COLORS.slate, 8);
  addFooter(slide, "Source: MYSTERY_PUBLIC_AUTH_OPTIONS.md (May 2026)");
}

// Slide 10 conclusion
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.navy };
  slide.addText("Conclusions", { x: 0.5, y: 0.28, w: 2.5, h: 0.3, fontSize: 18, color: "A7C4E0", margin: 0 });
  slide.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.68, w: 8.9, h: 0, line: { color: COLORS.blue, pt: 1.5 } });
  slide.addText([
    { text: "1. CX Platform already provides a usable internal operating platform for survey capture, review, analytics, and reporting.", options: { breakLine: true } },
    { text: "2. The platform is understandable to different user groups because survey tasks, review tasks, and operational controls are separated clearly.", options: { breakLine: true } },
    { text: "3. Mystery Shopper now needs a separate public deployment path so external access does not weaken the internal platform boundary.", options: { breakLine: true } },
    { text: "4. The next key decision is the public Mystery Shopper access model, with signed link plus OTP looking like the strongest balanced option so far.", options: { breakLine: true } },
  ], {
    x: 0.62, y: 0.95, w: 8.4, h: 3.4,
    fontFace: "Aptos", fontSize: 20, color: COLORS.white,
    breakLine: true, paraSpaceAfterPt: 18, margin: 0,
  });
  slide.addText("Discussion points: public access decision, DMZ publication, runner connectivity, and final operating model", {
    x: 0.62, y: 4.7, w: 8.4, h: 0.35,
    fontFace: "Aptos", fontSize: 13, color: "C8D8EA", margin: 0,
  });
}

const outputPath = path.join(__dirname, "CWSCX_Platform_Overview.pptx");
pptx.writeFile({ fileName: outputPath });
console.log(`Wrote ${outputPath}`);
