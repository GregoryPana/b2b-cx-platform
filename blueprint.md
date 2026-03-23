# CWS Dashboard Design System Blueprint

Executive Summary
This document serves as the canonical design system rulebook for all Cable and Wireless Seychelles (CWS) dashboard applications. It is optimized for AI-driven code generation using React + Tailwind CSS + shadcn/ui and establishes strict, non-negotiable patterns for consistent, professional SaaS dashboard development.

Tech Stack Declaration
typescript// MANDATORY STACK - NO EXCEPTIONS
{
"framework": "React 18+",
"styling": "Tailwind CSS 3+",
"components": "shadcn/ui (EXCLUSIVE)",
"stateManagement": "React Context / Zustand / Redux (as needed)",
"routing": "React Router v6+",
"icons": "lucide-react (bundled with shadcn)",
"charts": "recharts (shadcn compatible)",
"forms": "react-hook-form + zod",
"utilities": "clsx / cn (shadcn utility)"
}

```

**CRITICAL RULE: ALL UI components MUST come from shadcn/ui library. Never create custom components that shadcn already provides. Never use other component libraries.**

---

## Foundation Architecture

### 1. Directory Structure (Non-Negotiable)
```

src/
├── components/
│ ├── ui/ # shadcn components (auto-generated)
│ │ ├── button.tsx
│ │ ├── card.tsx
│ │ ├── input.tsx
│ │ ├── table.tsx
│ │ ├── dialog.tsx
│ │ └── ... (all shadcn components)
│ ├── layout/ # Layout components
│ │ ├── Sidebar.tsx # MANDATORY for all dashboards
│ │ ├── Header.tsx
│ │ ├── MainLayout.tsx
│ │ └── PageContainer.tsx
│ ├── dashboard/ # Dashboard-specific components
│ │ ├── StatCard.tsx
│ │ ├── ChartCard.tsx
│ │ └── DataTable.tsx
│ └── features/ # Feature-specific components
│ └── [feature-name]/
├── lib/
│ ├── utils.ts # cn() utility from shadcn
│ └── constants.ts # Design tokens, configs
├── hooks/ # Custom React hooks
├── styles/
│ └── globals.css # Tailwind + custom CSS
└── App.tsx

Design Token System (Tailwind Config)
tailwind.config.ts - Complete Configuration
typescriptimport type { Config } from "tailwindcss"

