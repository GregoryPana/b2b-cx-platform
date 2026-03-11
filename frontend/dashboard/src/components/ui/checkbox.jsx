import React from "react";
import { cn } from "../../lib/utils";

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      "h-4 w-4 rounded border border-slate-400 bg-white text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
      className
    )}
    {...props}
  />
));

Checkbox.displayName = "Checkbox";

export { Checkbox };
