import { describeDateRange } from "./DateRangeFilter";

// One muted line under a chart title that says what the chart is drawn from (design system 6.2).
export function chartScopeText({ dateFrom, dateTo, businessCount = 0, locationCount = 0 }) {
  const parts = [];
  parts.push(dateFrom || dateTo ? describeDateRange(dateFrom, dateTo) : "All dates");
  if (businessCount > 0) parts.push(`${businessCount} business${businessCount === 1 ? "" : "es"}`);
  if (locationCount > 0) parts.push(`${locationCount} location${locationCount === 1 ? "" : "s"}`);
  if (!businessCount && !locationCount) parts.push("all businesses and locations");
  return parts.join(" · ");
}

export default function ChartScope({ text }) {
  return <p className="mt-1 text-xs text-muted-foreground">Showing: {text}</p>;
}
