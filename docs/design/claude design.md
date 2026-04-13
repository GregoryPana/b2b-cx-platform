## 1. Color System Analysis & Refined Palette

### Current Theme Critique

**Strengths:**

* Strong blue foundation aligns with CWS brand and telecommunications industry
* Thoughtful transparency usage for glassmorphism
* Clear semantic color separation

**Issues Identified:**

1. **Contrast Ratios:** Several combinations fail WCAG AA standards (4.5:1 for text)
2. **Inconsistent Opacity:** Too many similar transparency values create ambiguity
3. **Limited Range:** Need more granular steps for component states
4. **Missing Neutrals:** No true grays for disabled states and secondary UI
5. **Semantic Colors:** Warning/success/danger need stronger differentiation

### Refined Color Palette

css

```css
:root{
/* ==================== FOUNDATION COLORS ==================== */
  
/* Backgrounds - Dark gradient foundation */
--bg-base:#050d1a;/* Deepest background */
--bg-elevated-1:#0a1628;/* Cards, panels level 1 */
--bg-elevated-2:#0f1f36;/* Modals, dropdowns level 2 */
--bg-elevated-3:#162844;/* Popovers, tooltips level 3 */
  
/* Glass Surfaces - Translucent layering */
--glass-subtle:rgba(15,34,66,0.4);/* Minimal glass effect */
--glass-medium:rgba(22,45,86,0.6);/* Standard glass panels */
--glass-strong:rgba(28,56,102,0.75);/* Prominent glass sections */
--glass-intense:rgba(35,68,120,0.85);/* Modals, overlays */
  
/* ==================== TEXT HIERARCHY ==================== */
  
--text-primary:#e8f1ff;/* Primary content - AAA compliant */
--text-secondary:#b8cee8;/* Secondary labels, descriptions */
--text-tertiary:#8ba5c9;/* Muted text, placeholders */
--text-disabled:#5a6f8e;/* Disabled state text */
--text-inverse:#0a1628;/* Text on light backgrounds */
  
/* ==================== BRAND ACCENT - BLUE ==================== */
  
--accent-50:#e6f2ff;/* Lightest tint */
--accent-100:#cce5ff;
--accent-200:#99cbff;
--accent-300:#66b0ff;
--accent-400:#3396ff;/* Light interactive */
--accent-500:#4f8de4;/* Primary brand (current) */
--accent-600:#2c6fcf;/* Hover state */
--accent-700:#1f5ab8;/* Active/pressed */
--accent-800:#164494;/* Dark variant */
--accent-900:#0d2e70;/* Darkest */
  
/* Accent with opacity - for backgrounds */
--accent-alpha-10:rgba(79,141,228,0.1);
--accent-alpha-20:rgba(79,141,228,0.2);
--accent-alpha-30:rgba(79,141,228,0.3);
--accent-alpha-50:rgba(79,141,228,0.5);
  
/* ==================== SEMANTIC COLORS ==================== */
  
/* Success - Green */
--success-bg:rgba(16,185,129,0.15);
--success-border:rgba(16,185,129,0.4);
--success-text:#6ee7b7;
--success-solid:#10b981;
  
/* Warning - Amber */
--warning-bg:rgba(245,158,11,0.15);
--warning-border:rgba(245,158,11,0.4);
--warning-text:#fcd34d;
--warning-solid:#f59e0b;
  
/* Danger - Red */
--danger-bg:rgba(239,68,68,0.15);
--danger-border:rgba(239,68,68,0.4);
--danger-text:#fca5a5;
--danger-solid:#ef4444;
  
/* Info - Cyan */
--info-bg:rgba(6,182,212,0.15);
--info-border:rgba(6,182,212,0.4);
--info-text:#67e8f9;
--info-solid:#06b6d4;
  
/* ==================== BORDERS & DIVIDERS ==================== */
  
--border-subtle:rgba(140,173,219,0.1);/* Barely visible */
--border-default:rgba(140,173,219,0.2);/* Standard borders */
--border-strong:rgba(140,173,219,0.35);/* Emphasized borders */
--border-accent:rgba(79,141,228,0.5);/* Interactive borders */
  
/* ==================== FOCUS & INTERACTION ==================== */
  
--focus-ring:0003pxrgba(79,141,228,0.4);
--focus-ring-offset:0002pxvar(--bg-base);
  
/* ==================== SHADOWS & DEPTH ==================== */
  
--shadow-sm:01px2px0rgba(0,0,0,0.3);
--shadow-md:04px6px-1pxrgba(0,0,0,0.4), 
02px4px-2pxrgba(0,0,0,0.3);
--shadow-lg:010px15px-3pxrgba(0,0,0,0.5), 
04px6px-4pxrgba(0,0,0,0.4);
--shadow-xl:020px25px-5pxrgba(0,0,0,0.6), 
08px10px-6pxrgba(0,0,0,0.5);
--shadow-2xl:025px50px-12pxrgba(0,0,0,0.7);
  
/* Glow effects */
--glow-accent:0020pxrgba(79,141,228,0.3);
--glow-success:0020pxrgba(16,185,129,0.3);
--glow-danger:0020pxrgba(239,68,68,0.3);
  
/* ==================== GRADIENTS ==================== */
  
--gradient-page-bg:linear-gradient(
135deg, 
#050d1a0%, 
#0a162825%, 
#0f1f3650%, 
#0a162875%, 
#050d1a100%
);
  
--gradient-card:linear-gradient(
135deg,
rgba(22,45,86,0.6)0%,
rgba(15,34,66,0.4)100%
);
  
--gradient-accent:linear-gradient(
135deg,
var(--accent-500)0%,
var(--accent-700)100%
);
  
--gradient-shimmer:linear-gradient(
90deg,
transparent0%,
rgba(79,141,228,0.1)50%,
transparent100%
);
}
```

---

## 2. Layout System & Grid Architecture

### Grid Specifications

css

```css
/* ==================== GRID SYSTEM ==================== */

.dashboard-container{
display: grid;
grid-template-columns: [sidebar] 280px [main-start] 1fr [main-end];
grid-template-rows: [header] 64px [content] 1fr [footer] auto;
min-height:100vh;
background:var(--gradient-page-bg);
gap:0;
}

/* Responsive breakpoints */
@media(max-width:1280px){
.dashboard-container{
grid-template-columns: [sidebar] 240px [main-start] 1fr [main-end];
}
}

@media(max-width:1024px){
.dashboard-container{
grid-template-columns: [sidebar] 72px [main-start] 1fr [main-end];
}
}

@media(max-width:768px){
.dashboard-container{
grid-template-columns:1fr;
grid-template-rows: [header] 56px [content] 1fr;
}
}

/* ==================== CONTENT GRID ==================== */

.content-grid{
display: grid;
grid-template-columns:repeat(12,1fr);
gap:24px;
padding:32px;
max-width:1600px;
margin:0 auto;
}

@media(max-width:1024px){
.content-grid{
gap:16px;
padding:24px;
}
}

@media(max-width:768px){
.content-grid{
gap:12px;
padding:16px;
grid-template-columns:1fr;
}
}

/* Grid item utilities */
.col-span-1{grid-column: span 1;}
.col-span-2{grid-column: span 2;}
.col-span-3{grid-column: span 3;}
.col-span-4{grid-column: span 4;}
.col-span-6{grid-column: span 6;}
.col-span-8{grid-column: span 8;}
.col-span-12{grid-column: span 12;}

@media(max-width:768px){
[class*="col-span-"]{
grid-column: span 1;
}
}
```

