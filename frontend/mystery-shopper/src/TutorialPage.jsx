import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import AuthShell from "./mysteryAuth/AuthShell";
import { buttonVariants } from "./components/ui/button";
import { cn } from "./lib/utils";

const BASE = `${import.meta.env.BASE_URL || "/"}tutorials/enrollment/`;

const VARIANTS = {
  desktop: { label: "Computer", hint: "Wide screen", portrait: false },
  mobile: { label: "Phone", hint: "Tall screen", portrait: true },
};

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Standalone walkthrough page: `?tutorial=enrollment`. No sign-in needed; files are served from this app. */
export default function TutorialPage() {
  const [variant, setVariant] = useState(() => (window.matchMedia?.("(max-width: 639px)").matches ? "mobile" : "desktop"));
  const [chapters, setChapters] = useState([]);
  const [current, setCurrent] = useState(0);
  const videoRef = useRef(null);
  const v = VARIANTS[variant];

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}chapters.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => { if (!cancelled) setChapters(Array.isArray(data?.[variant]) ? data[variant] : []); })
      .catch(() => { if (!cancelled) setChapters([]); });
    setCurrent(0);
    return () => { cancelled = true; };
  }, [variant]);

  const onTimeUpdate = () => {
    const t = videoRef.current?.currentTime ?? 0;
    let idx = 0;
    chapters.forEach((c, i) => { if (t + 0.25 >= c.start) idx = i; });
    setCurrent(idx);
  };

  const seek = (start) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = start;
    el.play().catch(() => {});
  };

  return (
    <AuthShell
      title="How to enroll: video walkthrough"
      description="About three minutes. Captions are built into the video; you can pause and replay any step."
      width="max-w-3xl"
    >
      <div className="space-y-5">
        <div role="group" aria-label="Choose the video for your device" className="inline-flex rounded-lg border bg-card p-1">
          {Object.entries(VARIANTS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              aria-pressed={variant === key}
              onClick={() => setVariant(key)}
              className={cn(
                "min-h-11 rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                variant === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              <span className="ml-1.5 text-xs opacity-80">{item.hint}</span>
            </button>
          ))}
        </div>

        <div className={cn("mx-auto w-full overflow-hidden rounded-lg border bg-black", v.portrait ? "max-w-xs" : "")}>
          <video
            key={variant}
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={`${BASE}enrollment-${variant}-poster.jpg`}
            onTimeUpdate={onTimeUpdate}
            className="block w-full"
            style={{ aspectRatio: v.portrait ? "9 / 16" : "16 / 9" }}
          >
            <source src={`${BASE}enrollment-${variant}-720.mp4`} type="video/mp4" />
            Your browser cannot play this video. Use the download link below.
          </video>
        </div>

        {chapters.length > 0 ? (
          <nav aria-label="Jump to a step">
            <h2 className="mb-2 text-sm font-semibold">Jump to a step</h2>
            <ol className="grid gap-2 sm:grid-cols-2">
              {chapters.map((c, i) => (
                <li key={c.title}>
                  <button
                    type="button"
                    onClick={() => seek(c.start)}
                    aria-current={i === current ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === current ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-muted",
                    )}
                  >
                    <span>{i + 1}. {c.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatTime(c.start)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <a href={`${BASE}enrollment-${variant}-email.mp4`} download className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download this video
          </a>
          <p className="text-xs text-muted-foreground">The same video is attached to your enrollment email. You need the CWS VPN to open your enrollment link.</p>
        </div>
      </div>
    </AuthShell>
  );
}
