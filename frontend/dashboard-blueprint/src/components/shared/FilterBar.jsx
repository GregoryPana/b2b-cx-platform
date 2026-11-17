import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import Disclosure from "./Disclosure";

// The two or three filters people use every time sit in `children`; the rest go in `more`, collapsed,
// with a count of how many are active so a hidden filter is never a surprise.
export default function FilterBar({ children, more, moreActiveCount = 0, resultLabel, onClear, clearDisabled, onRefresh, refreshing }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
      {more ? (
        <Disclosure
          summary="More filters"
          meta={moreActiveCount > 0 ? `${moreActiveCount} active` : null}
          defaultOpen={moreActiveCount > 0}
          className="bg-muted/30"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{more}</div>
        </Disclosure>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {onClear ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={clearDisabled}>
            Clear filters
          </Button>
        ) : null}
        {onRefresh ? (
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        ) : null}
        {resultLabel ? <span className="text-sm text-muted-foreground" role="status">{resultLabel}</span> : null}
      </div>
    </div>
  );
}
