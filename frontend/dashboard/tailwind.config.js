/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Canonical semantic tokens (see docs/design/DESIGN_SYSTEM.md §3.1).
      // Prefixed --cx-* because the legacy theme already uses --border/--card/
      // --muted etc. as rgba/hex values consumed directly by var() in CSS.
      colors: {
        border: "hsl(var(--cx-border))",
        input: "hsl(var(--cx-input))",
        ring: "hsl(var(--cx-ring))",
        background: "hsl(var(--cx-background))",
        foreground: "hsl(var(--cx-foreground))",
        primary: {
          DEFAULT: "hsl(var(--cx-primary))",
          foreground: "hsl(var(--cx-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--cx-secondary))",
          foreground: "hsl(var(--cx-secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--cx-destructive))",
          foreground: "hsl(var(--cx-destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--cx-success))",
          foreground: "hsl(var(--cx-success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--cx-warning))",
          foreground: "hsl(var(--cx-warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--cx-muted))",
          foreground: "hsl(var(--cx-muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--cx-accent))",
          foreground: "hsl(var(--cx-accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--cx-popover))",
          foreground: "hsl(var(--cx-popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--cx-card))",
          foreground: "hsl(var(--cx-card-foreground))",
        },
      },
    },
  },
  plugins: []
};