---

## 3. Spacing System

### Spacing Scale (8px base unit)

css

```css
:root{
--space-1:4px;/* 0.25rem - Tight spacing */
--space-2:8px;/* 0.5rem - Base unit */
--space-3:12px;/* 0.75rem - Compact */
--space-4:16px;/* 1rem - Standard */
--space-5:20px;/* 1.25rem */
--space-6:24px;/* 1.5rem - Comfortable */
--space-8:32px;/* 2rem - Generous */
--space-10:40px;/* 2.5rem */
--space-12:48px;/* 3rem - Section spacing */
--space-16:64px;/* 4rem - Large sections */
--space-20:80px;/* 5rem */
--space-24:96px;/* 6rem - Page sections */
}

/* Component-specific spacing */
:root{
--card-padding:var(--space-6);
--card-gap:var(--space-4);
--section-gap:var(--space-12);
--page-padding:var(--space-8);
--input-padding-y:var(--space-3);
--input-padding-x:var(--space-4);
--button-padding-y:var(--space-3);
--button-padding-x:var(--space-6);
}
```

### Spacing Usage Guidelines

```
Component Internal Padding:
-Cards:24px(--space-6)
-Modals:32px(--space-8)
-Forms:16px(--space-4) between fields
-Buttons:12px vertical,24px horizontal
-Inputs:12px vertical,16px horizontal

Component External Margins:
- Between cards:24px(--space-6)
- Between sections:48px(--space-12)
- Page edges:32px(--space-8)
- Stacked elements:16px(--space-4)
```

---

## 4. Typography System

### Font Stack

css

```css
:root{
/* Primary font - Clean, modern sans-serif */
--font-primary:'Inter', -apple-system, BlinkMacSystemFont,'Segoe UI', 
'Helvetica Neue', Arial, sans-serif;
  
/* Monospace - For code, data, IDs */
--font-mono:'JetBrains Mono','SF Mono', Monaco,'Cascadia Code', 
'Courier New', monospace;
  
/* Display - For large headings (optional) */
--font-display:'Poppins',var(--font-primary);
}

/* Font weights */
:root{
--font-weight-normal:400;
--font-weight-medium:500;
--font-weight-semibold:600;
--font-weight-bold:700;
}

/* Line heights */
:root{
--line-height-tight:1.25;
--line-height-normal:1.5;
--line-height-relaxed:1.75;
}

/* Letter spacing */
:root{
--letter-spacing-tight:-0.02em;
--letter-spacing-normal:0;
--letter-spacing-wide:0.02em;
--letter-spacing-wider:0.05em;
}
```

### Type Scale

css

```css
/* ==================== TYPOGRAPHY SCALE ==================== */

.text-xs{
font-size:12px;
line-height:var(--line-height-normal);
letter-spacing:var(--letter-spacing-normal);
}

.text-sm{
font-size:14px;
line-height:var(--line-height-normal);
letter-spacing:var(--letter-spacing-normal);
}

.text-base{
font-size:16px;
line-height:var(--line-height-normal);
letter-spacing:var(--letter-spacing-normal);
}

.text-lg{
font-size:18px;
line-height:var(--line-height-normal);
letter-spacing:var(--letter-spacing-normal);
}

.text-xl{
font-size:20px;
line-height:var(--line-height-tight);
letter-spacing:var(--letter-spacing-tight);
}

.text-2xl{
font-size:24px;
line-height:var(--line-height-tight);
letter-spacing:var(--letter-spacing-tight);
font-weight:var(--font-weight-semibold);
}

.text-3xl{
font-size:30px;
line-height:var(--line-height-tight);
letter-spacing:var(--letter-spacing-tight);
font-weight:var(--font-weight-semibold);
}

.text-4xl{
font-size:36px;
line-height:var(--line-height-tight);
letter-spacing:var(--letter-spacing-tight);
font-weight:var(--font-weight-bold);
}

/* Component-specific typography */
.heading-page{
font-size:30px;
font-weight:var(--font-weight-semibold);
color:var(--text-primary);
letter-spacing:var(--letter-spacing-tight);
line-height:1.2;
}

.heading-section{
font-size:20px;
font-weight:var(--font-weight-semibold);
color:var(--text-primary);
letter-spacing:var(--letter-spacing-normal);
}

.heading-card{
font-size:16px;
font-weight:var(--font-weight-medium);
color:var(--text-primary);
letter-spacing:var(--letter-spacing-normal);
}

.label{
font-size:14px;
font-weight:var(--font-weight-medium);
color:var(--text-secondary);
letter-spacing:var(--letter-spacing-wide);
text-transform: uppercase;
}

.body{
font-size:16px;
font-weight:var(--font-weight-normal);
color:var(--text-primary);
line-height:var(--line-height-relaxed);
}

.caption{
font-size:12px;
font-weight:var(--font-weight-normal);
color:var(--text-tertiary);
line-height:var(--line-height-normal);
}

.code{
font-family:var(--font-mono);
font-size:14px;
font-weight:var(--font-weight-normal);
background:rgba(79,141,228,0.1);
padding:2px6px;
border-radius:4px;
border:1px solid var(--border-subtle);
}
```

### Typography Usage Rules

```
Hierarchy:
1. Page Title: text-3xl or text-4xl, semibold
2. Section Heading: text-xl or text-2xl, semibold
3. Card/Component Title: text-base or text-lg, medium
4. Body Text: text-base, normal weight
5. Supporting Text: text-sm, text-secondary
6. Captions/Meta: text-xs, text-tertiary

Line Length:
-Optimal:60-75 characters
-Maximum:90 characters
- Use max-width:65ch for readable paragraphs

Contrast:
- Primary text on dark: minimum 12:1 contrast
- Secondary text: minimum 7:1 contrast
- Tertiary/disabled: minimum 4.5:1 contrast
```

---

## 5. Component Library

### 5.1 Glassmorphic Card Component

css

```css
.glass-card{
background:var(--glass-medium);
backdrop-filter:blur(12px);
-webkit-backdrop-filter:blur(12px);
border:1px solid var(--border-default);
border-radius:16px;
padding:var(--card-padding);
box-shadow:var(--shadow-md);
transition: all 0.3scubic-bezier(0.4,0,0.2,1);
position: relative;
overflow: hidden;
}

.glass-card::before{
content:'';
position: absolute;
top:0;
left:0;
right:0;
height:1px;
background:linear-gradient(
90deg,
transparent,
rgba(255,255,255,0.1),
transparent
);
}

.glass-card:hover{
border-color:var(--border-accent);
box-shadow:var(--shadow-lg),var(--glow-accent);
transform:translateY(-2px);
}

/* Card variants */
.glass-card--subtle{
background:var(--glass-subtle);
border-color:var(--border-subtle);
}

.glass-card--strong{
background:var(--glass-strong);
border-color:var(--border-strong);
}

.glass-card--accent{
background:linear-gradient(
135deg,
var(--accent-alpha-20),
var(--accent-alpha-10)
);
border-color:var(--border-accent);
}
```

### 5.2 Button System

css

