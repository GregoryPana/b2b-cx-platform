import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

// Same focus/hover/touch disclosure as Installation help, with viewport clamping.
export default function InfoHint({ text, label = "Help for this metric" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const id = useId();
  const button = useRef(null);
  const tooltip = useRef(null);
  const timer = useRef(null);
  const cancelClose = () => clearTimeout(timer.current);
  const closeAfterHover = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (document.activeElement !== button.current) setOpen(false);
    }, 120);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = button.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      setPosition({
        left: Math.max(8, Math.min(anchor.right - box.width, window.innerWidth - box.width - 8)),
        top: Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - box.height - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const keydown = (event) => { if (event.key === "Escape") { cancelClose(); setOpen(false); } };
    const outside = (event) => {
      if (!button.current?.contains(event.target) && !tooltip.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <>
    <button ref={button} type="button" aria-label={label} aria-expanded={open}
      aria-describedby={open ? id : undefined}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onFocus={() => { cancelClose(); setOpen(true); }} onBlur={() => setOpen(false)}
      onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={closeAfterHover}
      onClick={() => { cancelClose(); setOpen(true); }}>
      <CircleHelp className="h-4 w-4" aria-hidden="true" />
    </button>
    {open && createPortal(<span ref={tooltip} id={id} role="tooltip"
      onMouseEnter={cancelClose} onMouseLeave={closeAfterHover}
      className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] overflow-auto rounded-md border bg-popover p-3 text-xs font-normal text-popover-foreground shadow-md"
      style={{ ...position, maxHeight: "calc(100vh - 1rem)", overflowWrap: "anywhere" }}>{text}</span>, document.body)}
  </>;
}
