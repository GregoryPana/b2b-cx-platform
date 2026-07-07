# CWS CX Design System — Canonical Reference

**Status: ACTIVE — single source of truth for all frontend design decisions.**

This document supersedes and consolidates: `DESIGN_SYSTEM_MAP.md`, `FRONTEND_UI_UX_STANDARDS.md`, `blueprint.md`, `claude design.md`, `UX DESIGN GUIDE.md`, and `SaaS Design.md`. Those files are retained for history only; when they disagree with this file, this file wins.

**Audience:** an AI agent (LLM) that has been asked to build, redesign, or port a frontend application. The application may be completely unrelated to this repository — a new internal tool, a public survey, a dashboard, a port of a Python Streamlit app to React. Whatever the product is, following this document must produce a UI that looks and behaves like it belongs to the same family as the CWS CX platforms.

**How this document is organized:**

- Part 1 — Operating protocol for the agent (what to ask, what never to ask, how to handle new builds vs redesigns vs framework conversions)
- Part 2 — The mandatory technical stack
- Part 3 — Foundations (tokens, color, typography, spacing, surfaces, radius, shadows)
- Part 4 — Components (shadcn/ui inventory, variants, usage rules)
- Part 5 — Layout and page anatomy
- Part 6 — Data display and analytics
- Part 7 — Feedback, loading, and user-action principles
- Part 8 — Motion and micro-interactions
- Part 9 — Guidance, tooltips, and language/microcopy
- Part 10 — Forms and validation
- Part 11 — Accessibility and responsiveness
- Part 12 — Redesign and framework-conversion playbook (incl. Streamlit → React)
- Part 13 — Acceptance checklist (self-verify before finishing)
- Appendix A — Current platform inventory and known inconsistencies (repo-specific)

---

# Part 1 — Agent Operating Protocol

## 1.1 The only decisions that belong to the user

Almost everything in this document is fixed. Before starting, ask the user for **only** the following, and only if they are not already provided:

1. **Brand primary color** (one color; you derive the rest — see §3.3). If none is given, use the CWS default `hsl(211 100% 36%)`.
2. **Logos / favicon / banner images** — file paths or "none". Never generate placeholder logos silently; use a text wordmark until assets are supplied.
3. **Product imagery / illustrations**, if the product calls for any. Default is **no decorative imagery** — this design language is data-first and almost image-free.
4. **App name and short one-line purpose** (used in the header, browser title, and sign-in screens).
5. **Default color scheme** — light, dark, or user-toggleable. Default: light, with dark mode tokens defined from day one.

Do **not** ask about: fonts, spacing, border radius, component library, chart library, toast style, layout structure, icon set, animation timing, language/tone, semantic colors, focus styles, or breakpoints. Those are all fixed by this document. If the user volunteers a preference that conflicts with this document, follow the user, and note the divergence in your handoff summary.

## 1.2 Modes of work

You will be in one of three modes. Identify which one before writing code:

