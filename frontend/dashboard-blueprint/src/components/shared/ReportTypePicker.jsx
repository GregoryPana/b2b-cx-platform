import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

// One responsive choice control for "which report?" - replaces the phone pill row plus the
// desktop grid of four cards that each carried their own "Use X" button. Selecting a tile is the action.
export default function ReportTypePicker({ options, value, onSelect, label = "Report type" }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option.key)}
            className={cn(
              "flex h-full flex-col gap-1 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-accent/50",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{option.label}</span>
              {selected ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
            </span>
            {option.description ? <span className="text-xs text-muted-foreground">{option.description}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
