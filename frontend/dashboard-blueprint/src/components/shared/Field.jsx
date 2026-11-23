import { Children, cloneElement, isValidElement, useId } from "react";
import { cn } from "../../lib/utils";

// Label above the control with the design-system 8px gap, plus an optional one-line hint.
// A single control child gets an id so the label is really associated with it (click and screen readers);
// composite children (inputs + datalist, lists of rows) are grouped under the label instead.
export default function Field({ label, htmlFor, hint, className, required = false, children }) {
  const autoId = useId();
  const only = Children.count(children) === 1 && isValidElement(children) && typeof children.type !== "string" ? children : null;
  const controlId = htmlFor || only?.props?.id || autoId;
  const extra = required ? { "aria-required": true } : {};
  const labelledChildren = only ? cloneElement(only, { ...(!only.props.id && !htmlFor ? { id: controlId } : {}), ...extra }) : children;
  const grouped = !only && !htmlFor;
  return (
    <div className={cn("space-y-2", className)} role={grouped ? "group" : undefined} aria-labelledby={grouped ? `${autoId}-label` : undefined}>
      <label id={`${autoId}-label`} htmlFor={grouped ? undefined : controlId} className="block text-sm font-medium">{label}{required ? <span className="ml-0.5 text-destructive" aria-hidden="true">*</span> : null}</label>
      {labelledChildren}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
