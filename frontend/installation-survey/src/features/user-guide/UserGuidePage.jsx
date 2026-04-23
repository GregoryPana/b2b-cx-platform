import PageContainer from "../../components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

const GUIDE_BASE = `${import.meta.env.BASE_URL}guides/installation-assessment/`;

const sections = [
  {
    title: "Getting Access",
    summary: "Use this section when first opening the installation survey or when you need to confirm you are in the right place.",
    steps: [
      "Open the Installation Assessment survey link.",
      "Continue past any security warning if prompted.",
      "Sign in with your work account.",
      "Confirm the assessment page loads successfully.",
    ],
    notes: [
      "Wait for the page to finish loading before you start entering information.",
      "If access fails, contact your administrator instead of trying to work around the login process.",
    ],
    images: [
      { src: `${GUIDE_BASE}security-warning.png`, alt: "Security warning page" },
      { src: `${GUIDE_BASE}login.png`, alt: "Installation survey login" },
    ],
  },
  {
    title: "Starting Or Resuming Work",
    summary: "Choose New when you are starting fresh and Draft when you are continuing saved work.",
    steps: [
      "Choose whether to start a new assessment or continue a draft.",
      "If resuming, open the correct draft from the list.",
      "Complete the installation details before scoring questions.",
    ],
    notes: [
      "If you pick the wrong draft, you may continue the wrong job record.",
      "Check the work order and customer details before moving on.",
    ],
    images: [
      { src: `${GUIDE_BASE}new-vs-draft.png`, alt: "New versus draft" },
      { src: `${GUIDE_BASE}draft-dropdown.png`, alt: "Draft dropdown" },
      { src: `${GUIDE_BASE}details-form.png`, alt: "Installation details form" },
    ],
  },
  {
    title: "Scoring The Assessment",
    summary: "This is where you score the installation quality from 1 to 5 and make sure each required question is complete.",
    steps: [
      "Move through the assessment sections and score each question from 1 to 5.",
      "Use the progress display to identify incomplete questions.",
      "Confirm worker details such as contractor or field team members before submission.",
    ],
    notes: [
      "Use the full 1 to 5 scale carefully and consistently.",
      "Make sure the correct worker type is selected so reporting is accurate later.",
      "If Contractor is selected, use the correct contractor name from the list.",
    ],
    images: [
      { src: `${GUIDE_BASE}category-tabs.png`, alt: "Category tabs" },
      { src: `${GUIDE_BASE}score-buttons.png`, alt: "Score buttons" },
      { src: `${GUIDE_BASE}progress.png`, alt: "Progress section" },
    ],
  },
  {
    title: "Saving Or Submitting",
    summary: "Save a draft when you still need time. Submit only when the full assessment is correct and complete.",
    steps: [
      "Save a draft if the assessment is not finished.",
      "Delete a draft only when it should be discarded.",
      "Submit when all required details and scores are complete.",
    ],
    notes: [
      "Deleting a draft removes unfinished work, so do this only when you are certain.",
      "Before submitting, check the work order, customer, worker details, and progress one last time.",
    ],
    images: [
      { src: `${GUIDE_BASE}save-draft.png`, alt: "Save draft" },
      { src: `${GUIDE_BASE}delete-draft.png`, alt: "Delete draft" },
      { src: `${GUIDE_BASE}submit-button.png`, alt: "Submit assessment" },
    ],
  },
  {
    title: "Using The User Guide Page",
    summary: "Open the guide whenever you need help understanding what the page is for or what to do next.",
    steps: [
      "Open User Guide from the left menu.",
      "Read the section that matches the part of the assessment you are using.",
      "Return to the assessment page from the left menu when you are ready to continue.",
    ],
    notes: [
      "This guide is meant to support live work, not only training.",
      "If you are unsure what a button does, use the guide first before trying random options.",
    ],
    images: [],
  },
];

export default function UserGuidePage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Installation Assessment User Guide</CardTitle>
            <CardDescription>How to use the installation survey frontend, including the updated worker details flow.</CardDescription>
          </CardHeader>
        </Card>

        {sections.map((section) => (
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
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
    </PageContainer>
  );
}