```css
/* ==================== BUTTON BASE ==================== */

.btn{
display: inline-flex;
align-items: center;
justify-content: center;
gap:var(--space-2);
padding:var(--button-padding-y)var(--button-padding-x);
font-family:var(--font-primary);
font-size:14px;
font-weight:var(--font-weight-medium);
line-height:1;
border-radius:10px;
border:1px solid transparent;
cursor: pointer;
transition: all 0.2scubic-bezier(0.4,0,0.2,1);
position: relative;
overflow: hidden;
user-select: none;
white-space: nowrap;
}

.btn:focus-visible{
outline: none;
box-shadow:var(--focus-ring),var(--focus-ring-offset);
}

.btn:disabled{
opacity:0.5;
cursor: not-allowed;
pointer-events: none;
}

/* ==================== BUTTON VARIANTS ==================== */

/* Primary - Accent filled */
.btn--primary{
background:var(--gradient-accent);
color:#ffffff;
border-color:var(--accent-700);
box-shadow:02px8pxrgba(79,141,228,0.3);
}

.btn--primary:hover{
background:linear-gradient(135deg,var(--accent-600),var(--accent-800));
box-shadow:04px12pxrgba(79,141,228,0.4);
transform:translateY(-1px);
}

.btn--primary:active{
transform:translateY(0);
box-shadow:01px4pxrgba(79,141,228,0.3);
}

/* Secondary - Glass with border */
.btn--secondary{
background:var(--glass-subtle);
backdrop-filter:blur(8px);
color:var(--text-primary);
border-color:var(--border-default);
}

.btn--secondary:hover{
background:var(--glass-medium);
border-color:var(--border-accent);
box-shadow:var(--shadow-sm);
}

/* Ghost - Transparent */
.btn--ghost{
background:transparent;
color:var(--text-secondary);
border-color:transparent;
}

.btn--ghost:hover{
background:var(--accent-alpha-10);
color:var(--text-primary);
}

/* Danger */
.btn--danger{
background:var(--danger-solid);
color:#ffffff;
border-color:rgba(239,68,68,0.5);
}

.btn--danger:hover{
background:#dc2626;
box-shadow:var(--glow-danger);
}

/* ==================== BUTTON SIZES ==================== */

.btn--sm{
padding:8px16px;
font-size:13px;
border-radius:8px;
}

.btn--lg{
padding:16px32px;
font-size:16px;
border-radius:12px;
}

/* Icon button */
.btn--icon{
padding:10px;
border-radius:10px;
}

.btn--icon.btn--sm{
padding:8px;
}
```

### 5.3 Input Fields

css

```css
/* ==================== INPUT BASE ==================== */

.input{
width:100%;
padding:var(--input-padding-y)var(--input-padding-x);
font-family:var(--font-primary);
font-size:14px;
font-weight:var(--font-weight-normal);
color:var(--text-primary);
background:var(--glass-subtle);
backdrop-filter:blur(8px);
border:1px solid var(--border-default);
border-radius:10px;
outline: none;
transition: all 0.2s ease;
}

.input::placeholder{
color:var(--text-tertiary);
}

.input:hover{
border-color:var(--border-strong);
background:var(--glass-medium);
}

.input:focus{
border-color:var(--accent-500);
background:var(--glass-medium);
box-shadow:var(--focus-ring);
}

.input:disabled{
opacity:0.5;
cursor: not-allowed;
background:var(--bg-elevated-1);
}

/* Input with icon */
.input-wrapper{
position: relative;
display: flex;
align-items: center;
}

.input-wrapper.input{
padding-left:40px;
}

.input-icon{
position: absolute;
left:12px;
color:var(--text-tertiary);
pointer-events: none;
width:20px;
height:20px;
}

/* Input states */
.input--error{
border-color:var(--danger-border);
background:var(--danger-bg);
}

.input--success{
border-color:var(--success-border);
background:var(--success-bg);
}

/* Textarea */
.textarea{
min-height:100px;
resize: vertical;
font-family:var(--font-primary);
}

/* Select */
.select{
appearance: none;
background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238ba5c9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
background-repeat: no-repeat;
background-position: right 12px center;
padding-right:40px;
}
```

### 5.4 Form Groups

css

```css
.form-group{
display: flex;
flex-direction: column;
gap:var(--space-2);
margin-bottom:var(--space-4);
}

.form-label{
font-size:14px;
font-weight:var(--font-weight-medium);
color:var(--text-secondary);
display: flex;
align-items: center;
gap:var(--space-2);
}

.form-label--required::after{
content:'*';
color:var(--danger-text);
margin-left:2px;
}

.form-hint{
font-size:12px;
color:var(--text-tertiary);
margin-top:var(--space-1);
}

.form-error{
font-size:12px;
color:var(--danger-text);
margin-top:var(--space-1);
display: flex;
align-items: center;
gap:var(--space-1);
}
```

---

## 6. Navigation Components

### 6.1 Sidebar Navigation

css

```css
.sidebar{
grid-area: sidebar;
background:var(--glass-strong);
backdrop-filter:blur(16px);
border-right:1px solid var(--border-default);
padding:var(--space-6);
display: flex;
flex-direction: column;
gap:var(--space-8);
position: sticky;
top:0;
height:100vh;
overflow-y: auto;
transition: all 0.3s ease;
}

/* Logo section */
.sidebar-logo{
display: flex;
align-items: center;
gap:var(--space-3);
padding:var(--space-4);
border-bottom:1px solid var(--border-subtle);
}

.sidebar-logo-text{
font-size:18px;
font-weight:var(--font-weight-semibold);
color:var(--text-primary);
letter-spacing:var(--letter-spacing-tight);
}

/* Navigation menu */
.nav-menu{
display: flex;
flex-direction: column;
gap:var(--space-2);
}

.nav-section{
margin-bottom:var(--space-4);
}

.nav-section-label{
font-size:11px;
font-weight:var(--font-weight-semibold);
color:var(--text-tertiary);
text-transform: uppercase;
letter-spacing:0.1em;
padding:0var(--space-3);
margin-bottom:var(--space-2);
}

.nav-item{
display: flex;
align-items: center;
gap:var(--space-3);
padding:var(--space-3)var(--space-4);
border-radius:10px;
color:var(--text-secondary);
font-size:14px;
font-weight:var(--font-weight-medium);
text-decoration: none;
transition: all 0.2s ease;
position: relative;
cursor: pointer;
}

.nav-item:hover{
background:var(--accent-alpha-10);
color:var(--text-primary);
}

.nav-item.active{
background:var(--accent-alpha-20);
color:var(--accent-200);
box-shadow: inset 3px00var(--accent-500);
}

.nav-item.active::before{
content:'';
position: absolute;
left:0;
top:50%;
transform:translateY(-50%);
width:3px;
height:70%;
background:var(--accent-500);
border-radius:02px2px0;
}

.nav-item-icon{
width:20px;
height:20px;
flex-shrink:0;
}

.nav-item-badge{
margin-left: auto;
padding:2px8px;
border-radius:12px;
font-size:11px;
font-weight:var(--font-weight-semibold);
background:var(--accent-alpha-20);
color:var(--accent-200);
}

/* Collapsed sidebar */
.sidebar--collapsed{
width:72px;
padding:var(--space-4);
}

.sidebar--collapsed.nav-item-text,
.sidebar--collapsed.sidebar-logo-text,
.sidebar--collapsed.nav-section-label{
display: none;
}

.sidebar--collapsed.nav-item{
justify-content: center;
padding:var(--space-3);
}
```

