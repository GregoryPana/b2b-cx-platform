import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";

/**
 * Small modal that replaces window.confirm / window.prompt.
 *
 * Props:
 *  - open, title, description (node), onCancel
 *  - actions: [{ key, label, variant, requireNote, disabled }] – each rendered as a button;
 *    `requireNote` forces a non-empty note, `disabled` greys the button out.
 *  - noteLabel / notePlaceholder: shows a notes box when any action uses it (or `showNote`)
 *  - onSubmit(actionKey, note)  may return a promise; the dialog stays open and shows `busy` until it settles.
 */
export default function ActionDialog({
  open,
  title,
  description,
  actions,
  showNote = false,
  noteLabel = "Notes",
  notePlaceholder = "",
  confirmText = "",
  confirmTextLabel = "",
  busy = false,
  error = "",
  onSubmit,
  onCancel,
}) {
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState("");
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setTyped("");
      const id = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const usesNote = showNote || actions.some((action) => action.requireNote);
  const textMatches = !confirmText || typed.trim().toLowerCase() === confirmText.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-lg">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {description ? <div className="mt-2 space-y-2 text-sm text-muted-foreground">{description}</div> : null}

        {confirmText ? (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{confirmTextLabel || `Type "${confirmText}" to confirm`}</label>
            <Input ref={firstFieldRef} value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={confirmText} autoComplete="off" />
          </div>
        ) : null}

        {usesNote ? (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{noteLabel}</label>
            <Textarea ref={confirmText ? undefined : firstFieldRef} value={note} onChange={(event) => setNote(event.target.value)} placeholder={notePlaceholder} className="min-h-24" />
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          {actions.map((action) => {
            const missingNote = action.requireNote && !note.trim();
            const missingText = Boolean(confirmText) && !textMatches;
            return (
              <Button
                key={action.key}
                type="button"
                variant={action.variant || "default"}
                disabled={busy || Boolean(action.disabled) || missingNote || missingText}
                title={missingNote ? "A note is required" : undefined}
                onClick={() => onSubmit(action.key, note.trim())}
              >
                {busy ? "Working..." : action.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
