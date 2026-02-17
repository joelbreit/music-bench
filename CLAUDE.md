# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MusicBench — an evaluation suite for benchmarking LLM-based programmatic music generation. This is a monorepo with the frontend in `apps/web`. A backend may be added to `infra/`, but it is not yet clear if that will be necessary. Documentation is in `docs/`.

Keep documentation, including this file, up to date as you work. Use Mermaid for diagrams.

## Commands

All commands run from `apps/web/` using **pnpm**:

- `pnpm dev` — start Vite dev server
- `pnpm build` — type-check (`tsc -b`) then production build
- `pnpm lint` — ESLint
- `pnpm format` — Prettier (write)
- `pnpm format:check` — Prettier (check only)
- `pnpm preview` — serve the production build locally

No test runner is configured yet.

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** (utility-first, configured in `src/index.css`)
- **Shadcn UI** (New York style, neutral base color, CSS variables) — add components via `npx shadcn@latest add <component>`
- **Lucide React** for icons
- **pnpm** as package manager

## Code Style

- **Tabs** (width 4), single quotes, semicolons, trailing commas (ES5) — enforced by Prettier
- Path alias: `@/*` → `./src/*`
- `cn()` utility in `src/lib/utils.ts` for merging Tailwind classes (clsx + tailwind-merge)
- ESLint 9 flat config with TypeScript and React Hooks rules
- Use Console logging for all user interactions (except individual key strokes in input fields), network requests, errors, and any substantial function calls or useEffect/useCallback/etc. calls.

## Architecture

### Domain Model (see `docs/goal.md`)

- **Plan** — evaluation definition (prompt template, inputs, eval strategy)
- **Run** — execution of a Plan against Models → produces Trials
- **Trial** — single (Model × Input) invocation (output, latency, tokens)
- **Judgment** — Verdict (parse pass/fail), Rating (1–5), or Ranking (ordinal)
- **Report** — aggregated scores and leaderboard

### Application Surfaces

1. **Build** — CRUD for Plans and Folders, prompt template editor, eval strategy config
2. **Run** — model selection, run lifecycle, auto-verdict for Parse plans
3. **Evaluate** — human-in-the-loop: Rate (per-trial scoring) or Compare (side-by-side ranking)
4. **Explore** — leaderboard, per-trial detail, filtering by model/input/score

### Design Principles

- Music rendering is pluggable (notation-agnostic)
- LLM integration is pluggable (provider-agnostic)
- Judgments are immutable per Trial; re-evaluation requires a new Run
- Parse evaluations run inline during execution; Rate/Compare require a separate pass

## Design

See `docs/design.md` for the full design language. Key patterns:

- **Two-panel default** — narrow sidebar (list/nav) + wide detail panel. Most surfaces follow this. The Run surface is the exception: roughly equal-width config/history split.
- **4px spacing base** — all spacing in multiples of 4 (4, 8, 12, 16, 20, 24). Max 32px except page-level padding.
- **Dense but not cramped** — 12–20px within cards, 8–16px gaps between elements.
- **Dark mode default** — near-black background, slightly lifted surface for cards/panels. Light mode is separately tuned, not a CSS inversion.
- **Accent** — cool blue, high saturation. Used for interactive elements, active states, links.
- **Motion is minimal** — no page transitions or entrance animations. Progress bars: ~300ms ease. Score bars on mount: ~500ms ease. Hover: ~150ms color shift only.
- **Typography** — UI text 11–14px. No font size exceeds 20px outside page titles. Headings differ by weight/case, not size. Monospace for code, raw output, and numeric data.
- **Semantic colors** — success (green), warning (amber), error (red), info (purple/indigo).
- **Model colors** — each LLM provider gets a persistent distinct hue for badges, chart bars, and leaderboard entries (6–8 hues, separate from the semantic palette).