import PageContainer from "../../components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

const GUIDE_BASE = `${import.meta.env.BASE_URL}guides/installation-assessment/`;

const sections = [
  {
    title: "Getting Access",
    steps: [
      "Open the Installation Assessment survey link.",
      "Continue past any security warning if prompted.",
      "Sign in with your work account.",
      "Confirm the assessment page loads successfully.",
    ],
    images: [
      { src: `${GUIDE_BASE}security-warning.png`, alt: "Security warning page" },
      { src: `${GUIDE_BASE}login.png`, alt: "Installation survey login" },
    ],
  },
  {
    title: "Starting Or Resuming Work",
    steps: [
      "Choose whether to start a new assessment or continue a draft.",
      "If resuming, open the correct draft from the list.",
      "Complete the installation details before scoring questions.",
    ],
    images: [
      { src: `${GUIDE_BASE}new-vs-draft.png`, alt: "New versus draft" },
      { src: `${GUIDE_BASE}draft-dropdown.png`, alt: "Draft dropdown" },
      { src: `${GUIDE_BASE}details-form.png`, alt: "Installation details form" },
    ],
  },
  {
    title: "Scoring The Assessment",
    steps: [
      "Move through the assessment sections and score each question from 1 to 5.",
      "Use the progress display to identify incomplete questions.",
      "Confirm worker details such as contractor or field team members before submission.",
    ],
    images: [
      { src: `${GUIDE_BASE}category-tabs.png`, alt: "Category tabs" },
      { src: `${GUIDE_BASE}score-buttons.png`, alt: "Score buttons" },
      { src: `${GUIDE_BASE}progress.png`, alt: "Progress section" },
    ],
  },
  {
    title: "Saving Or Submitting",
    steps: [
      "Save a draft if the assessment is not finished.",
      "Delete a draft only when it should be discarded.",
      "Submit when all required details and scores are complete.",
    ],
    images: [
      { src: `${GUIDE_BASE}save-draft.png`, alt: "Save draft" },
      { src: `${GUIDE_BASE}delete-draft.png`, alt: "Delete draft" },
      { src: `${GUIDE_BASE}submit-button.png`, alt: "Submit assessment" },
    ],
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
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
    </PageContainer>
  );
}
