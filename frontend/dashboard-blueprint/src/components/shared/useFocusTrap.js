import { useEffect } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab / Shift+Tab inside a modal container while `active`.
// Only the top-most modal (the last `[role="dialog"][aria-modal="true"]` in the document) traps,
// so a confirmation opened from inside a side panel gets the keys first and the panel stays quiet.
export default function useFocusTrap(containerRef, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const modals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (modals.length && modals[modals.length - 1] !== container) return;
      const items = Array.from(container.querySelectorAll(FOCUSABLE)).filter((node) => node.offsetParent !== null || node === document.activeElement);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [containerRef, active]);
}
