import React from "react";
import { cn } from "../../lib/utils";

const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));

Select.displayName = "Select";

export { Select };
