# MusicBench — Design Language

## Identity

MusicBench is a precision tool for technical users. The aesthetic is **studio control room** — dense, information-rich, and calm under pressure. Think audio engineering software meets modern data tooling. Not flashy, not playful — confident and quiet.

The interface should feel like it disappears when you're working. No decorative elements. Every pixel earns its place.

## Color System

Two modes. Dark is the default (the primary working environment). Light exists for documentation, sharing, and daytime preference.

### Dark Mode

| Role        | Value                          | Usage                                      |
| ----------- | ------------------------------ | ------------------------------------------ |
| Background  | near-black, cool undertone     | Page canvas                                |
| Surface     | slightly lifted dark           | Cards, panels, sidebars                    |
| Surface Alt | a shade between bg and surface | Nested containers, table stripes           |
| Border      | very low opacity accent        | Dividers, card edges                       |
| Text        | off-white, slight warmth       | Primary readable content                   |
| Text Muted  | mid-gray                       | Secondary labels, metadata                 |
| Text Dim    | darker gray                    | Disabled states, placeholders              |
| Accent      | cool blue, high saturation     | Interactive elements, active states, links |
| Accent Dim  | accent at ~10% opacity         | Selected backgrounds, hover states         |

### Light Mode

Invert the luminance scale. Background becomes near-white with a warm paper tone. Surface is pure white. Text goes dark charcoal. Accent stays the same hue but darkens slightly for contrast. Borders become light gray, not tinted.

Light mode should not feel like an afterthought or a simple CSS inversion. It needs its own tuning — slightly warmer, slightly softer shadows instead of borders, reduced contrast on secondary text.

### Semantic Colors

Four fixed-hue semantic colors, consistent across modes (adjusted for contrast):

- **Success** — green. Pass states, completed runs, positive indicators.
- **Warning** — amber. In-progress, pending evaluation, caution states.
- **Error** — red. Failures, parse errors, destructive actions.
- **Info** — purple/indigo. Neutral highlights, compare mode accents.

### Model Colors

Each LLM provider gets a persistent, recognizable color used in badges, chart bars, and leaderboard entries. These are part of the data layer and should be distinct from the semantic palette. Aim for 6–8 distinguishable hues that work on both dark and light backgrounds.

## Typography

Two families:

- **Body/UI** — A geometric or humanist sans-serif. Clean, good at small sizes, distinct weights. Used for labels, buttons, prose, headings.
- **Mono** — A coding font with ligature support. Used for code editors, raw LLM output, numeric data, latency/token counts.

Sizing stays tight. Most UI text lives between 11–14px. Headings are differentiated by weight and case, not size. Use uppercase + letterspacing for section labels sparingly.

No font size should exceed 20px outside of page titles.

## Layout Principles

- **Two-panel default.** Most surfaces use a narrow sidebar (list/tree navigation) and a wide detail panel. This is the dominant pattern across Builder, Evaluator, and Explorer.
- **Executor breaks the pattern** with a side-by-side config/history split at roughly equal widths.
- **No full-width layouts.** Content is always contained. Max content width ~1400px.
- **Dense but not cramped.** Padding is consistent and compact. 12–20px within cards. 8–16px gaps between elements. Generous padding feels wasteful in a data tool.
- **Scroll over paginate.** Panels scroll independently. No page-level scroll when avoidable.

## Components

### Cards & Panels
Subtle border, no shadow in dark mode. Light mode can use a very soft shadow instead of a border. Consistent radius (small, ~8–10px). No nested border-radius stacking.

### Buttons
Three tiers:
- **Primary** — Filled accent. Used once per visible context (the main action).
- **Ghost** — Outlined or transparent with accent text. Secondary actions.
- **Danger** — Tinted red background. Destructive actions only.

All buttons are small. Padding is tight. No large call-to-action buttons anywhere.

### Badges
Pill-shaped. Tinted background at low opacity with matching text color. Used for status, eval method, model identity. Should be readable at 11px.

### Inputs & Editors
Recessed appearance (darker than surface in dark mode, lighter border in light mode). Minimal chrome. Monospace for code/output textareas. Focus state uses accent border + faint glow, not a thick ring.

### Tables
No heavy grid lines. Alternate row tinting. Sticky headers. Monospace for numeric columns. Left-aligned everything except numeric data (right-aligned).

### Music Renderer
A self-contained dark region regardless of mode. Waveform/notation canvas with its own internal aesthetic — think DAW timeline. Playback and export controls are small and anchored to the bottom-right of the canvas.

### Star Rating
Simple filled/unfilled glyphs. Amber fill. No hover animations — click and done.

### Ranking Interface
Vertical stack of draggable (or arrow-controlled) items. Each item shows rank number, model badge, and reorder controls. Minimal chrome.

## Motion

Almost none. This is a workhorse tool.

- Tab switches: instant, no transition.
- Panel content: no entrance animations.
- Progress bars: smooth width transition (~300ms ease).
- Score bars in Explorer: width transition on mount (~500ms ease) for visual polish.
- Button press: subtle scale (98%) on active state.
- Hover: border/background color shift only, fast (~150ms).

No page transitions, no staggered reveals, no skeleton loaders. Data appears when it's ready.

## Iconography

Lucide icons (14–16px).

## Spacing & Rhythm

Use a 4px base unit. All spacing values are multiples: 4, 8, 12, 16, 20, 24. No odd values. No spacing tokens larger than 32px except page-level padding.

Vertical rhythm within cards: 6–8px between related elements, 16–20px between sections.