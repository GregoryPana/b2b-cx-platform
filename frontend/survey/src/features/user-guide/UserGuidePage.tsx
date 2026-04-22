import PageContainer from "../../components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

const sections = [
  {
    title: "Getting Access",
    steps: [
      "Open the B2B Survey link.",
      "If a security warning appears, choose Advanced and continue.",
      "Sign in with your work account.",
      "Confirm the Planned Visits page has loaded.",
    ],
    images: [
      { src: "/guides/b2b-survey/landing.png", alt: "B2B survey landing" },
      { src: "/guides/b2b-survey/planned-visits-list.png", alt: "B2B planned visits list" },
    ],
  },
  {
    title: "Starting A Survey",
    steps: [
      "Open the correct planned visit.",
      "Choose whether to create a new survey or continue a draft.",
      "Complete the survey details before answering categories.",
    ],
    images: [
      { src: "/guides/b2b-survey/open-survey-action.png", alt: "Open survey action" },
      { src: "/guides/b2b-survey/new-vs-draft.png", alt: "New versus draft selector" },
      { src: "/guides/b2b-survey/survey-details.png", alt: "Survey details form" },
    ],
  },
  {
    title: "Completing Questions",
    steps: [
      "Move through each category and answer required questions.",
      "Use the progress tracker to confirm completion.",
      "Add notes where extra context is needed.",
    ],
    images: [
      { src: "/guides/b2b-survey/category-question-area.png", alt: "Category question area" },
      { src: "/guides/b2b-survey/progress-tracker.png", alt: "Progress tracker" },
    ],
  },
  {
    title: "Saving Or Submitting",
    steps: [
      "Use Save Draft if you are not ready to finish.",
      "Submit only after all required items are complete.",
    ],
    images: [
      { src: "/guides/b2b-survey/save-draft-button.png", alt: "Save draft button" },
      { src: "/guides/b2b-survey/submit-button.png", alt: "Submit button" },
    ],
  },
];

export default function UserGuidePage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>B2B Survey User Guide</CardTitle>
            <CardDescription>Step-by-step guidance for using the B2B survey frontend.</CardDescription>
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
