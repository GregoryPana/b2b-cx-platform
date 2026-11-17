import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface DisclosureProps {
  summary: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

// Progressive disclosure on a native <details>: keyboard and screen-reader friendly with no state to manage.
export default function Disclosure({ summary, meta, defaultOpen = false, className, children }: DisclosureProps) {
  return (
    <details open={defaultOpen || undefined} className={cn("group rounded-lg border bg-card text-card-foreground", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{summary}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
          {meta}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}