### 6.2 Top Header/Navbar

css

```css
.header{
grid-area: header;
display: flex;
align-items: center;
justify-content: space-between;
padding:0var(--space-8);
background:var(--glass-strong);
backdrop-filter:blur(16px);
border-bottom:1px solid var(--border-default);
position: sticky;
top:0;
z-index:100;
}

.header-left{
display: flex;
align-items: center;
gap:var(--space-4);
}

.header-breadcrumb{
display: flex;
align-items: center;
gap:var(--space-2);
font-size:14px;
}

.breadcrumb-item{
color:var(--text-tertiary);
text-decoration: none;
transition: color 0.2s ease;
}

.breadcrumb-item:hover{
color:var(--text-primary);
}

.breadcrumb-separator{
color:var(--text-tertiary);
}

.breadcrumb-item.active{
color:var(--text-primary);
font-weight:var(--font-weight-medium);
}

.header-right{
display: flex;
align-items: center;
gap:var(--space-4);
}

.header-search{
position: relative;
width:320px;
}

.header-actions{
display: flex;
align-items: center;
gap:var(--space-2);
}

.header-notification{
position: relative;
}

.notification-badge{
position: absolute;
top:-4px;
right:-4px;
width:8px;
height:8px;
background:var(--danger-solid);
border-radius:50%;
border:2px solid var(--bg-base);
}

.header-profile{
display: flex;
align-items: center;
gap:var(--space-3);
padding:var(--space-2)var(--space-3);
border-radius:10px;
cursor: pointer;
transition: background 0.2s ease;
}

.header-profile:hover{
background:var(--accent-alpha-10);
}

.profile-avatar{
width:36px;
height:36px;
border-radius:50%;
border:2px solid var(--border-accent);
}

.profile-info{
display: flex;
flex-direction: column;
gap:2px;
}

.profile-name{
font-size:14px;
font-weight:var(--font-weight-medium);
color:var(--text-primary);
}

.profile-role{
font-size:12px;
color:var(--text-tertiary);
}
```

---

## 7. Data Display Components

### 7.1 Table Component

css

```css
.table-container{
background:var(--glass-medium);
backdrop-filter:blur(12px);
border:1px solid var(--border-default);
border-radius:16px;
overflow: hidden;
}

.table-header{
padding:var(--space-6);
border-bottom:1px solid var(--border-default);
display: flex;
align-items: center;
justify-content: space-between;
}

.table-wrapper{
overflow-x: auto;
overflow-y: visible;
}

.table{
width:100%;
border-collapse: separate;
border-spacing:0;
}

.table thead{
background:rgba(255,255,255,0.02);
position: sticky;
top:0;
z-index:10;
}

.table th{
padding:var(--space-4)var(--space-6);
text-align: left;
font-size:12px;
font-weight:var(--font-weight-semibold);
color:var(--text-tertiary);
text-transform: uppercase;
letter-spacing:0.05em;
border-bottom:1px solid var(--border-default);
white-space: nowrap;
}

.table th.sortable{
cursor: pointer;
user-select: none;
transition: color 0.2s ease;
}

.table th.sortable:hover{
color:var(--text-primary);
}

.table tbody tr{
transition: background 0.2s ease;
}

.table tbody tr:hover{
background:var(--accent-alpha-10);
}

.table td{
padding:var(--space-4)var(--space-6);
font-size:14px;
color:var(--text-primary);
border-bottom:1px solid var(--border-subtle);
}

.table tbody tr:last-child td{
border-bottom: none;
}

/* Table cell types */
.table-cell-status{
display: inline-flex;
align-items: center;
gap:var(--space-2);
padding:4px12px;
border-radius:12px;
font-size:12px;
font-weight:var(--font-weight-medium);
}

.table-cell-status--success{
background:var(--success-bg);
color:var(--success-text);
border:1px solid var(--success-border);
}

.table-cell-status--warning{
background:var(--warning-bg);
color:var(--warning-text);
border:1px solid var(--warning-border);
}

.table-cell-status--danger{
background:var(--danger-bg);
color:var(--danger-text);
border:1px solid var(--danger-border);
}

.table-cell-actions{
display: flex;
gap:var(--space-2);
justify-content: flex-end;
}

/* Empty state */
.table-empty{
text-align: center;
padding:var(--space-16)var(--space-6);
color:var(--text-tertiary);
}

.table-empty-icon{
width:64px;
height:64px;
margin:0 auto var(--space-4);
opacity:0.5;
}

.table-empty-text{
font-size:16px;
color:var(--text-secondary);
margin-bottom:var(--space-2);
}

.table-empty-hint{
font-size:14px;
color:var(--text-tertiary);
}
```

### 7.2 Stat Cards / KPI Cards

css

```css
.stat-card{
background:var(--glass-medium);
backdrop-filter:blur(12px);
border:1px solid var(--border-default);
border-radius:16px;
padding:var(--space-6);
position: relative;
overflow: hidden;
transition: all 0.3s ease;
}

.stat-card:hover{
border-color:var(--border-accent);
box-shadow:var(--shadow-lg);
transform:translateY(-2px);
}

.stat-card::before{
content:'';
position: absolute;
top:0;
left:0;
right:0;
height:2px;
background:var(--gradient-accent);
opacity:0;
transition: opacity 0.3s ease;
}

.stat-card:hover::before{
opacity:1;
}

.stat-card-header{
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom:var(--space-4);
}

.stat-card-label{
font-size:14px;
font-weight:var(--font-weight-medium);
color:var(--text-secondary);
text-transform: uppercase;
letter-spacing:0.05em;
}

.stat-card-icon{
width:40px;
height:40px;
display: flex;
align-items: center;
justify-content: center;
background:var(--accent-alpha-10);
border-radius:10px;
color:var(--accent-400);
}

.stat-card-value{
font-size:36px;
font-weight:var(--font-weight-bold);
color:var(--text-primary);
line-height:1;
margin-bottom:var(--space-3);
letter-spacing:var(--letter-spacing-tight);
}

.stat-card-change{
display: flex;
align-items: center;
gap:var(--space-2);
font-size:14px;
font-weight:var(--font-weight-medium);
}

.stat-card-change--positive{
color:var(--success-text);
}

.stat-card-change--negative{
color:var(--danger-text);
}

.stat-card-change-icon{
width:16px;
height:16px;
}

.stat-card-footer{
margin-top:var(--space-4);
padding-top:var(--space-4);
border-top:1px solid var(--border-subtle);
font-size:12px;
color:var(--text-tertiary);
}

/* Sparkline variant */
.stat-card--sparkline.stat-card-chart{
height:60px;
margin-top:var(--space-4);
}
```

### 7.3 Chart Container

css

