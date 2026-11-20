// One place for chart colours. Values are CSS variables so charts follow the theme (light and dark).
// Semantic colours carry meaning (good / needs attention / bad); series colours are categorical only.
export const CHART_SERIES = [1, 2, 3, 4, 5, 6].map((n) => `hsl(var(--chart-${n}))`);

export const CHART_SEMANTIC = {
  good: "hsl(var(--success))",
  goodSoft: "hsl(var(--success) / 0.65)",
  warning: "hsl(var(--warning))",
  bad: "hsl(var(--destructive))",
  badSoft: "hsl(var(--destructive) / 0.65)",
  neutral: "hsl(var(--chart-6))",
};