const config = {
darkMode: ["class"],
content: [
'./pages/**/*.{ts,tsx}',
'./components/**/*.{ts,tsx}',
'./app/**/*.{ts,tsx}',
'./src/**/*.{ts,tsx}',
],
prefix: "",
theme: {
container: {
center: true,
padding: "2rem",
screens: {
"2xl": "1400px",
},
},
extend: {
colors: {
border: "hsl(var(--border))",
input: "hsl(var(--input))",
ring: "hsl(var(--ring))",
background: "hsl(var(--background))",
foreground: "hsl(var(--foreground))",
primary: {
DEFAULT: "hsl(var(--primary))",
foreground: "hsl(var(--primary-foreground))",
},
secondary: {
DEFAULT: "hsl(var(--secondary))",
foreground: "hsl(var(--secondary-foreground))",
},
destructive: {
DEFAULT: "hsl(var(--destructive))",
foreground: "hsl(var(--destructive-foreground))",
},
muted: {
DEFAULT: "hsl(var(--muted))",
foreground: "hsl(var(--muted-foreground))",
},
accent: {
DEFAULT: "hsl(var(--accent))",
foreground: "hsl(var(--accent-foreground))",
},
popover: {
DEFAULT: "hsl(var(--popover))",
foreground: "hsl(var(--popover-foreground))",
},
card: {
DEFAULT: "hsl(var(--card))",
foreground: "hsl(var(--card-foreground))",
},
},
borderRadius: {
lg: "var(--radius)",
md: "calc(var(--radius) - 2px)",
sm: "calc(var(--radius) - 4px)",
},
spacing: {
'18': '4.5rem',
'88': '22rem',
'112': '28rem',
'128': '32rem',
},
keyframes: {
"accordion-down": {
from: { height: "0" },
to: { height: "var(--radix-accordion-content-height)" },
},
"accordion-up": {
from: { height: "var(--radix-accordion-content-height)" },
to: { height: "0" },
},
"slide-in-right": {
"0%": { transform: "translateX(100%)" },
"100%": { transform: "translateX(0)" },
},
"fade-in": {
"0%": { opacity: "0" },
"100%": { opacity: "1" },
},
shimmer: {
"0%": { backgroundPosition: "-200% 0" },
"100%": { backgroundPosition: "200% 0" },
},
},
animation: {
"accordion-down": "accordion-down 0.2s ease-out",
"accordion-up": "accordion-up 0.2s ease-out",
"slide-in-right": "slide-in-right 0.3s ease-out",
"fade-in": "fade-in 0.2s ease-out",
"shimmer": "shimmer 1.5s ease-in-out infinite",
},
backdropBlur: {
xs: '2px',
},
},
},
plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
globals.css - CWS Theme Variables
css@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
:root {
/_ ============== CWS BRAND COLORS (LIGHT MODE) ============== _/

    /* Background Hierarchy */
    --background: 0 0% 100%;              /* #FFFFFF - Pure white page bg */
    --foreground: 222.2 84% 4.9%;         /* #020817 - Primary text */

    /* Card Styling - LIGHT MODE RULE: Different color, NO border */
    --card: 214 100% 97%;                 /* #EAF2FF - Light blue tint */
    --card-foreground: 222.2 84% 4.9%;    /* #020817 - Card text */

    /* Muted / Secondary Surfaces */
    --muted: 210 40% 96.1%;               /* #F1F5F9 - Subtle bg */
    --muted-foreground: 215.4 16.3% 46.9%; /* #64748B - Muted text */

    /* Borders & Inputs */
    --border: 214.3 31.8% 91.4%;          /* #E2E8F0 - Standard border */
    --input: 214.3 31.8% 91.4%;           /* #E2E8F0 - Input border */

    /* CWS Primary Blue Accent */
    --primary: 211 85% 59%;               /* #4F8DE4 - CWS Blue */
    --primary-foreground: 210 40% 98%;    /* #F8FAFC - Text on primary */

    /* Secondary (Neutral) */
    --secondary: 210 40% 96.1%;           /* #F1F5F9 - Light gray */
    --secondary-foreground: 222.2 47.4% 11.2%; /* #1E293B - Dark text */

    /* Semantic Colors */
    --destructive: 0 84.2% 60.2%;         /* #EF4444 - Red/Danger */
    --destructive-foreground: 210 40% 98%; /* #F8FAFC */

    --success: 142 71% 45%;               /* #10B981 - Green */
    --success-foreground: 210 40% 98%;    /* #F8FAFC */

    --warning: 38 92% 50%;                /* #F59E0B - Amber */
    --warning-foreground: 222.2 84% 4.9%; /* #020817 */

    /* Interactive Elements */
    --accent: 210 40% 96.1%;              /* #F1F5F9 - Hover states */
    --accent-foreground: 222.2 47.4% 11.2%; /* #1E293B */

    --popover: 0 0% 100%;                 /* #FFFFFF */
    --popover-foreground: 222.2 84% 4.9%; /* #020817 */

    /* Focus Ring */
    --ring: 211 85% 59%;                  /* #4F8DE4 - Matches primary */

    /* Border Radius */
    --radius: 0.75rem;                    /* 12px - Modern, rounded */

}

.dark {
/_ ============== CWS DARK MODE COLORS ============== _/

    /* Background Hierarchy - Deep blue-black gradient feel */
    --background: 222 47% 7%;             /* #0A1628 - Dark base */
    --foreground: 210 40% 98%;            /* #F8FAFC - Light text */

    /* Card Styling - DARK MODE RULE: Same as bg, WITH subtle border */
    --card: 222 47% 7%;                   /* #0A1628 - Match background */
    --card-foreground: 210 40% 98%;       /* #F8FAFC - Light text */

    /* Muted / Secondary Surfaces */
    --muted: 217 33% 17%;                 /* #1E293B - Slightly elevated */
    --muted-foreground: 215 20% 65%;      /* #94A3B8 - Muted text */

    /* Borders & Inputs - SUBTLE in dark mode */
    --border: 215 25% 20%;                /* rgba(140, 173, 219, 0.2) approx */
    --input: 215 25% 20%;                 /* Same as border */

    /* CWS Primary Blue - Slightly brighter in dark */
    --primary: 211 85% 59%;               /* #4F8DE4 - CWS Blue */
    --primary-foreground: 222 47% 7%;     /* #0A1628 - Dark text on blue */

    /* Secondary */
    --secondary: 217 33% 17%;             /* #1E293B - Dark elevated */
    --secondary-foreground: 210 40% 98%;  /* #F8FAFC */

    /* Semantic Colors - Same as light mode */
    --destructive: 0 62.8% 30.6%;         /* Darker red for dark mode */
    --destructive-foreground: 210 40% 98%;

    --success: 142 71% 45%;
    --success-foreground: 210 40% 98%;

    --warning: 38 92% 50%;
    --warning-foreground: 222 47% 7%;

    /* Interactive Elements */
    --accent: 217 33% 17%;                /* #1E293B - Hover state */
    --accent-foreground: 210 40% 98%;

    --popover: 222 47% 11%;               /* #0F1F36 - Elevated popover */
    --popover-foreground: 210 40% 98%;

    --ring: 211 85% 59%;                  /* #4F8DE4 */

}
}

@layer base {

- {
  @apply border-border;
  }
  body {
  @apply bg-background text-foreground;
  font-feature-settings: "rlig" 1, "calt" 1;
  }
  }

