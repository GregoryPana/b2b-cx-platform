import { Children, cloneElement, isValidElement, useId } from "react";
import { cn } from "../../lib/utils";

// Label above the control with the design-system 8px gap, plus an optional one-line hint.
// A single control child gets an id so the label is really associated with it (click and screen readers);
// composite children (inputs + datalist, lists of rows) are grouped under the label instead.
export default function Field({ label, htmlFor, hint, className, children }) {
  const autoId = useId();
  const only = Children.count(children) === 1 && isValidElement(children) && typeof children.type !== "string" ? children : null;
  const controlId = htmlFor || only?.props?.id || autoId;
  const labelledChildren = only && !only.props.id && !htmlFor ? cloneElement(only, { id: controlId }) : children;
  const grouped = !only && !htmlFor;
  return (
    <div className={cn("space-y-2", className)} role={grouped ? "group" : undefined} aria-labelledby={grouped ? `${autoId}-label` : undefined}>
      <label id={`${autoId}-label`} htmlFor={grouped ? undefined : controlId} className="block text-sm font-medium">{label}</label>
      {labelledChildren}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
