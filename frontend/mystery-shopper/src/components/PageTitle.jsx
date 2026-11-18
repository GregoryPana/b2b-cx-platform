// One h1 per screen at the standard product size (DESIGN_SYSTEM.md: text-2xl, md:text-3xl).
export default function PageTitle({ title, description }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
