---
name: academic-pptx
description: Use when the user wants to create or improve a professional presentation, slide deck, architecture briefing, platform overview, conference talk, seminar slides, thesis defense, grant briefing, or any deck where the audience will evaluate reasoning, evidence, structure, and clarity. Triggers include: presentation deck, PowerPoint, slides, architecture presentation, platform overview deck, governance presentation, academic deck, seminar slides, conference talk. This skill governs content, structure, and communication standards for the deck.
license: Proprietary. LICENSE.txt has complete terms
---

# Academic Presentations Skill

## How This Skill Works

This skill has two layers:

1. **This file** — governs content, argument structure, and design standards for academic presentations. Read it fully before planning any slides.
2. **PPTX skill** — governs the technical implementation (creating, editing, and QA-ing the `.pptx` file). Read it too.

**Always read both before writing any code or creating any files.**

---

## Quick Reference

| Task | Guide |
|------|-------|
| Content planning, argument structure, slide-by-slide rules | [content_guidelines.md](content_guidelines.md) |
| Per-slide-type patterns (title, methods, results, etc.) | [slide_patterns.md](slide_patterns.md) |
| Technical creation from scratch | PPTX skill -> `pptxgenjs.md` |
| Technical editing of an existing file | PPTX skill -> `editing.md` |

---

## Step 1: Identify Presentation Type

Before planning a single slide, determine which mode applies.

### Structured Argument (default for academic work)

Use for: conference papers, seminar talks, thesis defenses, dissertation chapters, grant briefings, internal lab presentations, policy briefings, consulting-style research deliverables, architecture briefings, technical platform walkthroughs, and governance presentations.

**Priority order: argument structure -> data -> layout -> aesthetics.**

Follow [content_guidelines.md](content_guidelines.md) in full.

### Visual / Narrative

Use for: public engagement talks, science communication to non-specialist audiences, funding pitches to lay panels, event keynotes.

Follow the PPTX skill's design-forward guidelines. Argument structure still matters, but visual storytelling and emotional engagement take priority.

### When in doubt

Default to **Structured Argument**. If the user mentions a paper, a study, a dataset, a thesis, a grant, a conference, a platform explanation, or an architecture/deployment presentation, they almost certainly want structured argument mode.

---

## Step 2: Plan the Deck Before Creating Any Slides

Produce a slide-by-slide outline (title, action title, exhibit type) and confirm with the user if the deck is more than 10 slides or if the content is complex. Do not start building until the outline is agreed.

Use the ghost deck test during planning: read only the proposed action titles in sequence. They must tell the complete argument. If they don't, fix the outline before building.

---

## Step 3: Apply Design Standards

Academic and analytical presentations use **communication-first design**. These rules override design-forward defaults.

### Color

- White background for all content slides.
- One sans-serif font throughout (Arial, Calibri, or Helvetica).
- Maximum three colors: one primary, one accent, one for emphasis or alerts.
- Use color to **direct attention**, not for decoration.

### Typography

| Element | Size | Weight |
|---------|------|--------|
| Action title | 24-28 pt | Bold |
| Section header | 20-22 pt | Bold |
| Body bullets | 20 pt | Regular |
| Chart labels / annotations | 16-18 pt | Regular |
| Source citations on slides | 12-14 pt | Regular, muted color |

### Layout

- Left-align all body text.
- Consistent grid and spacing.
- For result slides: figure on the left, interpretive bullets on the right.
- White space is part of the communication.
- 16:9 widescreen is the default.

### Avoid

- decorative icons on analytical slides unless they help comprehension
- accent lines under titles when whitespace is enough
- decorative color palettes
- full-bleed background images on content slides
- text-heavy slides

---

## Step 4: Build and QA

Use the PPTX skill's QA process, then apply these deck-specific checks:

```
Academic / analytical QA checklist:
□ Every content slide has an action title
□ Ghost deck test passes
□ One exhibit per results slide; each exhibit has a clear annotation
□ Every borrowed figure or data point has an in-slide citation
□ A References slide exists at the end
□ Conclusions slide is the last non-appendix slide
□ Contact information and/or QR code/link on the final slide
□ Font sizes are readable from the back of a room
□ No decorative elements that do not carry content
□ Section dividers or breadcrumb bar present for decks > 15 slides
```

---

## Key Principles (Summary)

**Action titles, not topic labels.** Every slide title is a complete sentence stating the takeaway.

**One argument, made well.** Don't present everything. Choose the claim that can be made convincingly.

**One insight per slide.** One exhibit per results slide. Highlight the key finding directly on the chart.

**Slides support speech; they don't replace it.**

**Cite everything borrowed.**

**End on conclusions.**

---

## Dependencies

Same as PPTX skill:
- `pip install "markitdown[pptx]"`
- `npm install -g pptxgenjs`
- LibreOffice (`soffice`)
- Poppler (`pdftoppm`)
