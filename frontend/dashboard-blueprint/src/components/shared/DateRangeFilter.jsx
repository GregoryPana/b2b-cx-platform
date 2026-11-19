import Disclosure from "./Disclosure";
import Field from "./Field";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

function formatDay(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function describeDateRange(from, to) {
  if (from && to) return from === to ? `On ${formatDay(from)}` : `${formatDay(from)} to ${formatDay(to)}`;
  if (from) return `From ${formatDay(from)}`;
  if (to) return `Up to ${formatDay(to)}`;
  return "All dates";
}

// Inclusive date range on the visit date. The same date in both fields shows a single day.
export default function DateRangeFilter({ from, to, invalid, onChange, className }) {
  const active = Boolean(from || to);
  return (
    <Disclosure
      className={className}
      summary="Filter by date"
      meta={invalid ? "Check the dates" : describeDateRange(from, to)}
      defaultOpen={active}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="From date" hint="Use the same date in both fields to see a single day.">
          <Input type="date" value={from} max={to || undefined} onChange={(event) => onChange({ from: event.target.value, to })} />
        </Field>
        <Field label="To date">
          <Input type="date" value={to} min={from || undefined} onChange={(event) => onChange({ from, to: event.target.value })} />
        </Field>
        <Button type="button" variant="outline" disabled={!active} onClick={() => onChange({ from: "", to: "" })}>
          Clear dates
        </Button>
      </div>
      {invalid ? (
        <p className="text-sm text-destructive" role="alert">The From date is after the To date, so no date filter is applied. Fix one of the dates.</p>
      ) : null}
    </Disclosure>
  );
}
