import { useState } from "react";
import { Check, CircleAlert, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";

const logoSrc = `${import.meta.env.BASE_URL || "/"}branding/cws-logo.png`;

/**
 * Shared frame for the shopper auth screens (enroll, sign in, recover):
 * brand header, one centred column, a title that says where the person is.
 */
export default function AuthShell({ title, description, width = "max-w-lg", headingRef, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b bg-card">
        <div className={cn("mx-auto flex items-center gap-3 px-4 py-3", width)}>
          <img src={logoSrc} alt="" width="32" height="32" className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Cable &amp; Wireless Seychelles</p>
            <p className="text-xs text-muted-foreground">Mystery Shopper</p>
          </div>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 py-6 sm:py-10">
        <div className={cn("w-full", width)}>
          <div className="mb-5">
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none [text-wrap:balance]">
              {title}
            </h1>
            {description ? <p className="mt-1 text-sm text-muted-foreground [text-wrap:pretty]">{description}</p> : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Label + control + optional hint, wired together for screen readers. */
export function Field({ id, label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide control (keyboard reachable, named). */
export function PasswordInput({ id, value, onChange, autoComplete, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        className="pr-11"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Error message used by every auth screen. */
export function InlineAlert({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Copy-to-clipboard button that confirms ("Copied") for two seconds. */
export function CopyButton({ text, label = "Copy", copiedLabel = "Copied", className, variant = "outline", size = "sm" }) {
  const [state, setState] = useState("idle");
  const onClick = async () => {
    const ok = await copyToClipboard(text);
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 2000);
  };
  return (
    <Button type="button" variant={variant} size={size} onClick={onClick} className={cn("gap-1.5", className)}>
      {state === "copied" ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{state === "copied" ? copiedLabel : state === "failed" ? "Copy failed" : label}</span>
    </Button>
  );
}
