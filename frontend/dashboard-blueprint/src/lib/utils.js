import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const TRAFFIC_LIGHT_CLASSES = {
  good: {
    card: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/80 dark:bg-emerald-950/20",
    value: "text-emerald-700 dark:text-emerald-300",
    badge: "border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-200",
    accent: "bg-emerald-500",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/80 dark:border-amber-900/80 dark:bg-amber-950/20",
    value: "text-amber-700 dark:text-amber-300",
    badge: "border border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200",
    accent: "bg-amber-500",
  },
  bad: {
    card: "border-rose-200 bg-rose-50/80 dark:border-rose-900/80 dark:bg-rose-950/20",
    value: "text-rose-700 dark:text-rose-300",
    badge: "border border-rose-200 bg-rose-100 text-rose-900 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-200",
    accent: "bg-rose-500",
  },
  neutral: {
    card: "",
    value: "",
    badge: "border border-border bg-muted text-muted-foreground",
    accent: "bg-muted-foreground",
  },
};

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const numeric = Number(String(value).replace(/%/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

export function getTrafficLightMetric(metric, value) {
  const numericValue = toFiniteNumber(value);
  if (!metric || numericValue == null) {
    return {
      tone: "neutral",
      label: "No data",
      numericValue,
      ...TRAFFIC_LIGHT_CLASSES.neutral,
    };
  }

  let tone = "neutral";
  let label = "No data";

  if (metric === "b2b_nps") {
    if (numericValue >= 50) {
      tone = "good";
      label = "Healthy";
    } else if (numericValue >= 0) {
      tone = "warning";
      label = "Watch";
    } else {
      tone = "bad";
      label = "Needs attention";
    }
  } else if (metric === "b2b_csat" || metric === "b2b_relationship") {
    if (numericValue >= 80) {
      tone = "good";
      label = "Healthy";
    } else if (numericValue >= 60) {
      tone = "warning";
      label = "Watch";
    } else {
      tone = "bad";
      label = "Needs attention";
    }
  } else if (metric === "b2b_competitive_exposure") {
    if (numericValue <= 20) {
      tone = "good";
      label = "Low exposure";
    } else if (numericValue <= 40) {
      tone = "warning";
      label = "Moderate exposure";
    } else {
      tone = "bad";
      label = "High exposure";
    }
  } else if (metric === "installation_average") {
    if (numericValue >= 4) {
      tone = "good";
      label = "Pass";
    } else if (numericValue >= 3) {
      tone = "warning";
      label = "Watch";
    } else {
      tone = "bad";
      label = "Fail";
    }
  }

  return {
    tone,
    label,
    numericValue,
    ...TRAFFIC_LIGHT_CLASSES[tone],
  };
}
