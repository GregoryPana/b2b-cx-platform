import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";

export function ScoringKeyCard({ compact = false }) {
  return (
    <Card className={compact ? "border-dashed" : "border-primary/15 shadow-sm"}>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className={compact ? "text-base" : undefined}>Scoring key — read before you start</CardTitle>
        <CardDescription>
          Questions use different answer types. For every numeric scale, the lowest number is always the worst
          experience and the highest number is always the best experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="font-semibold">1 – 5 scale</p>
            <p className="mt-1 text-muted-foreground">
              <strong>1 = lowest</strong> (very poor) · <strong>5 = highest</strong> (excellent).
              Used for most service-quality questions.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold">0 – 10 scale</p>
            <p className="mt-1 text-muted-foreground">
              <strong>0 = lowest</strong> (not at all likely / very poor) · <strong>10 = highest</strong> (extremely
              likely / excellent). Used for recommendation-style questions.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-semibold">Yes / No &amp; text</p>
            <p className="mt-1 text-muted-foreground">
              Yes/No questions record whether something happened. Text questions ask you to describe what you
              observed in your own words.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Each question shows its own scale on the answer buttons (for example 1–5 or 0–10), so the range to use is
          always visible while you answer. Score honestly based on what you actually experienced during the visit.
        </p>
      </CardContent>
    </Card>
  );
}

const GUIDE_SECTIONS = [
  {
    id: "guide-your-role",
    title: "1. Your role as a Mystery Shopper",
    body: [
      "You visit Cable & Wireless Seychelles customer service locations as a normal customer, observe the service you receive, and record your experience honestly in this platform.",
      "Your duty is accuracy: score what actually happened during the visit, not what you expected or what you think the team wants to hear. Your answers feed directly into customer-experience reporting and improvement plans.",
      "Staff must not know you are a mystery shopper during the visit. Complete the survey after the visit, as soon as possible while the details are fresh.",
    ],
  },
  {
    id: "guide-getting-access",
    title: "2. Getting access (one-time enrollment)",
    body: [
      "A CX administrator creates your account and sends you a personal enrollment link by email. You cannot register yourself — access is invitation-only.",
      "The enrollment link is single-use and expires. Opening it asks you to: (1) set your password, (2) link an authenticator app (Microsoft Authenticator, Google Authenticator, Authy or similar) by scanning a QR code, and (3) save your recovery codes — download them with the button provided and keep them somewhere private.",
      "If your link has expired, contact the administrator named in your invitation email to receive a new one.",
    ],
  },
  {
    id: "guide-signing-in",
    title: "3. Signing in (every time)",
    body: [
      "Connect to the company VPN first — the platform is only reachable over the VPN.",
      "Sign in with your email and password, then enter the current 6-digit code from your authenticator app. This two-step sign-in protects the platform and your account.",
      "Forgot your password or lost your authenticator? Choose \"Use a recovery code instead\" on the sign-in page and follow the steps — one recovery code lets you re-enroll with a new password and authenticator. If you have no recovery codes left, contact your CX administrator to reset your access.",
    ],
  },
  {
    id: "guide-starting-a-survey",
    title: "4. Starting a survey",
    body: [
      "After signing in, choose \"Start a new survey\" or resume an existing draft.",
      "Fill in the visit header: the location you visited, the visit date and time, the purpose of your visit, and the staff member on duty (if known). Your own name is filled in automatically from your account.",
      "Locations and visit purposes are managed by the CX administrators — if the location you visited is not in the list, do not guess: contact your administrator so it can be added, then complete the survey.",
      "Click \"Create / Load Visit\" to open the questionnaire. The visit is saved as a draft, so you can stop and come back later.",
    ],
    link: { label: "View your draft visits", tab: "planned" },
  },
  {
    id: "guide-answering-questions",
    title: "5. Answering the questions",
    body: [
      "Questions are grouped by section — use the sidebar to jump between sections. Read the scoring key (sidebar or above the questions): on every numeric scale the lowest number means the worst experience and the highest number means the best.",
      "Answer types: numeric scores (tap the number), Yes/No buttons, multiple choice, and free-text boxes for describing what you observed. Some questions are mandatory — the survey cannot be submitted until every mandatory question has a saved answer.",
      "Save each answer with its Save button as you go. Saved answers are stored on the server immediately, so nothing is lost if your connection drops.",
      "Use the comment/verbatim boxes to add context — specific details (what was said, how long you waited, what was unclear) make your assessment far more useful than a number alone.",
    ],
    link: { label: "Go to the survey", tab: "survey" },
  },
  {
    id: "guide-submitting",
    title: "6. Submitting and what happens next",
    body: [
      "When every mandatory question is answered, press Submit. The visit moves from Draft to Pending and is locked for your edits.",
      "A CX reviewer then checks your submission on the internal dashboard. They can approve it (it enters the official analytics and reports) or send it back / reject it if something needs attention.",
      "After submitting you can start your next visit. Your drafts list shows anything still in progress.",
    ],
  },
  {
    id: "guide-administrators",
    title: "7. What administrators do (so you know who to ask)",
    body: [
      "CX administrators work in a separate internal dashboard. They: create and email your enrollment link, reset your access if you lose your password/authenticator/recovery codes, suspend or reactivate accounts, maintain the list of locations and visit purposes you choose from, review and approve your submitted visits, and produce reports from the results.",
      "Contact your administrator when: your enrollment link expired, you cannot sign in and have no recovery codes, a location or purpose is missing, or you submitted a visit by mistake and need it returned.",
      "The administrator's contact email is included in your invitation email.",
    ],
  },
  {
    id: "guide-account-safety",
    title: "8. Good practice and account safety",
    body: [
      "Complete the survey the same day as the visit while details are fresh.",
      "Never share your password, authenticator codes, recovery codes, or enrollment link with anyone — administrators will never ask for them.",
      "Your recovery codes are single-use; keep the downloaded file somewhere private (for example a password manager).",
      "Sign out when you finish, especially on a shared device.",
    ],
  },
];

export function GuidePage({ onNavigateToTab }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Mystery Shopper User Guide</CardTitle>
          <CardDescription>
            Everything you need to use this platform from start to finish: your role, getting access, signing in,
            completing surveys, and who to contact when you need help.
          </CardDescription>
        </CardHeader>
      </Card>

      <ScoringKeyCard compact />

      {GUIDE_SECTIONS.map((section) => (
        <Card key={section.id} id={section.id}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {section.body.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {section.link && onNavigateToTab ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateToTab(section.link.tab, section.id)}
              >
                {section.link.label}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
