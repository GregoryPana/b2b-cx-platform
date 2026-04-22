import PageContainer from "../../components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

const GUIDE_BASE = `${import.meta.env.BASE_URL}guides/b2b-survey/`;

const sections = [
  {
    title: "Getting Access",
    summary: "Use this part when you first open the system or when you are unsure whether you are on the correct page.",
    steps: [
      "Open the B2B Survey link.",
      "If a security warning appears, choose Advanced and continue.",
      "Sign in with your work account.",
      "Confirm the Planned Visits page has loaded.",
    ],
    notes: [
      "If the page does not load correctly, refresh once before trying again.",
      "If you cannot sign in, stop and contact your administrator instead of using someone else’s account.",
    ],
    images: [
      { src: `${GUIDE_BASE}landing.png`, alt: "B2B survey landing" },
      { src: `${GUIDE_BASE}planned-visits-list.png`, alt: "B2B planned visits list" },
    ],
  },
  {
    title: "Starting A Survey",
    summary: "This is where you decide whether you are creating a new survey or continuing a saved draft.",
    steps: [
      "Open the correct planned visit.",
      "Choose whether to create a new survey or continue a draft.",
      "Complete the survey details before answering categories.",
    ],
    notes: [
      "Always check the business and date before opening the survey.",
      "If you already started the same visit earlier, continue the draft instead of starting again.",
    ],
    images: [
      { src: `${GUIDE_BASE}open-survey-action.png`, alt: "Open survey action" },
      { src: `${GUIDE_BASE}new-vs-draft.png`, alt: "New versus draft selector" },
      { src: `${GUIDE_BASE}survey-details.png`, alt: "Survey details form" },
    ],
  },
  {
    title: "Completing Questions",
    summary: "Work through the survey slowly. The system is easiest to use when you complete one category at a time.",
    steps: [
      "Move through each category and answer required questions.",
      "Use the progress tracker to confirm completion.",
      "Add notes where extra context is needed.",
    ],
    notes: [
      "Read each question fully before answering.",
      "Do not rely on memory if you can confirm the correct answer first.",
      "Use the progress section to find missing work before you try to submit.",
    ],
    images: [
      { src: `${GUIDE_BASE}category-question-area.png`, alt: "Category question area" },
      { src: `${GUIDE_BASE}progress-tracker.png`, alt: "Progress tracker" },
    ],
  },
  {
    title: "Saving Or Submitting",
    summary: "Save Draft protects unfinished work. Submit should only be used when the survey is complete and correct.",
    steps: [
      "Use Save Draft if you are not ready to finish.",
      "Submit only after all required items are complete.",
    ],
    notes: [
      "If you need to leave the page, save first.",
      "Do not submit just to finish later. If you are not finished, save the draft instead.",
    ],
    images: [
      { src: `${GUIDE_BASE}save-draft-button.png`, alt: "Save draft button" },
      { src: `${GUIDE_BASE}submit-button.png`, alt: "Submit button" },
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