@layer utilities {
/_ Glassmorphism Utilities - Use sparingly _/
.glass-effect {
@apply backdrop-blur-md bg-white/10 dark:bg-white/5;
}

.glass-border {
@apply border border-white/20 dark:border-white/10;
}

/_ Custom scrollbar _/
.custom-scrollbar::-webkit-scrollbar {
width: 8px;
height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
@apply bg-transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
@apply bg-muted-foreground/20 rounded-full hover:bg-muted-foreground/30;
}

/_ Shimmer effect for loading states _/
.shimmer {
background: linear-gradient(
90deg,
transparent 0%,
rgba(255, 255, 255, 0.1) 50%,
transparent 100%
);
background-size: 200% 100%;
@apply animate-shimmer;
}
}

Mandatory Layout Architecture
Rule: ALL Dashboards MUST Use Sidebar + Main Content Layout
Rationale:

Consistency: Users expect SaaS dashboards to have persistent navigation
Scalability: Sidebars accommodate growing feature sets without header bloat
Context Preservation: Users always know where they are in the application
Mobile Adaptability: Sidebars collapse to hamburger menus responsively
Industry Standard: Aligns with enterprise SaaS expectations (Stripe, Vercel, AWS Console)

MainLayout.tsx - The Master Template
typescript// src/components/layout/MainLayout.tsx
import { useState } from "react"
import { cn } from "@/lib/utils"
import Sidebar from "./Sidebar"
import Header from "./Header"

interface MainLayoutProps {
children: React.ReactNode
}

/\*\*

- MANDATORY LAYOUT FOR ALL DASHBOARDS
-
- Structure:
- - Sidebar: Fixed left, collapsible, 280px default / 80px collapsed
- - Header: Sticky top, contains breadcrumbs, search, user menu
- - Main Content: Scrollable, responsive grid
-
- @layout Desktop: [Sidebar][Main Content]
- @layout Mobile: [Collapsed Sidebar][Main Content]
  \*/
  export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

return (

<div className="relative flex min-h-screen bg-background">
{/_ Sidebar - ALWAYS PRESENT _/}
<Sidebar
collapsed={sidebarCollapsed}
onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
/>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        {/* Header - Sticky */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>

)
}
Sidebar.tsx - Navigation Component
typescript// src/components/layout/Sidebar.tsx
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
LayoutDashboard,
BarChart3,
Users,
Settings,
ChevronLeft,
ChevronRight
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"

interface SidebarProps {
collapsed: boolean
onToggle: () => void
}

interface NavItem {
label: string
href: string
icon: React.ElementType
badge?: number
}

// DEFINE YOUR NAVIGATION STRUCTURE HERE
const navigationItems: NavItem[] = [
{ label: "Dashboard", href: "/", icon: LayoutDashboard },
{ label: "Analytics", href: "/analytics", icon: BarChart3 },
{ label: "Customers", href: "/customers", icon: Users, badge: 3 },
{ label: "Settings", href: "/settings", icon: Settings },
]

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
const location = useLocation()

return (

<aside
className={cn(
"fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300",
collapsed ? "w-20" : "w-72"
)} >
{/_ Logo Section _/}
<div className="flex h-16 items-center justify-between border-b px-6">
{!collapsed && (
<div className="flex items-center gap-2">
<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
CWS
</div>
<span className="text-lg font-semibold">CWS Portal</span>
</div>
)}

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn("h-8 w-8", collapsed && "mx-auto")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href

          return (
            <Link key={item.href} to={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  collapsed ? "px-2" : "px-4",
                  isActive && "bg-primary/10 text-primary hover:bg-primary/20"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Button>
            </Link>
          )
        })}
      </nav>
    </aside>

)
}
Header.tsx - Top Navigation Bar
typescript// src/components/layout/Header.tsx
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuLabel,
DropdownMenuSeparator,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Bell, Moon, Sun } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"