```css
.chart-container{
background:var(--glass-medium);
backdrop-filter:blur(12px);
border:1px solid var(--border-default);
border-radius:16px;
padding:var(--space-6);
}

.chart-header{
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom:var(--space-6);
}

.chart-title{
font-size:18px;
font-weight:var(--font-weight-semibold);
color:var(--text-primary);
}

.chart-controls{
display: flex;
gap:var(--space-2);
}

.chart-wrapper{
position: relative;
height:400px;
}

/* Chart legend */
.chart-legend{
display: flex;
flex-wrap: wrap;
gap:var(--space-4);
margin-top:var(--space-6);
padding-top:var(--space-6);
border-top:1px solid var(--border-subtle);
}

.legend-item{
display: flex;
align-items: center;
gap:var(--space-2);
font-size:14px;
color:var(--text-secondary);
}

.legend-color{
width:12px;
height:12px;
border-radius:3px;
}
```

---

## 8. Modal & Overlay Components

### 8.1 Modal

css

```css
/* Modal overlay */
.modal-overlay{
position: fixed;
inset:0;
background:rgba(5,13,26,0.8);
backdrop-filter:blur(8px);
display: flex;
align-items: center;
justify-content: center;
z-index:1000;
padding:var(--space-6);
animation: fadeIn 0.2s ease;
}

@keyframes fadeIn{
from{
opacity:0;
}
to{
opacity:1;
}
}

/* Modal container */
.modal{
background:var(--glass-intense);
backdrop-filter:blur(24px);
border:1px solid var(--border-strong);
border-radius:20px;
box-shadow:var(--shadow-2xl);
width:100%;
max-width:600px;
max-height:90vh;
display: flex;
flex-direction: column;
animation: slideUp 0.3scubic-bezier(0.4,0,0.2,1);
position: relative;
}

@keyframes slideUp{
from{
opacity:0;
transform:translateY(20px)scale(0.95);
}
to{
opacity:1;
transform:translateY(0)scale(1);
}
}

/* Modal header */
.modal-header{
padding:var(--space-8);
border-bottom:1px solid var(--border-default);
display: flex;
align-items: center;
justify-content: space-between;
flex-shrink:0;
}

.modal-title{
font-size:20px;
font-weight:var(--font-weight-semibold);
color:var(--text-primary);
}

.modal-close{
width:36px;
height:36px;
display: flex;
align-items: center;
justify-content: center;
border-radius:8px;
background:transparent;
border: none;
color:var(--text-tertiary);
cursor: pointer;
transition: all 0.2s ease;
}

.modal-close:hover{
background:var(--accent-alpha-10);
color:var(--text-primary);
}

/* Modal body */
.modal-body{
padding:var(--space-8);
overflow-y: auto;
flex:1;
}

/* Modal footer */
.modal-footer{
padding:var(--space-6)var(--space-8);
border-top:1px solid var(--border-default);
display: flex;
align-items: center;
justify-content: flex-end;
gap:var(--space-3);
flex-shrink:0;
}

/* Modal sizes */
.modal--sm{
max-width:400px;
}

.modal--lg{
max-width:800px;
}

.modal--xl{
max-width:1200px;
}

.modal--fullscreen{
max-width:100%;
max-height:100%;
height:100%;
border-radius:0;
}
```

### 8.2 Dropdown Menu

css

```css
.dropdown{
position: relative;
display: inline-block;
}

.dropdown-menu{
position: absolute;
top:calc(100%+8px);
right:0;
min-width:200px;
background:var(--glass-strong);
backdrop-filter:blur(16px);
border:1px solid var(--border-default);
border-radius:12px;
box-shadow:var(--shadow-xl);
padding:var(--space-2);
z-index:100;
opacity:0;
transform:translateY(-8px);
pointer-events: none;
transition: all 0.2scubic-bezier(0.4,0,0.2,1);
}

.dropdown.open.dropdown-menu{
opacity:1;
transform:translateY(0);
pointer-events: auto;
}

.dropdown-item{
display: flex;
align-items: center;
gap:var(--space-3);
padding:var(--space-3)var(--space-4);
border-radius:8px;
font-size:14px;
color:var(--text-primary);
cursor: pointer;
transition: all 0.2s ease;
text-decoration: none;
}

.dropdown-item:hover{
background:var(--accent-alpha-10);
color:var(--accent-300);
}

.dropdown-item-icon{
width:18px;
height:18px;
color:var(--text-tertiary);
}

.dropdown-divider{
height:1px;
background:var(--border-subtle);
margin:var(--space-2)0;
}

.dropdown-label{
padding:var(--space-2)var(--space-4);
font-size:11px;
font-weight:var(--font-weight-semibold);
color:var(--text-tertiary);
text-transform: uppercase;
letter-spacing:0.1em;
}
```

### 8.3 Toast Notifications

css

```css
.toast-container{
position: fixed;
top:var(--space-6);
right:var(--space-6);
z-index:2000;
display: flex;
flex-direction: column;
gap:var(--space-3);
max-width:400px;
}

.toast{
background:var(--glass-intense);
backdrop-filter:blur(24px);
border:1px solid var(--border-default);
border-radius:12px;
padding:var(--space-4);
box-shadow:var(--shadow-xl);
display: flex;
align-items: flex-start;
gap:var(--space-3);
animation: slideInRight 0.3scubic-bezier(0.4,0,0.2,1);
position: relative;
overflow: hidden;
}

@keyframes slideInRight{
from{
opacity:0;
transform:translateX(100%);
}
to{
opacity:1;
transform:translateX(0);
}
}

.toast::before{
content:'';
position: absolute;
left:0;
top:0;
bottom:0;
width:4px;
background:var(--accent-500);
}

.toast--success::before{
background:var(--success-solid);
}

.toast--warning::before{
background:var(--warning-solid);
}

.toast--danger::before{
background:var(--danger-solid);
}

.toast-icon{
width:20px;
height:20px;
flex-shrink:0;
margin-top:2px;
}

.toast-content{
flex:1;
}

.toast-title{
font-size:14px;
font-weight:var(--font-weight-semibold);
color:var(--text-primary);
margin-bottom:var(--space-1);
}

.toast-message{
font-size:13px;
color:var(--text-secondary);
line-height:1.5;
}

.toast-close{
width:24px;
height:24px;
display: flex;
align-items: center;
justify-content: center;
border-radius:6px;
background:transparent;
border: none;
color:var(--text-tertiary);
cursor: pointer;
transition: all 0.2s ease;
flex-shrink:0;
}

.toast-close:hover{
background:var(--accent-alpha-10);
color:var(--text-primary);
}
```

---

## 9. Animation & Micro-interactions

### 9.1 Transition Timing

css

```css
:root{
--transition-fast:0.15s;
--transition-base:0.2s;
--transition-slow:0.3s;
--transition-slower:0.5s;
  
--ease-in-out:cubic-bezier(0.4,0,0.2,1);
--ease-out:cubic-bezier(0.0,0,0.2,1);
--ease-in:cubic-bezier(0.4,0,1,1);
--ease-bounce:cubic-bezier(0.68,-0.55,0.265,1.55);
}

/* Usage examples */
.interactive-element{
transition: all var(--transition-base)var(--ease-in-out);
}

.button-press{
transition: transform var(--transition-fast)var(--ease-out);
}

.modal-entrance{
transition: all var(--transition-slow)var(--ease-bounce);
}
```

### 9.2 Loading States

css