- **New build** — scaffold with the stack in Part 2, apply everything in Parts 3–11 directly.
- **Redesign of an existing app** — do not rip out working logic. Audit first (list the current colors, spacing values, components, and libraries actually in use), map each existing element to its canonical equivalent in this document, then replace visuals layer by layer: tokens first, then components, then layout, then motion. Keep the information architecture unless it violates Part 5. Never leave two visual languages coexisting in the final result.
- **Framework conversion** (e.g., Python Streamlit, Dash, Flask/Jinja, PHP → React) — the source app defines *what* exists (data, controls, flows), this document defines *how it looks and behaves*. Use the mapping tables in Part 12. Do not replicate source-framework aesthetics (Streamlit's wide sidebars, default reds, full-width elements); translate intent, not pixels.

## 1.3 Decision hierarchy

When choosing how to style or structure anything, decide in this order:

1. A rule in this document.
2. An existing pattern in the codebase you are working in (if it already follows this document).
3. The default behavior of an unmodified shadcn/ui component.
4. Only then, a new pattern — which must be token-based, reusable, and consistent with the design intent in §1.4.

## 1.4 Design intent (the "why" behind every rule)

The interface must feel **professional and operational, not decorative**. It exists to help a user answer three questions within seconds of landing on any screen:

1. *What am I looking at?* (clear titles, one-line descriptions, visible scope/filters)
2. *What is good, bad, or needs action?* (semantic color, thresholds, status chips)
3. *What can I do next?* (explicit, verb-labelled actions in predictable positions)

Consequences of this intent, applied everywhere:

- Color is **semantic first, aesthetic second**. Most of the screen is neutral; color appears where it carries meaning (status, thresholds, charts, primary actions).
- Every interactive element visibly responds to the user (hover, focus, press, disabled, loading).
- Nothing decorative that doesn't support a decision: no hero illustrations, no emoji as UI affordances, no non-functional cards, no "vibe" KPIs.
- Text explains before it demands: screens, cards, and inputs carry short plain-English descriptions so a first-time user never needs external instructions for routine tasks.

---

# Part 2 — Mandatory Stack

```jsonc
{
  "framework": "React 18+ (function components + hooks only)",
  "buildTool": "Vite",
  "language": "TypeScript preferred; JavaScript acceptable for small apps — never mix .jsx/.tsx duplicates of the same file",
  "styling": "Tailwind CSS 3+ with the token config in §3.1 (no inline hex colors, no CSS-in-JS)",
  "components": "shadcn/ui pattern — components copied into src/components/ui/, styled exclusively with the semantic tokens",
  "variants": "class-variance-authority (cva) + clsx + tailwind-merge via a cn() helper in src/lib/utils",
  "icons": "lucide-react (exclusively — no emoji, no other icon sets, no inline SVG icons)",
  "charts": "recharts (exclusively — no hand-rolled CSS charts, no chart.js/d3 unless recharts genuinely cannot do it)",
  "toasts": "sonner (<Toaster position=\"top-right\" richColors closeButton />)",
  "motion": "framer-motion for mount/unmount and state feedback; GSAP only for page-entrance stagger sequences",
  "forms": "react-hook-form + zod for any form with 3+ fields or nontrivial validation",
  "tables": "@tanstack/react-table for sortable/paginated data tables; plain shadcn <Table> for simple read-only lists",
  "routing": "react-router-dom v6+",
  "animationsPlugin": "tailwindcss-animate"
}
```

Rules:

- **shadcn/ui is the exclusive component source.** Never install MUI, AntD, Chakra, Bootstrap, or similar. Never hand-build a component shadcn already provides (button, card, dialog, select, tabs, table, tooltip, badge, skeleton, etc.).
- shadcn components must be **token-based**: variants reference `bg-primary`, `text-muted-foreground`, `border-border`, `ring-ring` — never raw palette classes like `bg-slate-800` or `ring-slate-400` inside `components/ui/`.
- Directory structure (fixed):

```
src/
├── components/
│   ├── ui/            # shadcn components only
│   ├── layout/        # Sidebar.tsx, Header.tsx, MainLayout.tsx, PageContainer.tsx
│   └── <domain>/      # composed, feature-agnostic components (StatCard, ChartCard, DataTable)
├── features/<name>/   # feature pages + feature-only components
├── lib/utils.ts       # cn() helper
├── styles/globals.css # @tailwind directives + token blocks (§3.1) — the ONLY global CSS file
├── App.tsx
└── main.tsx
```

- Environment: Vite reads `.env.local` at **build time** — document any `VITE_*` variables you introduce and remember changes require a rebuild.

---

# Part 3 — Foundations

## 3.1 Design tokens (the single source of visual truth)

All colors live as HSL triplets in CSS variables in `src/styles/globals.css`, consumed through the Tailwind config. **No component may ever use a literal color.** This is what makes theming, dark mode, and brand-swapping possible without touching components.

### Canonical `globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Page */
    --background: 214 50% 98%;            /* near-white with a cool blue cast */
    --foreground: 222 47% 11%;            /* near-black primary text */

    /* Cards — LIGHT MODE RULE: card is a different (lighter/tinted) color than
       the page and carries NO border; separation comes from tone + soft shadow */
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;

    /* Muted surfaces + secondary text */
    --muted: 214 100% 98%;
    --muted-foreground: 215 16% 35%;

    /* Borders and inputs */
    --border: 214 40% 89%;
    --input: 214 40% 89%;

    /* Brand primary — THE user-decided color. Everything else derives. */
    --primary: 211 100% 36%;
    --primary-foreground: 210 40% 98%;

    /* Secondary (neutral tinted) */
    --secondary: 214 100% 96%;
    --secondary-foreground: 212 80% 24%;

    /* Semantic — meanings are NON-NEGOTIABLE (see §3.4) */
    --destructive: 0 63% 47%;
    --destructive-foreground: 210 40% 98%;
    --success: 152 67% 37%;
    --success-foreground: 210 40% 98%;
    --warning: 48 100% 47%;
    --warning-foreground: 222 47% 11%;

    /* Interactive hover surface */
    --accent: 214 100% 96%;
    --accent-foreground: 212 80% 24%;

    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    --ring: 211 100% 36%;                 /* focus ring = primary */
    --radius: 0.75rem;                    /* 12px — global radius base */
  }

  .dark {
    --background: 220 45% 10%;
    --foreground: 210 40% 96%;

    /* Cards — DARK MODE RULE: card sits slightly LIGHTER than the page and
       borders become subtle; never use strong borders in dark mode */
    --card: 220 47% 13%;
    --card-foreground: 210 40% 96%;

    --muted: 218 44% 19%;
    --muted-foreground: 216 31% 70%;
    --border: 218 41% 24%;
    --input: 218 41% 24%;

    --primary: 213 74% 53%;               /* primary brightens in dark mode */
    --primary-foreground: 222 47% 11%;
    --secondary: 214 61% 23%;
    --secondary-foreground: 210 40% 96%;

    --destructive: 0 72% 55%;
    --destructive-foreground: 210 40% 98%;
    --success: 152 67% 42%;
    --warning: 48 100% 53%;

    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 96%;
    --popover: 220 47% 13%;
    --popover-foreground: 210 40% 96%;
    --ring: 213 74% 53%;
  }

  * { @apply border-border; }

  body {
    @apply bg-background text-foreground;
    font-family: "IBM Plex Sans", "Source Sans 3", sans-serif;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

### Canonical `tailwind.config.js` extension

```js
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: { shimmer: "shimmer 1.5s ease-in-out infinite" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

## 3.2 Deriving a theme from one brand color

When the user supplies a brand color, do **not** invent a full palette. Derive:

- `--primary` (light) = the brand color, adjusted if needed so white text on it passes WCAG AA (4.5:1). If the brand color is too light, darken lightness until it passes; keep hue.
- `--primary` (dark) = same hue, lightness raised ~15–20 points, saturation reduced ~15–25 points (bright-but-not-neon on dark backgrounds).
- `--ring` = `--primary` in both modes.
- `--background` / `--card` / `--muted` / `--border` / `--secondary` / `--accent` = keep the canonical neutral values above but shift their **hue** to match the brand hue (e.g., a teal brand → neutrals at hue ~180 instead of 214). Keep the saturation/lightness numbers.
- Semantic colors (`success`, `warning`, `destructive`) **never change** with the brand.

## 3.3 Surfaces and depth

- **Light mode:** page background is a near-white tint; cards are pure white (or a lighter tint), **borderless**, separated by tone and a soft shadow (`shadow-sm`, at most `shadow-md`). Never a hard 1px dark border around a light card.
- **Dark mode:** cards are *slightly lighter than* the page (never darker), with a **subtle** border (`--border` at low contrast). Reduce shadow reliance; tone does the work.
- **Glassmorphism** (translucent panels + `backdrop-blur`) is a permitted *accent*, not a default: use at most for the app top bar / sticky nav (`bg-card/80 backdrop-blur-md`) and overlays. Never place dense text on translucent surfaces if it costs contrast. Always provide an opaque `@supports not (backdrop-filter: ...)` fallback.
- Elevation ladder (max 3 levels): page → card → popover/modal. Don't nest cards inside cards; use a `bg-muted` inset block (`rounded-md bg-muted p-3`) for sub-groupings inside a card.

## 3.4 Semantic color — non-negotiable meanings

| Meaning                  | Token                              | Typical uses                                                |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------- |
| Good / positive / pass   | `success` (green range)          | KPI above threshold, approved status, promoters, pass bands |
| Needs attention          | `warning` (amber range)          | Mid thresholds, pending review, passives                    |
| Bad / risk / destructive | `destructive` (red range)        | KPI below threshold, rejected, detractors, delete actions   |
| Neutral / informational  | `primary` or slate-blue neutrals | Info banners, totals, in-progress                           |

Rules:

- Never repurpose these meanings between screens (green must never mean "delete succeeded" on one page and "high priority risk" on another).
- Semantic fills for chips/badges/banners use the translucent pattern: `border-{color}/40 bg-{color}/15 text-{color}` (light mode may deepen text: e.g. `text-emerald-700`), so color never overwhelms the layout.
- Never convey state by color alone — pair with a label, value, or icon.
- Score bands (customer-experience convention used across CWS platforms; reuse when the domain has 1–5 scores): `>= 4` Pass–Excellent (success) · `3–3.99` Pass–Needs Improvement (warning) · `2–2.99` Fail–Rework Required (destructive) · `< 2` Critical Fail (destructive, bold). NPS convention: Promoters 9–10 green, Passives 7–8 amber, Detractors 0–6 red.

## 3.5 Typography

- **Font:** `"IBM Plex Sans", "Source Sans 3", sans-serif` for everything. Monospace (`"JetBrains Mono", monospace`) only for codes, IDs, and tokens. Never more than these two families. Self-host or load via `<link>` in `index.html`.
- **Scale** (Tailwind classes; don't invent sizes):

| Role                        | Classes                                                                | Notes                                      |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| Page title (h1)             | `text-2xl md:text-3xl font-semibold tracking-tight`                  | One per page                               |
| Section title (h2)          | `text-xl font-semibold tracking-tight`                               |                                            |
| Card title (h3 / CardTitle) | `text-base font-medium` (or `text-lg` for hero cards)              | Short, informative                         |
| Body                        | `text-sm` (14px) for app UI, `text-base` for long-form/guide pages | line-height ≥1.5; guides ~1.6             |
| Caption / meta              | `text-xs text-muted-foreground`                                      |                                            |
| Label (eyebrow)             | `text-xs font-medium uppercase tracking-wider text-muted-foreground` | Sparingly                                  |
| KPI value                   | `text-3xl md:text-4xl font-semibold tabular-nums`                    | The most prominent text on analytics pages |

- Headings get slightly negative tracking (`tracking-tight`) and tight line-height (1.1–1.25). Body never below 1.5.
- Hierarchy is fixed: page title > section title > card title > body > caption. Never let a caption outweigh a title through color or weight.
- Numbers that update or align in columns use `tabular-nums`.

## 3.6 Spacing

**8px base scale, Tailwind units only** (`gap-2`=8px, `p-3`=12px, `p-4`=16px, `p-6`=24px, `gap-6`, `py-8`, …). Do not invent pixel values; do not use the legacy golden-ratio scale (8/13/21/34/55/89) found in older CWS CSS.

Fixed rhythm:

- Card internal padding: `p-6` (24px); compact cards `p-4`.
- Gap between cards in a grid: `gap-4` to `gap-6`.
- Vertical gap between page sections: `space-y-6` (24px); between major regions `space-y-8`.
- Page container padding: `px-4 md:px-6 lg:px-8`, `py-6`.
- Between a label and its input: `space-y-2` (8px); between form fields: `space-y-4`.
- Icon-to-text gap: `gap-2`.

## 3.7 Radius, borders, shadows

- Radius: driven by `--radius` (0.75rem). Cards/panels `rounded-lg`, inputs/buttons `rounded-md`, chips/badges `rounded-full` only when genuinely pill-shaped (status chips, score pills). No fully-rounded major layout blocks.
- Borders: 1px, always `border-border`. Light mode: borders on inputs, tables, banners — not cards. Dark mode: subtle borders on cards too.
- Shadows: `shadow-sm` default for raised cards, `shadow-md` for sticky/floating bars, `shadow-lg` only for popovers/modals/toasts. Shadows should never be the first thing you notice.

## 3.8 Iconography

- `lucide-react` only. Sizes: `h-4 w-4` inline with text/buttons, `h-5 w-5` standalone, `h-6 w-6` section markers, `h-8 w-8` empty states. `stroke-width` default 2.
- Icons inherit text color (`currentColor`); use `text-muted-foreground` for secondary icons.
- Every icon-only button gets an `aria-label`; every decorative icon next to a label gets `aria-hidden="true"`.
- No emoji anywhere in the UI chrome (buttons, nav, headings). Emoji may appear only in user-generated content.

---

# Part 4 — Components (shadcn/ui)

Install/copy components under `src/components/ui/`. Style them **only** with semantic tokens. The variants below are the house defaults — keep them stable across apps.

## 4.1 Button

```jsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

Usage rules:

- **One `default` (solid primary) button per view section** — the single most important action. Everything else is `outline` or `ghost`.
- Destructive actions always use `variant="destructive"` **and** a confirmation step (dialog or two-step click) when irreversible.
- Labels are explicit verbs: `Save`, `Submit for Review`, `Delete Business`, `Sign in again`, `Verify code`. Never `OK`, `Yes`, `Go`.
- Loading state: disable and swap in a spinner icon (`<Loader2 className="h-4 w-4 animate-spin" />`) next to a progressive label ("Saving…"). Never leave a button silently unresponsive.
- Pressed feedback: `active:translate-y-px` is the house micro-press.

## 4.2 Card

Structure: `Card > CardHeader (CardTitle + CardDescription) > CardContent > CardFooter?`.

- Every content card gets a `CardTitle` (short noun phrase) and, when the card isn't self-evident, a one-sentence `CardDescription` in plain English, e.g. *"See which survey is currently open, who it belongs to, and what still needs to be completed."* This description habit is a signature of the house style — use it liberally.
- Card surface obeys §3.3 (light: tinted, borderless, `shadow-sm`; dark: lighter-than-bg + subtle border).
- Sub-groups inside cards: `rounded-md bg-muted p-3` blocks, with `text-xs text-muted-foreground` labels above values.

## 4.3 Input, Textarea, Select, Label

- Height `h-10`, `rounded-md`, `border-input bg-background px-3 py-2 text-sm`, placeholder `text-muted-foreground`.
- Label sits **above** the input (`<Label>` + `space-y-2`), `text-sm font-medium`. Never placeholder-as-label.
- Focus: `focus-visible:ring-2 focus-visible:ring-ring` — identical across all controls.
- Disabled: `disabled:cursor-not-allowed disabled:opacity-50`. If a field is intentionally read-only (e.g., an auto-filled identity field), keep it visibly disabled and do **not** add edit affordances.
- Native `<datalist>` is acceptable for type-ahead over small known lists.

## 4.4 Option pills / score selectors (house pattern)

Single-choice questions (scores 0–10 or 1–5, Yes/No, short choice lists) are rendered as **button groups, not dropdowns or radios**:

```jsx
<div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select score">
  {options.map(v => (
    <Button key={v} type="button" size="sm"
      variant={selected === v ? "default" : "outline"}
      onClick={() => select(v)}>
      {v}
    </Button>
  ))}
</div>
```

Selected = solid primary; unselected = outline. This gives one-tap answers, visible selected state, and great mobile ergonomics. Use `<Select>` only when options exceed ~8 and aren't a numeric scale.

## 4.5 Badge / status chip

`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium` with semantic translucent fills (§3.4). Statuses used across CWS: `Draft` (neutral), `Pending` (warning), `Submitted` (primary), `Approved`/`Active` (success), `Rejected`/`Retired` (destructive). Reuse these exact words for equivalent states in new apps.

## 4.6 Tabs

- shadcn `Tabs` for view switching within a page. `TabsList` = `bg-muted rounded-lg p-1`; active `TabsTrigger` = solid primary (or `bg-background shadow-sm` for a quieter look — pick one per app and stick to it).
- Tab labels: icon (`h-4 w-4`) + short noun ("Businesses", "Visits", "Survey Results"). Include `aria-selected`.
- Use tabs to separate closely related areas instead of endless vertical stacking; do not use tabs for sequential steps (that's a wizard/progress pattern).

## 4.7 Table / DataTable

- Read-only lists: shadcn `Table`. Header row `text-xs uppercase tracking-wider text-muted-foreground` on `bg-muted/50`; body rows `border-b` with `hover:bg-muted/50`; numeric columns right-aligned `tabular-nums`.
- Sortable/filterable/paginated data: `@tanstack/react-table` wrapped in the shadcn DataTable pattern (column header sort buttons, pagination footer, view options).
- Row actions live at the row end as `ghost`/`outline` `size="sm"` buttons or a "⋯" menu when >2 actions.
- Every table scrolls horizontally inside its own wrapper (`overflow-x-auto`) — the page never scrolls sideways.
- Empty table = empty state (§7.5), not a blank body.

## 4.8 Dialog / Sheet / Popover / Tooltip / DropdownMenu

- Modals (shadcn `Dialog`) for: destructive confirmations, focused create/edit forms (≤ ~8 fields), and detail drill-ins. Prefer a modal over a cramped inline flyout; prefer a dedicated page over a modal with 10+ fields.
- `Sheet` (side panel) for filter stacks and secondary detail on desktop.
- `Tooltip` for icon-only buttons and truncated text. For explanatory "what does this metric mean" content use the info-tip pattern (§9.2), which is hover **and** focus accessible.
- Collapse advanced/rare options behind an accordion or "Advanced" toggle so default surfaces stay approachable.

## 4.9 Skeleton, Spinner, Progress

- `Skeleton`: `animate-pulse rounded-md bg-muted` blocks shaped like the content they replace (text lines, KPI numbers, table rows). Prefer skeletons over spinners for content areas.
- Spinner: `Loader2` lucide icon with `animate-spin` — for inline/button-level waits only.
- Shimmer (`animate-shimmer` gradient) for long card placeholders.
- `Progress` bar: 4–8px tall, `rounded-full`, `bg-muted` track, `bg-primary` fill with `transition-all`; always pair with a text fraction ("12 of 40 answered").

## 4.10 Separator, Checkbox, Switch, Accordion

Use stock shadcn versions, token-styled. `Separator` sparingly — prefer whitespace for grouping; separators mark genuine region boundaries (e.g., sidebar footer meta).

---

# Part 5 — Layout and Page Anatomy

## 5.1 App shell

Every multi-view app uses the same shell, built from four layout components (`components/layout/`):

- **`MainLayout`** — grid: fixed/sticky **Sidebar** (256px desktop) + content column. Below `md`, sidebar collapses to a top bar + hamburger sheet.
- **`Sidebar`** — brand (logo or wordmark + app name), primary nav (icon + label buttons, active = solid primary or `bg-accent`), then a pinned footer block separated by a border: signed-in user name/email (`text-xs text-muted-foreground`) + Logout (`outline`, `size="sm"`). Optional collapsed 72px icon-rail state on ≥1024px.
- **`Header`** (page top bar) — current page title, optional status text, optional top-level actions. May use the glass treatment (§3.3). Sticky.
- **`PageContainer`** — `mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8` + `space-y-6`. All page content lives inside one.

Single-purpose apps (a public survey, a sign-in flow) may drop the sidebar and use a centered single column (`max-w-lg` for auth screens, `max-w-3xl` for form flows), but keep Header conventions.

## 5.2 Page anatomy (fixed order)

Every screen follows this vertical order — users learn it once and it never changes:

1. **Header region** — page title + one-line purpose description (`text-sm text-muted-foreground`), top-level actions on the right.
2. **Filter/control region** — date ranges, platform/business selectors, search. Grouped in one card or toolbar row near the top. Date filters must support both a single day (from = to) and a range. Active filters visibly displayed (chips with clear buttons); metrics below always reflect them.
3. **Primary insight region** — KPI/stat cards first (`grid gap-4 md:grid-cols-2 lg:grid-cols-4`).
4. **Detail region** — charts, breakdowns, drill-down tables.
5. **Action region** — forms, review/approval controls, submissions — visually separated from passive analytics.

Analytics ordering within regions 3–4: volume/response overview → core KPIs (NPS, CSAT, etc.) → distributions/breakdowns → targeted/drill-down analytics.

## 5.3 Grid and responsive behavior

- Content grid: CSS grid with Tailwind (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for KPIs; `lg:grid-cols-3` for chart layouts with a 2/3 + 1/3 split).
- Breakpoints (Tailwind defaults): stack everything at `<768px` in a single column, preserving the *same* section order as desktop priority; 2-column at `md`; full layout at `lg`/`xl`; content max-width 1600px.
- No clipping, no overlapping fixed elements, no hidden primary actions at any width. Wide content scrolls within its own container.
- Sticky elements allowed: header bar, sidebar, in-page jump-nav. Nothing sticky may obscure content or stack over toasts (toasts own `z-50`).

## 5.4 In-page navigation for long forms (survey pattern)

Long questionnaires group questions into **category sections**, each an anchor target, with a jump-nav: sticky sidebar list on desktop, a collapsible "Jump to section" toggle on mobile. The active section is highlighted. Show per-category progress ("4/6 answered") wherever cheap to compute.

---

# Part 6 — Data Display and Analytics

## 6.1 KPI / stat cards

House pattern (`StatCard`): label (`text-xs uppercase tracking-wider text-muted-foreground`) → value (`text-3xl font-semibold tabular-nums`) → context caption (`text-xs text-muted-foreground`, e.g. "132 approved responses"). Optional 3px left accent border color-coded to the metric's semantic state, and an optional trend arrow with `success`/`destructive` color. Threshold coloring applies to the *accent and value*, never the whole card background.

## 6.2 Charts (recharts)

- Wrap every chart in `<ResponsiveContainer width="100%" height={...}>` inside a Card; fixed heights ~280–400px.
- **Always** include a legend or direct labels, and a tooltip. Unlabeled charts are forbidden.
- Grid lines: `<CartesianGrid strokeDasharray="3 3" className="stroke-border" />`. Axis text `text-xs`, muted.
- Colors: semantic where the data is semantic (NPS: `#10b981`/`#f59e0b`/`#ef4444`), otherwise a restrained categorical set derived from primary hue + neutrals. Never rainbow-fill a bar chart where bars are the same series.
- Tooltip style: card surface (`bg-popover border rounded-md shadow-lg text-sm`).
- If two values are visually close, add secondary cues (labels, tone difference) — don't force users to squint.
- Prefer the boring-but-right chart: line for trends over time, bar for comparisons, donut only for 2–4 part compositions (NPS mix), table when precision matters. Upgrade to richer forms (maps, small multiples) only when they answer a real question.
- Charts render from *filtered* data and the active scope is stated near the chart title.

## 6.3 Tables as analytics

Drill-down tables pair with charts: chart shows shape, table shows exact values. Zebra or hover-highlight rows, right-aligned numerics, semantic chips for banded values.

---

# Part 7 — Feedback, Loading, and User-Action Principles

The core principle: **every user action produces a visible response within 100ms** — a pressed state, a spinner, a toast, an inline banner, or a navigation. Silence is a bug.

## 7.1 Toasts — sonner (the standard)

```jsx
import { Toaster, toast } from "sonner";
// once, at app root:
<Toaster position="top-right" richColors closeButton />
// usage:
toast.success("Visit submitted for review");
toast.error("Could not save your changes. Please try again.");
```

- Toasts are for **transient outcomes** of user actions (saved, submitted, approved, failed).
- Success toasts: short, past-tense, specific. Error toasts: what failed + what to do next.
- Do not hand-roll toast stacks in new code; sonner is the single implementation.

## 7.2 Inline banners / notices

For state that should **persist on screen** (a form-level error, an access warning, unsent-changes notice), use an inline banner near its source, not a toast:

```jsx
<div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">…</div>
<div className="rounded-md border border-success/50 bg-success/10 p-3 text-sm text-success">…</div>
<div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">…</div>
```

Animate mount/unmount with framer-motion (§8.2). Rule of thumb: toast for *events*, banner for *conditions*.

## 7.3 Action lifecycles

- **Submit-like actions:** disable the trigger + progressive label ("Submitting…") → on success: toast + UI reflects new state (status chip changes, item moves lists) → on failure: error toast **and** inline banner if the user needs to fix something.
- **Destructive actions:** confirmation dialog naming the object ("Delete business 'Island Traders'? This cannot be undone."), destructive-variant confirm button.
- **Draft-capable forms:** autosave or explicit "Save draft"; visibly distinguish saved vs dirty (e.g., "Unsaved changes" chip); warn before navigation that discards work.
- **Pessimistic by default:** reflect server confirmation rather than optimistic updates, unless the action is trivial and reversible.

## 7.4 Loading states

- Full-page initial load: branded centered screen (logo/wordmark + spinner + "Signing you in…" / "Loading…").
- Section loads: skeletons shaped like the incoming content.
- Never block the whole page for a partial refresh; keep filters interactive.
- If a wait can exceed ~5s, add text that says what's happening.

## 7.5 Empty, error, and access states

- **Empty:** icon (muted, `h-8 w-8`) + one sentence stating what would appear here + the action to create it, centered in the card (`py-16 text-center`). E.g., *"No planned visits yet. Visits assigned to you will appear here."*
- **Error (recoverable):** inline banner + "Try again" action.
- **No access:** a polite explanatory card, not a dead end — pattern from the B2B app: title "No B2B Survey Access", body *"You're signed in, but this account does not currently have access to the B2B survey. Please ask an administrator to grant access and then try again."* + Logout button. Always tell users **why** and **who can fix it**.
- **Signed out:** confirmation card ("You have signed out") with "Sign in again" — never a blank screen.

---

# Part 8 — Motion and Micro-interactions

Motion is subtle, fast, and functional — it confirms actions and softens content swaps. Nothing bounces, nothing loops decoratively.

## 8.1 Timing

- Micro-transitions (hover, color, press): 150–200ms, `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind `transition-colors` default is fine).
- Entrances: 300–450ms.
- Press: `active:translate-y-px`.

## 8.2 Framer-motion (mount/unmount + state feedback)

House recipes — reuse verbatim:

```jsx
// content/card entrance
<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>…</motion.div>

// banner/notice mount + unmount
<AnimatePresence>
  {error && (
    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      {error}
    </motion.p>
  )}
</AnimatePresence>
```

## 8.3 GSAP (page-entrance stagger only)

On view/tab change, stagger the major surfaces in:

```js
useEffect(() => {
  const ctx = gsap.context(() => {
    const targets = gsap.utils.toArray(".animate-target");
    gsap.fromTo(targets, { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.04, ease: "power2.out" });
  });
  return () => ctx.revert();
}, [activeView]);
```

If the app is small, skip GSAP entirely and use framer for everything — don't add the dependency for one effect.

## 8.4 Reduced motion

Always honor `prefers-reduced-motion: reduce` (collapse all animation/transition durations to ~0). tailwindcss-animate + a global media query cover this; verify it.

---

# Part 9 — Guidance, Tooltips, and Language

This system is deliberately **explanation-rich**. The apps are used by non-technical staff and external participants; every screen assumes the reader may be seeing it for the first time.

## 9.1 The three layers of guidance

1. **Inline descriptions (always):** page subtitle, CardDescription, helper text under inputs. One sentence, plain English.
2. **Info-tips (for concepts/metrics):** a small "i" affordance next to headings whose meaning isn't universal (NPS, CSAT, scoring bands). See §9.2.
3. **Guide pages (for workflows):** a dedicated "User Guide" route in the app nav for multi-step processes (how to complete a survey, what scoring means, what happens after submission), written as short sections with anchors. Guides live in-app, not in external PDFs.

## 9.2 Info-tip pattern (accessible tooltip)

An 18px circular "i" button next to the heading; popover opens on hover **and** focus; ~280px wide, popover surface, `text-xs`, plain-language definition:

```jsx
<h2 className="flex items-center gap-2">
  Net Promoter Score
  <span className="group relative inline-flex">
    <button type="button" aria-label="NPS info" aria-describedby="tip-nps"
      className="flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full border bg-muted text-[11px] font-bold text-muted-foreground">i</button>
    <span id="tip-nps" role="tooltip"
      className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-[min(280px,78vw)] rounded-md border bg-popover p-3 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      NPS equals percentage of Promoters (9-10) minus percentage of Detractors (0-6). Passives (7-8) are neutral.
    </span>
  </span>
</h2>
```

(Or shadcn `Tooltip`/`Popover` with equivalent behavior.) Every derived metric shown to users gets one of these with its formula/meaning in one or two sentences.

## 9.3 Language and microcopy rules

- **Voice:** plain, direct, courteous. Write like a helpful colleague, not a system. Second person ("You will then be asked for a 6-digit code…"), active verbs, no jargon, no exclamation marks, no humor in operational copy.
- **Explain-then-ask:** instructional text states what will happen before asking the user to act: *"Sign in with your registered email and password. You will then be asked for a 6-digit code from your authenticator app."*
- **Errors** name the problem and the remedy: *"Could not load questions. Check your connection and try again."* Never raw exception text, never blame ("Invalid input" → "Enter a date in the format YYYY-MM-DD").
- **Casing:** Title Case for page/card titles, nav items, and button labels ("Submit for Review"); sentence case for descriptions, helper text, toasts, and banners.
- **Buttons** = explicit verb + object where ambiguity is possible ("Delete Business", not "Delete").
- **Numbers/labels:** concise KPI labels ("Approved responses", not "Total number of responses that have been approved"); include units and scales ("Promoters (9-10)").
- **Status vocabulary** is shared across apps (§4.5) — reuse rather than inventing synonyms.
- **Empty/negative states** always include the "so what": what appears here, why it's empty, who/what fills it.
- Amount of explanation: every page has a subtitle; every non-obvious card has a description; every metric heading has an info-tip; every form field with constraints has helper text. When in doubt, add the sentence — this house style prefers a line of explanation over a support request.

---

# Part 10 — Forms and Validation

- Stack: react-hook-form + zod resolvers for any nontrivial form; simple controlled state is fine for 1–2 fields.
- Layout: single column by default; two-column grids only for short related pairs (city/postcode) on ≥`md`. Label above input, helper text below, error message replaces/joins helper text in `text-destructive text-sm`.
- Validate on blur + on submit; never on first keystroke. On failed submit: inline errors at each field **plus** a summary banner if errors are off-screen; scroll to the first error.
- Required fields: mark the exceptional side (if most are required, mark optional ones "(optional)").
- Group long forms into titled sections (Cards) with the jump-nav (§5.4); show overall progress for questionnaire-style forms.
- Multi-entry inputs (list of team members, action points): repeatable input rows with an outline "Add another" button and per-row remove (ghost icon button with aria-label).
- Auth screens: centered `max-w-lg` Card, `text-2xl` title, stacked inputs `space-y-4`, full-width primary button, explanatory sentence under controls, secondary paths as `ghost` full-width buttons ("Use a recovery code instead").

---

# Part 11 — Accessibility and Responsiveness Baseline

Every screen must ship with:

- Keyboard navigability for every interactive element; logical tab order; `Skip to content` link on shell layouts.
- Visible focus: `focus-visible:ring-2 focus-visible:ring-ring` on all controls — one system, no per-component variations.
- Text contrast ≥ 4.5:1 (AA) for body text; ≥ 3:1 for large headings. Check especially: muted text on muted surfaces, text on translucent chips, dark-mode borders.
- `aria-label` on icon-only buttons; `role="radiogroup"` + `aria-label` on option-pill groups; `role="status"` on toasts; `role="tooltip"` + `aria-describedby` on info-tips; `aria-selected` on tabs.
- No color-only information (§3.4).
- `prefers-reduced-motion` respected (§8.4).
- Touch targets ≥ 40px on mobile; option pills and nav items ≥ 42px tall.
- Responsive checkpoints to verify by hand: 375px, 768px, 1024px, 1440px — no clipping, no overlap, no horizontal page scroll, same content priority order.

---

# Part 12 — Redesign and Framework-Conversion Playbook

## 12.1 Redesigning an existing React app

1. **Audit:** list current dependencies, global CSS files, color literals, spacing oddities, and component inventory. Note which parts already match this document.
2. **Tokens first:** introduce §3.1 `globals.css` + Tailwind config. Map every legacy variable/color to a token (build a table: `--ink` → `foreground`, `--muted` → `muted-foreground`, `--panel` → `card`, `--accent` → `primary`, `--line/--border` → `border`, `--danger` → `destructive`).
3. **Kill override stylesheets:** any theme file that works by `!important`-overriding component styles (like the legacy `glass-theme.css`) must be dissolved into tokens + component variants, not extended.
4. **Components:** replace bespoke buttons/inputs/cards with the shadcn set (Part 4), one component type at a time, verifying each view.
5. **Feedback layer:** standardize on sonner + banner patterns (Part 7), removing hand-rolled toast stacks.
6. **Motion:** apply Part 8 recipes; remove legacy animation one-offs.
7. **Do not** change information architecture, URLs, or user-learned workflows unless they violate Part 5 — a redesign should feel like the same app wearing the family visual language.
8. Verify with Part 13.

## 12.2 Converting from Streamlit (or similar Python UI) to React

The Streamlit app is a **specification of content and behavior**, not of design. Inventory every widget and data flow, then translate:

| Streamlit                                                                   | React equivalent (this system)                                                                                                               |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `st.title` / `st.header` / `st.subheader`                             | Page title / section title / CardTitle per §3.5                                                                                             |
| `st.markdown` prose                                                       | Page subtitle, CardDescription, or guide page (§9.1)                                                                                        |
| `st.sidebar`                                                              | `Sidebar` layout component (§5.1) — nav + filters split: navigation stays in sidebar; *data filters move to the filter region* (§5.2) |
| `st.metric` (+delta)                                                      | StatCard with trend indicator (§6.1)                                                                                                        |
| `st.dataframe` / `st.table`                                             | DataTable (tanstack) / shadcn Table (§4.7)                                                                                                  |
| `st.line_chart` / `st.bar_chart` / plotly                               | recharts Line/Bar in ChartCard (§6.2)                                                                                                       |
| `st.selectbox` / `st.multiselect`                                       | shadcn`Select` / multi-select combobox; option pills if ≤8 choices (§4.4)                                                                |
| `st.radio`                                                                | Option pills (§4.4)                                                                                                                         |
| `st.slider` (numeric score)                                               | Option pills for discrete scales; shadcn`Slider` for continuous                                                                            |
| `st.text_input` / `st.text_area` / `st.date_input`                    | Input / Textarea / date Input with Label (§4.3)                                                                                             |
| `st.button`                                                               | Button with correct variant + lifecycle (§4.1, §7.3)                                                                                       |
| `st.form` + `st.form_submit_button`                                     | react-hook-form + zod (Part 10)                                                                                                              |
| `st.file_uploader`                                                        | Styled dropzone card (border-dashed, muted) + file list                                                                                      |
| `st.spinner` / `st.progress`                                            | Skeleton / Progress (§4.9, §7.4)                                                                                                           |
| `st.toast` / `st.success` / `st.error` / `st.warning` / `st.info` | sonner toast for events; semantic banner for conditions (§7.1–7.2)                                                                         |
| `st.expander`                                                             | Accordion / collapsible advanced section (§4.8)                                                                                             |
| `st.tabs`                                                                 | shadcn Tabs (§4.6)                                                                                                                          |
| `st.columns`                                                              | Tailwind grid (§5.3)                                                                                                                        |
| `st.session_state`                                                        | React state/context; server state via fetch hooks                                                                                            |
| `@st.cache_data` + inline pandas                                          | FastAPI (or equivalent) endpoints returning JSON; computation moves server-side                                                              |

Conversion rules:

- Streamlit's top-to-bottom rerun model becomes explicit state: identify what each widget invalidates and wire it as controlled state + effects; add the loading/feedback states Streamlit gave you for free (Part 7 — this is the most commonly forgotten step).
- Streamlit apps are usually one long page; restructure into the page anatomy of §5.2, and split into routes when there are clearly separate audiences/tasks.
- Re-write all copy to Part 9 standards (Streamlit prototypes tend to have developer-voiced text).
- Keep calculation parity: before styling, verify the React version reproduces the same numbers as the source app on the same data.

---

# Part 13 — Acceptance Checklist (agent must self-verify before finishing)

**Visual system**

- [ ] Zero literal colors in components — everything through tokens; brand change = edit `globals.css` only.
- [ ] Light mode: borderless tinted cards; dark mode: lighter-than-bg cards with subtle borders.
- [ ] Semantic colors used only with their fixed meanings; no color-only signals.
- [ ] Typography scale and IBM Plex Sans applied; one h1 per page; captions muted.
- [ ] Spacing uses the 8px Tailwind scale; card padding `p-6`; sections `space-y-6`.

**Components & layout**

- [ ] All primitives are shadcn/ui from `components/ui/`, token-styled, single implementation each.
- [ ] Page anatomy order: header → filters → KPIs → detail → actions.
- [ ] One solid-primary button per section; explicit verb labels; destructive actions confirmed.
- [ ] Tables scroll in their own wrapper; numerics `tabular-nums`; empty states designed.

**Feedback & motion**

- [ ] Every action: pressed state + loading state + success/failure feedback (sonner toast or banner).
- [ ] Skeletons for loading content; branded full-page load screen.
- [ ] Entrance/exit motion per Part 8; reduced-motion honored.

**Guidance & language**

- [ ] Page subtitles, card descriptions, and field helper text present; info-tips on derived metrics.
- [ ] Copy follows §9.3 (voice, casing, error style, status vocabulary).

**Charts**

- [ ] Every chart: legend or direct labels, tooltip, responsive container, filter-aware, stated scope.

**Accessibility & responsive**

- [ ] Focus rings, aria labels/roles, keyboard nav, contrast per Part 11.
- [ ] Verified at 375 / 768 / 1024 / 1440 px: no clipping, overlap, or horizontal scroll.

**Consistency**

- [ ] New screens are visually indistinguishable in style from a CWS CX platform screen.
- [ ] No second visual language introduced anywhere.

---

# Appendix A — Current Platform Inventory and Known Inconsistencies (repo-specific, as of 2026-07-07)

This appendix records what exists in *this* repository and where it diverges from the canon above. Use it as the alignment backlog when touching these apps. New apps must not inherit any of these divergences.

## A.1 Inventory

| App                           | Path                             | Stack state                                                  | Token system                                                                                                | Notes                                                                                     |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Admin Dashboard (production)  | `frontend/dashboard`           | JS, monolithic 3.3k-line`App.jsx`, 2.1k-line `index.css` | **Legacy**: hand-rolled light tokens overridden by dark `glass-theme.css` via `!important`        | sonner ✔, recharts ✔ + hand-rolled conic-gradient pies ✖, GSAP+framer ✔, info-tips ✔ |
| Dashboard Blueprint (rebuild) | `frontend/dashboard-blueprint` | JS, feature-foldered, tanstack table, RHF+zod                | **Canonical shadcn HSL** (light+dark)                                                                 | Closest to this document; hand-rolled toast stack ✖ (should be sonner)                   |
| B2B Survey                    | `frontend/survey`              | TS                                                           | Canonical shadcn HSL (light+dark)                                                                           | Hand-rolled toast stack ✖; duplicate`.jsx`/`.tsx` ui files ✖                        |
| Mystery Shopper Survey        | `frontend/mystery-shopper`     | JS, dual auth modes                                          | shadcn HSL**light only — no `.dark` block** ✖                                                     | router v7 (others v6) ✖; option-pill pattern ✔ (canonical origin)                       |
| Installation Survey           | `frontend/installation-survey` | Mixed JS/TS duplicates ✖                                    | shadcn HSL, best-commented,**but different primary** (`211 85% 59%` #4F8DE4 vs `211 100% 36%`) ✖ | Skeleton/Label ✔, tailwindcss-animate ✔                                                 |
| Unified Frontend              | `frontend-unified`             | Abandoned; build broken (esbuild mismatch); axios; no tokens | none                                                                                                        | Treat as archive — do not extend                                                         |

Shared legacy files: `frontend/glass-theme.css` + `frontend/shared-ui.css` (imported by dashboard and frontend-unified only).

## A.2 Inconsistencies observed (highest impact first) — status after the 2026-07-07 alignment sweep

A consistency sweep was applied on 2026-07-07 (user decisions: deep CWS blue standard; production dashboard gets targeted fixes only, keeping its dark glass identity; dependency alignment deferred).

1. **Two competing token systems.** ⚠ PARTIALLY RESOLVED (by decision). The production dashboard keeps `glass-theme.css` for its visual identity, but its Tailwind config now maps the canonical semantic classes (`bg-primary`, `border-input`, …) to a `--cx-*` token bridge in `index.css` (prefixed because the legacy theme uses `--border`/`--card`/`--muted` as rgba/hex values). Full migration remains the dashboard-blueprint app's role.
2. **Brand primary drift.** ✅ RESOLVED. Standard everywhere: `211 100% 36%` light / `213 74% 53%` dark. installation-survey retokenized.
3. **Semantic token corruption in glass theme.** ✅ RESOLVED. `--success-bg/--success-fg` in `glass-theme.css` are now green (`rgba(16,185,129,0.24)` / `#a7f3d0`).
4. **Dark mode coverage.** ✅ RESOLVED. survey and mystery-shopper now carry canonical `.dark` blocks; all four shadcn apps have identical light+dark token sets.
5. **Toast fragmentation.** ✅ RESOLVED. sonner (`<Toaster position="top-right" richColors closeButton />`) in dashboard, survey, and dashboard-blueprint; hand-rolled stacks removed (`pushToast` now delegates to sonner). mystery/installation use inline banners for persistent conditions, per §7.2.
6. **Non-tokenized shadcn components.** ✅ RESOLVED. dashboard and mystery-shopper `components/ui/*` now use semantic token classes; survey's shadowing legacy `.jsx` copies deleted so the token-based `.tsx` versions resolve. (Dashboard keeps its `h-9` button sizes deliberately for visual parity — do not "fix" without a coordinated pass.)
7. **Two spacing systems loaded at once in dashboard.** ✅ RESOLVED. Golden-ratio `--space-1..6` definitions removed from `dashboard/src/index.css`; usages remapped to the nearest 8px-scale tokens from `shared-ui.css` (8→8, 13→12, 21→20, 34→32, 55→48, 89→80).
8. **Duplicate file variants.** ✅ RESOLVED. Deleted: survey `button/input/select/textarea/radio-group/tabs.jsx` + `lib/utils.js` (`.tsx`/`.ts` remain); installation `App.tsx` + `auth.ts` (dead — `App.jsx`/`auth.js` are the live, feature-complete versions); mystery unused `separator.jsx`/`tabs.jsx`.
9. **Dependency drift.** ⏸ DEFERRED (user decision). react-router v6 vs v7; recharts v2 vs v3; framer-motion v11 vs v12; lucide versions. Align in a coordinated maintenance pass with per-app testing.
10. **Hand-rolled charts.** ⏳ OPEN. Dashboard NPS pies are CSS conic gradients. → recharts donut per §6.2 (blueprint already does this) — part of the eventual full dashboard migration.
11. **Tabs active-state styling.** ⏳ OPEN in dashboard (glass gradient kept for identity); shadcn apps follow §4.6.
12. **Tooltip/guidance coverage is uneven.** ⏳ OPEN. Derived metrics in survey apps should gain info-tips per §9.1.
13. **frontend-unified.** ⏳ OPEN (untouched by design). Archive it; never extend.
14. **Accent token.** ✅ RESOLVED (found during sweep). survey/mystery/blueprint had a saturated cyan `--accent` (`188 100% 39%`), making ghost/outline hovers bright cyan. All apps now use the canonical light-tint hover accent (`214 100% 96%` light / `217 33% 17%` dark).
