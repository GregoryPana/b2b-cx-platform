## Affordances and signifiers
Make elements visually show what they do: use containers, borders, and filled states so users know what is grouped, selected, or inactive without reading instructions.

Always give clear signifiers: press states on buttons, highlights on active nav items, hover states, tooltips explaining actions.

## Visual hierarchy
Emphasize what matters with size, position, and color: key info (like item name or price) goes near the top, larger, and more colorful.

Use contrast (big vs small, colorful vs neutral) and images to guide the eye, and keep repeated content in consistent formats.

## Grids, layouts, and spacing
Treat grids (12/8/4 columns) as guidelines, not strict rules, especially for custom pages.

Prioritize whitespace and consistency: use simple spacing systems (like 4‑point, 8‑point, 32px gaps) and group elements that belong together.

## Typography and font sizing
Use one good sans-serif font for almost everything and avoid overthinking font choices.

Limit yourself to about six text sizes on marketing pages (fewer and tighter on dashboards), and make big headings feel refined with slightly negative letter-spacing and tight line-height (around 110–120%).

## Color and dark mode
Start from one primary (brand) color, then create lighter versions for backgrounds and darker ones for text and accents, building toward a simple color ramp.

Use semantic color with purpose (blue trust, red danger, yellow warning, green success), and in dark mode reduce contrasty borders, make cards lighter than the background, and dim overly bright chips.

## Shadows and depth
Use subtle shadows in light mode, adjusting opacity and blur so the shadow doesn’t become the first thing you notice.

Give small, flat elements lighter shadows, and use stronger shadows for floating elements like popovers or raised buttons (including inner/outer shadow “tactile” effects).

## Icons and buttons
Size icons to match the text line-height (for example, a 24px line-height → 24px icon) and then tighten the text spacing.

Ghost buttons (no background until hover) are just buttons in a different state; keep padding roughly “height × 2 for width” and support both with and without icons.

## Feedback, states, and micro-interactions
Give every interactive element multiple states: default, hover, active/pressed, disabled, and often loading; do the same for inputs with focus, error, and warning states plus clear messages.

Add micro-interactions that confirm actions (like a chip sliding up after copy) so the user sees a direct response to what they did, balancing utility with delight.

## Overlays on images
Avoid overlays that either leave text unreadable or ruin the image; instead, use a gradient that transitions from image to solid background under the text. 

For a more polished feel, layer a subtle progressive blur over the gradient so the image stays visible but the text area remains clear and readable.