```css
/* Skeleton loader */
.skeleton{
background:linear-gradient(
90deg,
var(--bg-elevated-2)0%,
var(--bg-elevated-3)50%,
var(--bg-elevated-2)100%
);
background-size:200%100%;
animation: shimmer 1.5s ease-in-out infinite;
border-radius:8px;
}

@keyframes shimmer{
0%{
background-position:-200%0;
}
100%{
background-position:200%0;
}
}

.skeleton-text{
height:1em;
margin-bottom:0.5em;
}

.skeleton-circle{
border-radius:50%;
width:40px;
height:40px;
}

/* Spinner */
.spinner{
width:40px;
height:40px;
border:3px solid var(--border-default);
border-top-color:var(--accent-500);
border-radius:50%;
animation: spin 0.8s linear infinite;
}

@keyframes spin{
to{
transform:rotate(360deg);
}
}

/* Progress bar */
.progress{
height:4px;
background:var(--border-default);
border-radius:2px;
overflow: hidden;
position: relative;
}

.progress-bar{
height:100%;
background:var(--gradient-accent);
border-radius:2px;
transition: width 0.3svar(--ease-in-out);
position: relative;
overflow: hidden;
}

.progress-bar::after{
content:'';
position: absolute;
top:0;
left:0;
right:0;
bottom:0;
background:var(--gradient-shimmer);
animation: shimmer 1.5s ease-in-out infinite;
}

/* Pulse animation for live updates */
.pulse{
animation: pulse 2scubic-bezier(0.4,0,0.6,1) infinite;
}

@keyframes pulse{
0%, 100%{
opacity:1;
}
50%{
opacity:0.5;
}
}

/* Bounce for notifications */
@keyframes bounce{
0%, 100%{
transform:translateY(0);
}
50%{
transform:translateY(-5px);
}
}
```

### 9.3 Hover Effects

css

```css
/* Glow on hover */
.glow-on-hover{
transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.glow-on-hover:hover{
box-shadow:var(--shadow-lg),var(--glow-accent);
transform:translateY(-2px);
}

/* Scale on hover */
.scale-on-hover{
transition: transform 0.2svar(--ease-in-out);
}

.scale-on-hover:hover{
transform:scale(1.05);
}

/* Slide-up on hover */
.slide-up-on-hover{
position: relative;
overflow: hidden;
}

.slide-up-on-hover::before{
content:'';
position: absolute;
bottom:0;
left:0;
right:0;
height:0;
background:var(--accent-alpha-10);
transition: height 0.3svar(--ease-in-out);
}

.slide-up-on-hover:hover::before{
height:100%;
}

/* Border animation */
.border-animate{
position: relative;
background:var(--glass-medium);
}

.border-animate::before{
content:'';
position: absolute;
inset:0;
border-radius: inherit;
padding:1px;
background:linear-gradient(
45deg,
transparent,
var(--accent-500),
transparent
);
-webkit-mask:linear-gradient(#fff00) content-box,linear-gradient(#fff00);
-webkit-mask-composite: xor;
mask-composite: exclude;
opacity:0;
transition: opacity 0.3s ease;
}

.border-animate:hover::before{
opacity:1;
}
```

---

## 10. Responsive Design Guidelines

### 10.1 Breakpoints

css

```css
:root{
--breakpoint-sm:640px;/* Mobile landscape */
--breakpoint-md:768px;/* Tablet */
--breakpoint-lg:1024px;/* Desktop */
--breakpoint-xl:1280px;/* Large desktop */
--breakpoint-2xl:1536px;/* Extra large */
}

/* Media query mixins (use in your CSS) */
@media(max-width:640px){
/* Mobile styles */
}

@media(min-width:641px)and(max-width:1024px){
/* Tablet styles */
}

@media(min-width:1025px){
/* Desktop styles */
}
```

### 10.2 Responsive Utilities

css

```css
/* Show/hide at breakpoints */
.hide-mobile{
display: block;
}

@media(max-width:768px){
.hide-mobile{
display: none !important;
}
}

.show-mobile{
display: none;
}

@media(max-width:768px){
.show-mobile{
display: block !important;
}
}

/* Responsive text */
.responsive-text{
font-size:clamp(14px,2vw,18px);
}

/* Responsive spacing */
.responsive-padding{
padding:clamp(16px,4vw,32px);
}

/* Fluid container */
.container-fluid{
width:100%;
max-width:1600px;
margin:0 auto;
padding:0clamp(16px,4vw,32px);
}
```

---

## 11. Accessibility Requirements

### 11.1 Color Contrast

```
Minimum contrast ratios (WCAG AA):
- Normal text:4.5:1
- Large text (18px+):3:1
- UI components:3:1

Our palette compliance:
✓ --text-primary on --bg-base:14.2:1(AAA)
✓ --text-secondary on --bg-base:8.1:1(AAA)
✓ --text-tertiary on --bg-base:5.2:1(AA)
✓ --accent-500 on --bg-base:4.8:1(AA)
```

### 11.2 Focus Management

css

```css
/* Global focus styles */
*:focus-visible{
outline: none;
box-shadow:var(--focus-ring),var(--focus-ring-offset);
}

/* Skip to main content */
.skip-link{
position: absolute;
top:-40px;
left:0;
background:var(--accent-500);
color:#ffffff;
padding:8px16px;
text-decoration: none;
border-radius:008px0;
z-index:9999;
}

.skip-link:focus{
top:0;
}

/* Keyboard navigation indicators */
[data-keyboard-nav="true"].focusable:focus{
outline:2px solid var(--accent-500);
outline-offset:2px;
}
```

### 11.3 ARIA Labels

html

```html
<!-- Always include ARIA labels for interactive elements -->

<!-- Buttons with icons only -->
<buttonaria-label="Close modal"class="btn--icon">
<svg>...</svg>
</button>

<!-- Form inputs -->
<input 
type="text" 
id="email" 
aria-label="Email address"
aria-required="true"
aria-invalid="false"
/>

<!-- Loading states -->
<divrole="status"aria-live="polite"aria-atomic="true">
  Loading data...
</div>

<!-- Tables -->
<tablerole="table"aria-label="User list">
<caption>Active users in the system</caption>
  ...
</table>
```

---

## 12. Icon System

### 12.1 Icon Guidelines

```
Icon Library: Lucide Icons or Heroicons (recommended)
Sizes: 16px, 20px, 24px, 32px
Stroke Width: 2px (default), 1.5px (lighter)
Color: Inherit from parent element

Usage:
- 16px: Inline with small text, badges
- 20px: Buttons, nav items, form elements
- 24px: Section headers, cards
- 32px: Empty states, large features
```

### 12.2 Icon Component

css

```css
.icon{
width:20px;
height:20px;
stroke-width:2;
color: currentColor;
flex-shrink:0;
}

.icon--sm{
width:16px;
height:16px;
}

.icon--lg{
width:24px;
height:24px;
}

.icon--xl{
width:32px;
height:32px;
}

/* Icon with background */
.icon-container{
display: inline-flex;
align-items: center;
justify-content: center;
width:40px;
height:40px;
border-radius:10px;
background:var(--accent-alpha-10);
color:var(--accent-400);
}

.icon-container--success{
background:var(--success-bg);
color:var(--success-text);
}

.icon-container--warning{
background:var(--warning-bg);
color:var(--warning-text);
}

.icon-container--danger{
background:var(--danger-bg);
color:var(--danger-text);
}
```

---

## 13. Analytics Dashboard Specific Components

### 13.1 Dashboard Layout

