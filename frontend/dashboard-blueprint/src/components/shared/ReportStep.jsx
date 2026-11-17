// A numbered step in the report builder. Flat on purpose: the old builder nested a tinted box,
// a bordered section, and a card per option, so every control sat inside three borders.
export default function ReportStep({ number, title, hint, children }) {
  return (
    <section className="space-y-4" aria-labelledby={`report-step-${number}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">{number}</span>
        <div className="min-w-0">
          <h3 id={`report-step-${number}`} className="text-base font-semibold tracking-tight">{title}</h3>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      <div className="space-y-4 md:pl-9">{children}</div>
    </section>
  );
}
