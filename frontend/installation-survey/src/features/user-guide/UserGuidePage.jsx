import { useState } from "react";
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
      "Use the clipboard icon for Assessment and the book icon for User Guide.",
    ],
    images: [
      { src: `${GUIDE_BASE}security-warning.png`, alt: "Security warning page" },
      { src: `${GUIDE_BASE}login.png`, alt: "Installation survey login" },
    ],
  },
  {
    title: "Start an assessment",
    summary: "Use the Assessment page to record one completed installation job.",
    steps: [
      "Open Assessment from the left menu.",
      "Enter the Quality Assurance Inspector, work order, customer, location, work date, customer type and worker type.",
      "For Field Team work, add at least one team member. For Contractor work, select the contractor name.",
    ],
    notes: [
      "Check the work order and customer details before moving on.",
      "This version does not save installation assessments as drafts. Keep the page open until you submit.",
      "The Assessment page is the clipboard-icon page in the left menu.",
    ],
    images: [
      { src: `${GUIDE_BASE}details-form.png`, alt: "Installation details form" },
    ],
  },
  {
    title: "Score the assessment",
    summary: "Score every installation check using the range shown with that question.",
    steps: [
      "Read each installation question, then choose one score from its displayed range.",
      "Use the answered count to identify incomplete questions.",
      "Confirm worker details such as contractor or field team members before submission.",
    ],
    notes: [
      "The current Installation Assessment questions use a 1-to-5 scale. Follow the range displayed on the live question if it differs.",
      "Make sure the correct worker type is selected so reporting is accurate later.",
      "If Contractor is selected, use the correct contractor name from the list.",
      "The details section, category scoring area, progress section, and submit controls all work together on the same Assessment page.",
    ],
    images: [
      { src: `${GUIDE_BASE}category-tabs.png`, alt: "Category tabs" },
      { src: `${GUIDE_BASE}score-buttons.png`, alt: "Score buttons" },
      { src: `${GUIDE_BASE}progress.png`, alt: "Progress section" },
    ],
  },
  {
    title: "Submit the assessment",
    summary: "Submit only after all job details and question scores are complete and correct.",
    steps: [
      "Review the current overall score and any action points.",
      "Submit when all required details and scores are complete.",
    ],
    notes: [
      "Before submitting, check the work order, customer, worker details, and progress one last time.",
      "The Submit Survey button stays disabled until the required details and all question scores are complete.",
      "After submission, keep the reference number shown in the confirmation message.",
    ],
    images: [
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
      "The User Guide page is the book-icon page in the left menu.",
    ],
    images: [],
  },
];

export default function UserGuidePage() {
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <PageContainer>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Installation Assessment User Guide</CardTitle>
            <CardDescription>How to record job details, score installation checks and submit a completed assessment.</CardDescription>
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
        ))}

        {selectedImage ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedImage(null)}>
            <div className="relative max-h-full w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="absolute right-2 top-2 rounded bg-black/70 px-3 py-1 text-sm text-white"
                onClick={() => setSelectedImage(null)}
              >
                Close
              </button>
              <img src={selectedImage.src} alt={selectedImage.alt} className="max-h-[90vh] w-full rounded object-contain" />
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