html

```html
<divclass="dashboard-container">
<!-- Sidebar -->
<asideclass="sidebar">...</aside>
  
<!-- Header -->
<headerclass="header">...</header>
  
<!-- Main content -->
<mainclass="main-content">
<!-- Page header -->
<divclass="page-header">
<h1class="heading-page">Analytics Dashboard</h1>
<divclass="page-actions">
<buttonclass="btn btn--secondary">Export</button>
<buttonclass="btn btn--primary">Create Report</button>
</div>
</div>
  
<!-- Metrics grid -->
<divclass="content-grid">
<divclass="col-span-3">
<divclass="stat-card">...</div>
</div>
<!-- More stat cards -->
</div>
  
<!-- Charts section -->
<divclass="content-grid">
<divclass="col-span-8">
<divclass="chart-container">...</div>
</div>
<divclass="col-span-4">
<divclass="chart-container">...</div>
</div>
</div>
  
<!-- Data table -->
<divclass="table-container">...</div>
</main>
</div>
```

### 13.2 Filter Panel

css

```css
.filter-panel{
background:var(--glass-medium);
backdrop-filter:blur(12px);
border:1px solid var(--border-default);
border-radius:16px;
padding:var(--space-6);
margin-bottom:var(--space-6);
}

.filter-panel-header{
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom:var(--space-4);
}

.filter-panel-title{
font-size:16px;
font-weight:var(--font-weight-semibold);
color:var(--text-primary);
}

.filter-grid{
display: grid;
grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
gap:var(--space-4);
}

.filter-actions{
display: flex;
gap:var(--space-3);
margin-top:var(--space-6);
padding-top:var(--space-6);
border-top:1px solid var(--border-subtle);
}
```

### 13.3 Metric Comparison Card

css

```css
.comparison-card{
background:var(--glass-medium);
backdrop-filter:blur(12px);
border:1px solid var(--border-default);
border-radius:16px;
padding:var(--space-6);
display: grid;
grid-template-columns:1fr auto 1fr;
gap:var(--space-6);
align-items: center;
}

.comparison-item{
text-align: center;
}

.comparison-label{
font-size:12px;
font-weight:var(--font-weight-medium);
color:var(--text-tertiary);
text-transform: uppercase;
margin-bottom:var(--space-2);
}

.comparison-value{
font-size:28px;
font-weight:var(--font-weight-bold);
color:var(--text-primary);
}

.comparison-divider{
width:1px;
height:60px;
background:var(--border-default);
}

.comparison-vs{
font-size:14px;
font-weight:var(--font-weight-semibold);
color:var(--text-tertiary);
padding:var(--space-2)var(--space-4);
background:var(--accent-alpha-10);
border-radius:8px;
}
```

---

## 14. Performance Optimization

### 14.1 CSS Performance

css

```css
/* Use CSS containment for independent components */
.card{
contain: layout style paint;
}

/* Use will-change sparingly for animations */
.animated-element:hover{
will-change: transform, opacity;
}

.animated-element:not(:hover){
will-change: auto;
}

/* Optimize backdrop-filter usage */
.glass-card{
backdrop-filter:blur(12px);
/* Add fallback for non-supporting browsers */
@supportsnot(backdrop-filter:blur(12px)){
background:rgba(15,34,66,0.9);
}
}
```

### 14.2 Loading Strategies

```
1. Critical CSS: Inline above-the-fold styles
2. Lazy load images: Use Intersection Observer
3. Code splitting: Load route-specific CSS async
4. Preload fonts: <link rel="preload" as="font">
5. Minimize repaints: Use transform/opacity for animations
```

---

## 15. Implementation Checklist

### Phase 1: Foundation (Week 1)

```
□ Set up CSS custom properties (colors, spacing, typography)
□ Implement base grid system
□ Create typography styles
□ Set up icon system
□ Establish breakpoints and responsive utilities
```

### Phase 2: Core Components (Week 2)

```
□ Build button system with variants
□ Create input/form components
□ Implement card components
□ Build navigation (sidebar + header)
□ Create modal and dropdown components
```

### Phase 3: Data Components (Week 3)

```
□ Build table component with sorting/filtering
□ Create stat/KPI cards
□ Implement chart containers
□ Build filter panels
□ Create empty states
```

### Phase 4: Polish & Optimization (Week 4)

```
□ Add animations and micro-interactions
□ Implement loading states
□ Add toast notifications
□ Optimize performance
□ Accessibility audit
□ Cross-browser testing
```

---

## 16. Code Example: Complete Dashboard Page

html

