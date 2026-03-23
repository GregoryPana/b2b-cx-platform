import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "bg-primary/10 text-primary",
      secondary: "bg-secondary text-secondary-foreground",
      success: "bg-success/15 text-success",
      warning: "bg-warning/20 text-warning-foreground",
      destructive: "bg-destructive/15 text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
