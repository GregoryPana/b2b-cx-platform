import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import useFocusTrap from "./useFocusTrap";

// Right-hand detail drawer: the list stays visible behind it, so opening a visit no longer
// moves the user away from where they were. Layered below ActionDialog (z-50) so an approve /
// reject confirmation opened from inside the panel still appears on top.
export default function SidePanel({ open, title, subtitle, onClose, children, className }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useFocusTrap(panelRef, open);

  // Depends only on `open`: re-running on every parent render would pull focus out of the form fields.
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      // Another modal (for example the review confirmation) owns Escape while it is open.
      if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return;
      closeRef.current?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Close details" tabIndex={-1} onClick={() => closeRef.current?.()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn("relative flex h-full w-full max-w-3xl flex-col bg-background shadow-lg outline-none", className)}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => closeRef.current?.()} aria-label="Close details">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