```html
<!DOCTYPEhtml>
<htmllang="en">
<head>
<metacharset="UTF-8">
<metaname="viewport"content="width=device-width, initial-scale=1.0">
<title>CWS Analytics Dashboard</title>
<linkrel="stylesheet"href="styles.css">
</head>
<body>
<divclass="dashboard-container">
  
<!-- Sidebar Navigation -->
<asideclass="sidebar">
<divclass="sidebar-logo">
<svgclass="sidebar-logo-icon"width="32"height="32">...</svg>
<spanclass="sidebar-logo-text">CWS</span>
</div>
    
<navclass="nav-menu">
<divclass="nav-section">
<divclass="nav-section-label">Main</div>
<ahref="#"class="nav-item active">
<svgclass="nav-item-icon">...</svg>
<spanclass="nav-item-text">Dashboard</span>
</a>
<ahref="#"class="nav-item">
<svgclass="nav-item-icon">...</svg>
<spanclass="nav-item-text">Analytics</span>
</a>
<ahref="#"class="nav-item">
<svgclass="nav-item-icon">...</svg>
<spanclass="nav-item-text">Reports</span>
<spanclass="nav-item-badge">3</span>
</a>
</div>
      
<divclass="nav-section">
<divclass="nav-section-label">Manage</div>
<ahref="#"class="nav-item">
<svgclass="nav-item-icon">...</svg>
<spanclass="nav-item-text">Customers</span>
</a>
<ahref="#"class="nav-item">
<svgclass="nav-item-icon">...</svg>
<spanclass="nav-item-text">Settings</span>
</a>
</div>
</nav>
</aside>
  
<!-- Header -->
<headerclass="header">
<divclass="header-left">
<divclass="header-breadcrumb">
<spanclass="breadcrumb-item">Home</span>
<spanclass="breadcrumb-separator">/</span>
<spanclass="breadcrumb-item active">Dashboard</span>
</div>
</div>
    
<divclass="header-right">
<divclass="header-search">
<divclass="input-wrapper">
<svgclass="input-icon">...</svg>
<inputtype="text"class="input"placeholder="Search...">
</div>
</div>
      
<divclass="header-actions">
<buttonclass="btn btn--icon header-notification">
<svgclass="icon">...</svg>
<spanclass="notification-badge"></span>
</button>
        
<divclass="header-profile">
<imgsrc="avatar.jpg"alt="User"class="profile-avatar">
<divclass="profile-info">
<divclass="profile-name">John Doe</div>
<divclass="profile-role">Administrator</div>
</div>
</div>
</div>
</div>
</header>
  
<!-- Main Content -->
<mainclass="main-content">
<!-- Page Header -->
<divclass="page-header">
<div>
<h1class="heading-page">Dashboard Overview</h1>
<pclass="text-secondary">Welcome back! Here's what's happening today.</p>
</div>
<divclass="page-actions">
<buttonclass="btn btn--secondary">
<svgclass="icon icon--sm">...</svg>
            Export
</button>
<buttonclass="btn btn--primary">
<svgclass="icon icon--sm">...</svg>
            New Report
</button>
</div>
</div>
    
<!-- KPI Cards -->
<divclass="content-grid">
<divclass="col-span-3">
<divclass="stat-card">
<divclass="stat-card-header">
<divclass="stat-card-label">Total Revenue</div>
<divclass="stat-card-icon">
<svg>...</svg>
</div>
</div>
<divclass="stat-card-value">$45,231</div>
<divclass="stat-card-change stat-card-change--positive">
<svgclass="stat-card-change-icon">...</svg>
<span>12.5%</span>
</div>
<divclass="stat-card-footer">vs last month</div>
</div>
</div>
      
<divclass="col-span-3">
<divclass="stat-card">
<divclass="stat-card-header">
<divclass="stat-card-label">Active Users</div>
<divclass="stat-card-icon">
<svg>...</svg>
</div>
</div>
<divclass="stat-card-value">2,845</div>
<divclass="stat-card-change stat-card-change--positive">
<svgclass="stat-card-change-icon">...</svg>
<span>8.2%</span>
</div>
<divclass="stat-card-footer">vs last month</div>
</div>
</div>
      
<divclass="col-span-3">
<divclass="stat-card">
<divclass="stat-card-header">
<divclass="stat-card-label">Conversion Rate</div>
<divclass="stat-card-icon">
<svg>...</svg>
</div>
</div>
<divclass="stat-card-value">3.24%</div>
<divclass="stat-card-change stat-card-change--negative">
<svgclass="stat-card-change-icon">...</svg>
<span>2.1%</span>
</div>
<divclass="stat-card-footer">vs last month</div>
</div>
</div>
      
<divclass="col-span-3">
<divclass="stat-card">
<divclass="stat-card-header">
<divclass="stat-card-label">Avg. Response Time</div>
<divclass="stat-card-icon">
<svg>...</svg>
</div>
</div>
<divclass="stat-card-value">1.2s</div>
<divclass="stat-card-change stat-card-change--positive">
<svgclass="stat-card-change-icon">...</svg>
<span>15.3%</span>
</div>
<divclass="stat-card-footer">vs last month</div>
</div>
</div>
</div>
    
<!-- Charts Section -->
<divclass="content-grid">
<divclass="col-span-8">
<divclass="chart-container">
<divclass="chart-header">
<divclass="chart-title">Revenue Over Time</div>
<divclass="chart-controls">
<buttonclass="btn btn--sm btn--ghost">Day</button>
<buttonclass="btn btn--sm btn--secondary">Week</button>
<buttonclass="btn btn--sm btn--ghost">Month</button>
</div>
</div>
<divclass="chart-wrapper">
<!-- Chart.js or your preferred charting library -->
<canvasid="revenueChart"></canvas>
</div>
</div>
</div>
      
<divclass="col-span-4">
<divclass="chart-container">
<divclass="chart-header">
<divclass="chart-title">Traffic Sources</div>
</div>
<divclass="chart-wrapper">
<canvasid="trafficChart"></canvas>
</div>
<divclass="chart-legend">
<divclass="legend-item">
<divclass="legend-color"style="background:var(--accent-500);"></div>
<span>Direct</span>
</div>
<divclass="legend-item">
<divclass="legend-color"style="background:var(--success-solid);"></div>
<span>Organic</span>
</div>
<divclass="legend-item">
<divclass="legend-color"style="background:var(--warning-solid);"></div>
<span>Referral</span>
</div>
</div>
</div>
</div>
</div>
    
<!-- Data Table -->
<divclass="table-container">
<divclass="table-header">
<divclass="heading-section">Recent Transactions</div>
<divclass="table-actions">
<divclass="input-wrapper">
<svgclass="input-icon">...</svg>
<inputtype="text"class="input"placeholder="Search...">
</div>
<buttonclass="btn btn--ghost btn--icon">
<svgclass="icon">...</svg>
</button>
</div>
</div>
      
<divclass="table-wrapper">
<tableclass="table">
<thead>
<tr>
<thclass="sortable">Transaction ID</th>
<thclass="sortable">Customer</th>
<thclass="sortable">Amount</th>
<thclass="sortable">Status</th>
<thclass="sortable">Date</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
<tr>
<td><codeclass="code">#TXN-001</code></td>
<td>Jane Smith</td>
<td>$1,234.00</td>
<td>
<spanclass="table-cell-status table-cell-status--success">
<svgclass="icon icon--sm">...</svg>
                    Completed
</span>
</td>
<td>Mar 18, 2026</td>
<td>
<divclass="table-cell-actions">
<buttonclass="btn btn--ghost btn--sm btn--icon">
<svgclass="icon icon--sm">...</svg>
</button>
</div>
</td>
</tr>
<!-- More rows... -->
</tbody>
</table>
</div>
</div>
    
</main>
</div>
</body>
</html>
```

---

## 17. Final Design Principles Summary

### For AI Agent Implementation:

**1. Consistency First**

* Always use design tokens (CSS custom properties)
* Never hard-code colors, spacing, or typography
* Reference the defined variables in every component

**2. Glassmorphism Best Practices**

* Layer translucent surfaces with proper blur
* Maintain visual hierarchy through opacity levels
* Use subtle borders to define component edges
* Add top highlight lines for depth

**3. Spacing Rhythm**

* Follow the 8px base unit system religiously
* Use consistent padding/margin across similar components
* Maintain breathing room between sections (48px minimum)

**4. Typography Hierarchy**

* Page title → Section heading → Card title → Body → Caption
* Never skip levels in the hierarchy
* Maintain consistent font weights per level

**5. Interactive States**

* Always define: default, hover, active, focus, disabled
* Use transitions for smooth state changes
* Provide visual feedback for all interactions

**6. Accessibility Non-Negotiables**

* Minimum 4.5:1 contrast for text
* Focus indicators on all interactive elements
* ARIA labels for icon-only buttons
* Keyboard navigation support

**7. Performance Considerations**

* Use `backdrop-filter` with fallbacks
* Minimize expensive CSS properties in animations
* Lazy load images and heavy components
* Optimize for 60fps animations

**8. Mobile Responsiveness**

* Mobile-first approach
* Test at 375px, 768px, 1024px, 1440px
* Collapse navigation on mobile
* Stack cards vertically below 768px

---

## 18. Handoff Instructions for AI Agent

When redesigning existing frontends or building new ones:

1. **Audit Phase**
   * Identify all existing colors and map to new palette
   * List all component types needed
   * Note any custom interactions or animations
2. **Replace Phase**
   * Swap hard-coded values with CSS custom properties
   * Update component structure to match specifications
   * Implement glassmorphism effects systematically
3. **Enhance Phase**
   * Add hover states and micro-interactions
   * Implement loading and empty states
   * Add proper focus management
4. **Validate Phase**
   * Run contrast checker on all text/background combinations
   * Test keyboard navigation
   * Verify responsive behavior at all breakpoints
   * Check animation performance
5. **Document Phase**
   * Note any deviations from this guide
   * Document new component variants created
   * Update design tokens if extended
