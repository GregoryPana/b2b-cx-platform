import { useEffect, useRef } from "react";
import { Button } from "./ui/button";

/**
 * Small confirmation modal used instead of window.confirm.
 * Cancel is focused first (the safe choice), Escape and a click outside both cancel, Tab stays inside.
 *
 * Props: open, title, description (string), items (string[]), confirmLabel, cancelLabel, onConfirm, onCancel.
 */
export default function ConfirmDialog({ open, title, description, items, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
      if (event.key !== "Tab") return;
      const order = [cancelRef.current, confirmRef.current].filter(Boolean);
      const at = order.indexOf(document.activeElement);
      const next = event.shiftKey ? (at <= 0 ? order.length - 1 : at - 1) : (at === order.length - 1 ? 0 : at + 1);
      event.preventDefault();
      order[next]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-lg">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        {items && items.length > 0 ? (
          <ul className="mt-3 max-h-56 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
            {items.map((item) => <li key={item} className="break-words">{item}</li>)}
          </ul>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button ref={confirmRef} type="button" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
