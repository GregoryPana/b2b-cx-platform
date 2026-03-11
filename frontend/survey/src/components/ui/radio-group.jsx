import React from "react";
import { cn } from "../../lib/utils";

const RadioGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-wrap gap-3", className)} role="radiogroup" {...props} />
));

const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="radio"
    className={cn(
      "h-4 w-4 border border-slate-400 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
      className
    )}
    {...props}
  />
));

RadioGroup.displayName = "RadioGroup";
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