export default function Header() {
const { theme, toggleTheme } = useTheme()

return (

<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-6">
{/_ Left: Breadcrumb / Page Title _/}
<div className="flex items-center gap-4">
<h1 className="text-lg font-semibold">Dashboard Overview</h1>
</div>

      {/* Right: Search, Notifications, Theme Toggle, User Menu */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-9"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarImage src="/avatar.jpg" alt="User" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">john@cws.sc</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

)
}
PageContainer.tsx - Content Wrapper
typescript// src/components/layout/PageContainer.tsx
import { cn } from "@/lib/utils"

interface PageContainerProps {
children: React.ReactNode
className?: string
}

/\*\*

- Standard page content container
- Provides consistent padding and max-width
  \*/
  export default function PageContainer({ children, className }: PageContainerProps) {
  return (
  <div className={cn("mx-auto w-full max-w-[1600px] p-6 md:p-8", className)}>
  {children}
  </div>
  )
  }

Grid System Architecture
MANDATORY: 12-Column Responsive Grid
All dashboard content MUST follow this grid structure:
typescript// Example Dashboard Page
import PageContainer from "@/components/layout/PageContainer"

export default function DashboardPage() {
return (
<PageContainer>
{/_ Page Header _/}

<div className="mb-8">
<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
<p className="text-muted-foreground">Welcome back! Here's your overview.</p>
</div>

      {/* GRID STRUCTURE - 12 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Each stat card spans 1 column on lg screens (4 cards per row) */}
        <StatCard title="Total Revenue" value="$45,231" change="+12.5%" />
        <StatCard title="Active Users" value="2,845" change="+8.2%" />
        <StatCard title="Conversion Rate" value="3.24%" change="-2.1%" />
        <StatCard title="Avg Response" value="1.2s" change="+15%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Main chart - 8 columns */}
        <div className="lg:col-span-8">
          <ChartCard title="Revenue Over Time">
            {/* Chart component */}
          </ChartCard>
        </div>

        {/* Side chart - 4 columns */}
        <div className="lg:col-span-4">
          <ChartCard title="Traffic Sources">
            {/* Donut chart */}
          </ChartCard>
        </div>
      </div>

      {/* Full-width table */}
      <div className="grid grid-cols-1">
        <DataTableCard title="Recent Transactions">
          {/* Table component */}
        </DataTableCard>
      </div>
    </PageContainer>

)
}
Grid Breakpoint Behavior
typescript// Tailwind Grid Classes - Standard Pattern

// 1 Column Layout (Mobile)
grid-cols-1

// 2 Column Layout (Tablet - md: 768px+)
md:grid-cols-2

// 3 Column Layout (Desktop - lg: 1024px+)
lg:grid-cols-3

// 4 Column Layout (Large Desktop - lg: 1024px+)
lg:grid-cols-4

// 12 Column Grid (Flexible layouts)
lg:grid-cols-12
lg:col-span-3 // Quarter width
lg:col-span-4 // Third width
lg:col-span-6 // Half width
lg:col-span-8 // Two-thirds width
lg:col-span-12 // Full width

// Standard Gap Spacing
gap-4 // 16px - Compact layouts
gap-6 // 24px - STANDARD (use this by default)
gap-8 // 32px - Generous spacing

Card Styling Rules (CRITICAL)
Light Mode: Colored Background, NO Border
typescript// Light mode card (automatically applied via CSS variables)
<Card className="border-0">
<CardHeader>
<CardTitle>Revenue Overview</CardTitle>
</CardHeader>
<CardContent>
{/_ Content _/}
</CardContent>
</Card>
Explanation:

Light mode uses --card: 214 100% 97% (#EAF2FF - light blue tint)
This creates visual separation from white background WITHOUT needing borders
Borders in light mode create visual clutter and feel "boxed in"
The subtle color difference provides clean, modern hierarchy
Think: Stripe dashboard, Linear app - minimal borders, color separation

Dark Mode: Same Color as Background, Subtle Border
typescript// Dark mode card (automatically styled via theme)
<Card>
<CardHeader>
<CardTitle>Revenue Overview</CardTitle>
</CardHeader>
<CardContent>
{/_ Content _/}
</CardContent>
</Card>
Explanation:

Dark mode uses --card: 222 47% 7% (#0A1628 - matches background)
Border is --border: 215 25% 20% (subtle, low-contrast)
Borders are NECESSARY in dark mode because:

Same color cards would blend into background
Subtle borders create depth without harshness
Maintains glassmorphism aesthetic
Prevents "floating content" feel

Think: GitHub dark theme, Vercel dashboard - subtle borders for definition

Implementation in Card Component
typescript// src/components/ui/card.tsx (shadcn generated, potentially customized)
import \* as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => (

  <div
    ref={ref}
    className={cn(
      "rounded-xl bg-card text-card-foreground shadow-sm",
      // Light mode: no border (color separation sufficient)
      "border-0",
      // Dark mode: subtle border
      "dark:border dark:border-border",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

// Export other card components...
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

shadcn/ui Component Usage Rules
Installation Pattern
bash# Initialize shadcn in your project (one-time setup)
npx shadcn-ui@latest init

# Install components as needed (ALWAYS use shadcn components)

npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add select
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add command
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add form
Component Usage Examples

1. Stat Card Component
   typescript// src/components/dashboard/StatCard.tsx
   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
   import { Badge } from "@/components/ui/badge"
   import { TrendingUp, TrendingDown } from "lucide-react"
   import { cn } from "@/lib/utils"

interface StatCardProps {
title: string
value: string | number
change?: string
trend?: "up" | "down"
icon?: React.ReactNode
}

export default function StatCard({ title, value, change, trend, icon }: StatCardProps) {
const isPositive = trend === "up"

return (
<Card>
<CardHeader className="flex flex-row items-center justify-between pb-2">
<CardTitle className="text-sm font-medium text-muted-foreground">
{title}
</CardTitle>
{icon && <div className="text-muted-foreground">{icon}</div>}
</CardHeader>
<CardContent>

<div className="text-3xl font-bold">{value}</div>
{change && (
<div className="mt-2 flex items-center gap-2">
<Badge
variant={isPositive ? "default" : "destructive"}
className={cn(
"flex items-center gap-1",
isPositive ? "bg-success/10 text-success hover:bg-success/20" : ""
)} >
{isPositive ? (
<TrendingUp className="h-3 w-3" />
) : (
<TrendingDown className="h-3 w-3" />
)}
{change}
</Badge>
<span className="text-xs text-muted-foreground">vs last month</span>
</div>
)}
</CardContent>
</Card>
)
} 2. Chart Card Component
typescript// src/components/dashboard/ChartCard.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ChartCardProps {
title: string
description?: string
children: React.ReactNode
actions?: React.ReactNode
}

export default function ChartCard({ title, description, children, actions }: ChartCardProps) {
return (
<Card>
<CardHeader>

<div className="flex items-center justify-between">
<div>
<CardTitle>{title}</CardTitle>
{description && <CardDescription>{description}</CardDescription>}
</div>
{actions && <div className="flex gap-2">{actions}</div>}
</div>
</CardHeader>
<CardContent className="h-[400px]">
{children}
</CardContent>
</Card>
)
} 3. Data Table with shadcn Table
typescript// src/components/dashboard/DataTable.tsx
import {
Table,
TableBody,
TableCaption,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Transaction {
id: string
customer: string
amount: number
status: "completed" | "pending" | "failed"
date: string
}

interface DataTableProps {
data: Transaction[]
}

export default function DataTable({ data }: DataTableProps) {
const getStatusVariant = (status: string) => {
switch (status) {
case "completed":
return "default"
case "pending":
return "secondary"
case "failed":
return "destructive"
default:
return "default"
}
}

return (

<Table>
<TableCaption>Recent transaction history</TableCaption>
<TableHeader>
<TableRow>
<TableHead>Transaction ID</TableHead>
<TableHead>Customer</TableHead>
<TableHead>Amount</TableHead>
<TableHead>Status</TableHead>
<TableHead>Date</TableHead>
<TableHead className="w-12"></TableHead>
</TableRow>
</TableHeader>
<TableBody>
{data.map((transaction) => (
<TableRow key={transaction.id}>
<TableCell className="font-mono text-sm">{transaction.id}</TableCell>
<TableCell>{transaction.customer}</TableCell>
<TableCell className="font-semibold">
${transaction.amount.toLocaleString()}
</TableCell>
<TableCell>
<Badge variant={getStatusVariant(transaction.status)}>
{transaction.status}
</Badge>
</TableCell>
<TableCell className="text-muted-foreground">
{transaction.date}
</TableCell>
<TableCell>
<DropdownMenu>
<DropdownMenuTrigger asChild>
<Button variant="ghost" size="icon">
<MoreHorizontal className="h-4 w-4" />
</Button>
</DropdownMenuTrigger>
<DropdownMenuContent align="end">
<DropdownMenuItem>View details</DropdownMenuItem>
<DropdownMenuItem>Download receipt</DropdownMenuItem>
<DropdownMenuItem className="text-destructive">
Refund
</DropdownMenuItem>
</DropdownMenuContent>
</DropdownMenu>
</TableCell>
</TableRow>
))}
</TableBody>
</Table>
)
} 4. Modal/Dialog Example
typescript// src/components/dashboard/CreateReportDialog.tsx
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function CreateReportDialog() {
return (

<Dialog>
<DialogTrigger asChild>
<Button>Create Report</Button>
</DialogTrigger>
<DialogContent className="sm:max-w-[525px]">
<DialogHeader>
<DialogTitle>Create New Report</DialogTitle>
<DialogDescription>
Generate a custom report for your dashboard. Configure the parameters below.
</DialogDescription>
</DialogHeader>
<div className="grid gap-4 py-4">
<div className="grid gap-2">
<Label htmlFor="name">Report Name</Label>
<Input id="name" placeholder="Q1 2026 Revenue Analysis" />
</div>
<div className="grid gap-2">
<Label htmlFor="type">Report Type</Label>
<Select>
<SelectTrigger id="type">
<SelectValue placeholder="Select type" />
</SelectTrigger>
<SelectContent>
<SelectItem value="revenue">Revenue</SelectItem>
<SelectItem value="users">Users</SelectItem>
<SelectItem value="conversion">Conversion</SelectItem>
</SelectContent>
</Select>
</div>
<div className="grid gap-2">
<Label htmlFor="period">Time Period</Label>
<Select>
<SelectTrigger id="period">
<SelectValue placeholder="Select period" />
</SelectTrigger>
<SelectContent>
<SelectItem value="7d">Last 7 days</SelectItem>
<SelectItem value="30d">Last 30 days</SelectItem>
<SelectItem value="90d">Last 90 days</SelectItem>
<SelectItem value="1y">Last year</SelectItem>
</SelectContent>
</Select>
</div>
</div>
<DialogFooter>
<Button variant="outline">Cancel</Button>
<Button type="submit">Generate Report</Button>
</DialogFooter>
</DialogContent>
</Dialog>
)
}

State Management Patterns
Loading States with Skeleton
typescriptimport { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function StatCardSkeleton() {
return (
<Card>
<CardHeader className="pb-2">
<Skeleton className="h-4 w-24" />
</CardHeader>
<CardContent>
<Skeleton className="h-8 w-32 mb-2" />
<Skeleton className="h-4 w-20" />
</CardContent>
</Card>
)
}

// Usage in loading state
{isLoading ? (
<>
<StatCardSkeleton />
<StatCardSkeleton />
<StatCardSkeleton />
<StatCardSkeleton />
</>
) : (
stats.map(stat => <StatCard key={stat.id} {...stat} />)
)}
Empty States
typescriptimport { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

interface EmptyStateProps {
title: string
description: string
action?: {
label: string
onClick: () => void
}
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
return (
<Card>
<CardContent className="flex flex-col items-center justify-center py-16">
<FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />

<h3 className="text-lg font-semibold mb-2">{title}</h3>
<p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
{description}
</p>
{action && (
<Button onClick={action.onClick}>{action.label}</Button>
)}
</CardContent>
</Card>
)
}
Toast Notifications
typescript// src/hooks/useToast.ts (provided by shadcn)
import { useToast } from "@/components/ui/use-toast"

// Usage in component
export default function MyComponent() {
const { toast } = useToast()

const handleSuccess = () => {
toast({
title: "Success",
description: "Your report has been generated.",
})
}

const handleError = () => {
toast({
title: "Error",
description: "Failed to generate report. Please try again.",
variant: "destructive",
})
}

return (
<>
<Button onClick={handleSuccess}>Success Toast</Button>
<Button onClick={handleError}>Error Toast</Button>
</>
)
}

Typography & Text Hierarchy
Heading Scale (Tailwind Classes)
typescript// Page Title

<h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>

// Section Heading

<h2 className="text-2xl font-semibold tracking-tight">Analytics Overview</h2>

// Card Title (use CardTitle component)
<CardTitle>Revenue Trends</CardTitle>

// Small Heading

<h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
  Quick Stats
</h4>

// Body Text

<p className="text-base text-foreground">Regular paragraph text.</p>

// Muted/Secondary Text

<p className="text-sm text-muted-foreground">Supporting information.</p>

// Caption
<span className="text-xs text-muted-foreground">Last updated 2 hours ago</span>

// Code/Monospace
<code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
TXN-12345
</code>
Font Weight Usage
typescriptfont-normal // 400 - Body text
font-medium // 500 - Labels, nav items
font-semibold // 600 - Headings, emphasis
font-bold // 700 - Page titles, data values

Spacing & Layout Patterns
Consistent Spacing Scale
typescript// Component Internal Padding
p-6 // 24px - Standard card padding
p-8 // 32px - Page container padding
p-4 // 16px - Compact components

// Component Gaps
gap-6 // 24px - DEFAULT for grids
gap-4 // 16px - Compact layouts
gap-8 // 32px - Generous spacing

// Margin Between Sections
mb-8 // 32px - Section spacing
mb-6 // 24px - Component spacing
mb-4 // 16px - Element spacing

// Example Pattern
<PageContainer>

  <div className="mb-8">  {/* Page header */}
    <h1>...</h1>
  </div>
  
  <div className="grid gap-6 mb-8">  {/* Stats section */}
    <StatCard />
  </div>
  
  <div className="grid gap-6 mb-8">  {/* Charts section */}
    <ChartCard />
  </div>
  
  <div className="grid gap-6">  {/* Table section */}
    <TableCard />
  </div>
</PageContainer>

Animation & Interaction Guidelines
Hover States (Built into shadcn components)
typescript// Buttons automatically have hover states
<Button variant="default">
Hover me
</Button>

// Cards with hover effect
<Card className="transition-all hover:shadow-lg hover:-translate-y-1">
<CardContent>Hover effect</CardContent>
</Card>

// Custom hover on links
<a className="text-primary underline-offset-4 hover:underline">
Learn more
</a>
Transitions
typescript// Standard transition (use everywhere)
className="transition-all duration-200"

// Slow transition (for complex changes)
className="transition-all duration-300"

// Transform transitions (performant)
className="transition-transform duration-200 hover:scale-105"
Loading Animations
typescript// Spinner (custom component using lucide icon)
import { Loader2 } from "lucide-react"

<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>

// Pulse effect

<div className="animate-pulse">
  <Skeleton />
</div>

Accessibility Checklist
Mandatory Requirements
typescript// 1. Semantic HTML (shadcn handles this)
<Button> // Renders as <button>

<Dialog>         // Uses <dialog> with ARIA
<Table>          // Proper <table> structure

// 2. Keyboard Navigation
// All shadcn components support Tab, Enter, Escape

// 3. Focus Indicators (automatic in shadcn)
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring

// 4. ARIA Labels for icon-only buttons
<Button variant="ghost" size="icon" aria-label="Open settings">
<Settings className="h-4 w-4" />
</Button>

// 5. Color Contrast (enforced by theme)
// All text colors meet WCAG AA standards

// 6. Alternative Text
<Avatar>
<AvatarImage src="..." alt="User profile picture" />
<AvatarFallback>JD</AvatarFallback>
</Avatar>

// 7. Form Labels
<Label htmlFor="email">Email Address</Label>
<Input id="email" type="email" />

// 8. Loading States

<div role="status" aria-live="polite">
  <Skeleton />
  <span className="sr-only">Loading...</span>
</div>

Responsive Design Rules
Mobile-First Breakpoints
typescript// Default: Mobile (< 640px)
className="flex flex-col"

// Small tablet: sm (640px+)
className="sm:flex-row"

// Tablet: md (768px+)
className="md:grid-cols-2"

// Desktop: lg (1024px+)
className="lg:grid-cols-4"

// Large desktop: xl (1280px+)
className="xl:max-w-7xl"

// Extra large: 2xl (1536px+)
className="2xl:max-w-[1600px]"
Common Responsive Patterns
typescript// Sidebar collapse
<Sidebar className="w-20 lg:w-72" />

// Grid stacking

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

// Text size scaling

<h1 className="text-2xl md:text-3xl lg:text-4xl">

// Hide on mobile

<div className="hidden md:block">Desktop only</div>

// Show on mobile

<div className="md:hidden">Mobile only</div>

// Padding adjustment

<div className="p-4 md:p-6 lg:p-8">

Performance Optimization
Code Splitting (React.lazy)
typescriptimport { lazy, Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"))

<Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
<AnalyticsPage />
</Suspense>
Memoization
typescriptimport { memo } from "react"

const StatCard = memo(({ title, value, change }: StatCardProps) => {
return (
<Card>
{/_ Component JSX _/}
</Card>
)
})

export default StatCard
Virtual Scrolling for Large Tables
typescript// Use @tanstack/react-virtual with shadcn Table
import { useVirtualizer } from "@tanstack/react-virtual"

// Implementation for 1000+ row tables

Forms with React Hook Form + Zod
Form Setup Pattern
typescript// src/components/forms/UserForm.tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import \* as z from "zod"
import { Button } from "@/components/ui/button"
import {
Form,
FormControl,
FormDescription,
FormField,
FormItem,
FormLabel,
FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
username: z.string().min(2, {
message: "Username must be at least 2 characters.",
}),
email: z.string().email({
message: "Please enter a valid email address.",
}),
})

export default function UserForm() {
const form = useForm<z.infer<typeof formSchema>>({
resolver: zodResolver(formSchema),
defaultValues: {
username: "",
email: "",
},
})

function onSubmit(values: z.infer<typeof formSchema>) {
console.log(values)
}

return (

<Form {...form}>
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
<FormField
control={form.control}
name="username"
render={({ field }) => (
<FormItem>
<FormLabel>Username</FormLabel>
<FormControl>
<Input placeholder="johndoe" {...field} />
</FormControl>
<FormDescription>
This is your public display name.
</FormDescription>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="email"
render={({ field }) => (
<FormItem>
<FormLabel>Email</FormLabel>
<FormControl>
<Input type="email" placeholder="john@example.com" {...field} />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<Button type="submit">Submit</Button>
</form>
</Form>
)
}

Complete Example Dashboard Page
typescript// src/pages/Dashboard.tsx
import { useState, useEffect } from "react"
import PageContainer from "@/components/layout/PageContainer"
import StatCard from "@/components/dashboard/StatCard"
import ChartCard from "@/components/dashboard/ChartCard"
import DataTable from "@/components/dashboard/DataTable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
Download,
DollarSign,
Users,
TrendingUp,
Clock
} from "lucide-react"
import StatCardSkeleton from "@/components/dashboard/StatCardSkeleton"
import EmptyState from "@/components/dashboard/EmptyState"

export default function Dashboard() {
const [isLoading, setIsLoading] = useState(true)
const [stats, setStats] = useState([])
const [transactions, setTransactions] = useState([])

useEffect(() => {
// Simulate data fetch
setTimeout(() => {
setStats([
{ title: "Total Revenue", value: "$45,231", change: "+12.5%", trend: "up", icon: <DollarSign className="h-5 w-5" /> },
{ title: "Active Users", value: "2,845", change: "+8.2%", trend: "up", icon: <Users className="h-5 w-5" /> },
{ title: "Conversion Rate", value: "3.24%", change: "-2.1%", trend: "down", icon: <TrendingUp className="h-5 w-5" /> },
{ title: "Avg Response", value: "1.2s", change: "+15%", trend: "up", icon: <Clock className="h-5 w-5" /> },
])
setTransactions([
{ id: "TXN-001", customer: "Jane Smith", amount: 1234, status: "completed", date: "Mar 18, 2026" },
{ id: "TXN-002", customer: "Bob Johnson", amount: 856, status: "pending", date: "Mar 17, 2026" },
// More data...
])
setIsLoading(false)
}, 1500)
}, [])

return (
<PageContainer>
{/_ Page Header _/}

<div className="mb-8 flex items-center justify-between">
<div>
<h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
<p className="text-muted-foreground mt-2">
Welcome back! Here's your overview for today.
</p>
</div>
<div className="flex gap-3">
<Button variant="outline">
<Download className="mr-2 h-4 w-4" />
Export
</Button>
<Button>Create Report</Button>
</div>
</div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-8">
          <ChartCard
            title="Revenue Over Time"
            description="Daily revenue for the last 30 days"
            actions={
              <>
                <Button variant="ghost" size="sm">Day</Button>
                <Button variant="secondary" size="sm">Week</Button>
                <Button variant="ghost" size="sm">Month</Button>
              </>
            }
          >
            {/* Your chart component (recharts) */}
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Chart placeholder
            </div>
          </ChartCard>
        </div>

        <div className="lg:col-span-4">
          <ChartCard title="Traffic Sources">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Donut chart placeholder
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
        </div>
        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Your transaction history will appear here once you start processing payments."
            action={{
              label: "Create Transaction",
              onClick: () => console.log("Create transaction"),
            }}
          />
        ) : (
          <DataTable data={transactions} />
        )}
      </Card>
    </PageContainer>

)
}

AI Agent Implementation Checklist
When building a NEW dashboard, the AI agent MUST:
Phase 1: Setup

Initialize React + Vite/Next.js project
Install Tailwind CSS
Initialize shadcn/ui (npx shadcn-ui@latest init)
Copy tailwind.config.ts from this blueprint
Copy globals.css with CWS theme variables
Install required shadcn components (button, card, input, table, dialog, etc.)

Phase 2: Layout Structure

Create MainLayout.tsx with sidebar + header pattern
Create Sidebar.tsx component
Create Header.tsx component
Create PageContainer.tsx wrapper
Implement responsive sidebar collapse
Set up routing (React Router)

Phase 3: Component Library

Create StatCard.tsx using shadcn Card
Create ChartCard.tsx using shadcn Card
Create DataTable.tsx using shadcn Table
Create EmptyState.tsx component
Create loading skeletons for each component
Implement form components with react-hook-form + zod

Phase 4: Styling Verification

Verify light mode: cards have --card color, NO border
Verify dark mode: cards match background, HAVE subtle border
Test responsive grid at all breakpoints (375px, 768px, 1024px, 1440px)
Verify all text meets WCAG AA contrast ratios
Test keyboard navigation
Verify focus states on all interactive elements

Phase 5: Content Population

Build page header with title + actions
Implement 12-column grid layout
Add KPI stat cards (4 columns on desktop)
Add chart sections (8/4 column split)
Add data table (full width)
Implement loading states
Implement empty states

Phase 6: Polish

Add hover effects to cards
Implement toast notifications
Add smooth transitions (200-300ms)
Test dark/light mode toggle
Verify all icons from lucide-react
Final accessibility audit

Non-Negotiable Rules Summary
DO:
✅ Use ONLY shadcn/ui components
✅ Follow 12-column grid system
✅ Include sidebar navigation on ALL dashboards
✅ Use CSS variables from globals.css
✅ Implement light/dark mode card styling rules
✅ Use Tailwind utility classes
✅ Maintain consistent spacing (gap-6 default)
✅ Provide loading/empty states
✅ Test keyboard navigation
✅ Use lucide-react icons
DON'T:
❌ Create custom UI components when shadcn provides them
❌ Use other component libraries (Material-UI, Ant Design, etc.)
❌ Hard-code colors (always use theme variables)
❌ Skip responsive testing
❌ Forget accessibility (ARIA labels, focus states)
❌ Use arbitrary spacing values
❌ Mix border styles between light/dark mode
❌ Deviate from the grid system
❌ Omit sidebar navigation
❌ Create dashboards without MainLayout wrapper

Final Directive for AI Code Agent
When you receive a request to build a dashboard:

Read this blueprint in its entirety
Copy the exact structure: MainLayout → Sidebar → Header → PageContainer → Grid
Use shadcn components exclusively - never reinvent provided components
Apply the theme - copy tailwind.config.ts and globals.css exactly
Follow the card styling rules - light mode (color, no border), dark mode (same bg, subtle border)
Implement responsive grid - 1/2/4 column breakpoints with gap-6
Add states - loading skeletons, empty states, hover effects
Test accessibility - keyboard nav, focus rings, ARIA labels
Verify responsiveness - mobile, tablet, desktop layouts
Document deviations - if you must deviate, explain why in comments
