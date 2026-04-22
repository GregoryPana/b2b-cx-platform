import PageContainer from "../../components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

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
      { src: "/guides/installation-assessment/security-warning.png", alt: "Security warning page" },
      { src: "/guides/installation-assessment/login.png", alt: "Installation survey login" },
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
      { src: "/guides/installation-assessment/new-vs-draft.png", alt: "New versus draft" },
      { src: "/guides/installation-assessment/draft-dropdown.png", alt: "Draft dropdown" },
      { src: "/guides/installation-assessment/details-form.png", alt: "Installation details form" },
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
      { src: "/guides/installation-assessment/category-tabs.png", alt: "Category tabs" },
      { src: "/guides/installation-assessment/score-buttons.png", alt: "Score buttons" },
      { src: "/guides/installation-assessment/progress.png", alt: "Progress section" },
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
      { src: "/guides/installation-assessment/save-draft.png", alt: "Save draft" },
      { src: "/guides/installation-assessment/delete-draft.png", alt: "Delete draft" },
      { src: "/guides/installation-assessment/submit-button.png", alt: "Submit assessment" },
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
