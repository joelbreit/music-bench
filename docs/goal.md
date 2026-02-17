# MusicBench — Project Goal

An evaluation suite for benchmarking LLM-based programmatic music generation.

## Domain Model

**Plan** — A reusable evaluation definition containing a prompt template, a set of inputs, and an evaluation strategy. Plans are organized into **Folders**.

**Run** — An execution of a Plan against one or more Models. Produces a set of Trials.

**Trial** — A single (Model × Input) invocation within a Run. Captures the raw output, latency, and token usage.

**Judgment** — The evaluation result for a Trial. Takes one of three forms depending on the Plan's evaluation strategy:

- **Verdict** (Parse) — Programmatic pass/fail via code assertion
- **Rating** (Rate) — Admin-assigned 1–5 score after reviewing rendered output
- **Ranking** (Compare) — Admin-assigned ordinal rank across Models for a shared Input

**Report** — Aggregated Judgments for a completed Run, producing per-model scores and a leaderboard.

## Surfaces

### Build

Create and manage Plans within Folders.

- CRUD operations on Folders and Plans
- Prompt template editor with `{{input}}` interpolation
- Input list management (add, edit, remove)
- Evaluation strategy selection (Parse, Rate, Compare)
- Parse code editor for programmatic assertions

### Run

Configure and launch Runs.

- Model selection (multi-select from available models)
- Plan selection
- Run lifecycle management (start, monitor progress)
- Run history with status tracking
- Automatic Verdict generation for Parse plans during execution

### Evaluate

Human-in-the-loop judgment interface for completed Runs.

- Queue of Runs pending evaluation (Rate and Compare only)
- **Rate mode**: Step through Trials individually. Render the music output, display raw output, assign a 1–5 Rating.
- **Compare mode**: View all Model outputs for a given Input side-by-side. Render each, then rank them.

### Explore

Review and compare results across completed Runs.

- Run selection
- Model leaderboard with aggregate scores
- Score computation per strategy:
  - Parse → pass rate
  - Rate → mean rating (normalized)
  - Compare → inverse mean rank (normalized)
- Per-Trial detail table with latency, tokens, and Judgments
- Filterable by Model, Input, and score

## Data Flow

```
Plan + Models
    ↓
   Run
    ↓
 Trial[]  ←  LLM API (one call per Model × Input)
    ↓
Judgment[]  ←  Auto (Parse) or Admin (Rate / Compare)
    ↓
  Report   →  Leaderboard + Detail View
```

## Key Design Decisions

- **Music rendering is pluggable.** The suite renders LLM output for human evaluation but is agnostic to the rendering engine. Any notation format (ABC, MusicXML, custom DSL) can be supported by swapping the renderer.
- **LLM integration is pluggable.** Model calls go through a uniform interface: `(model, prompt, input) → (output, latency, tokens)`. Providers are configured externally.
- **Judgments are immutable per Trial.** Re-evaluation requires a new Run.
- **Parse evaluations run inline during execution.** Rate and Compare require a separate evaluation pass.
- **Runs are the unit of comparison.** Cross-Run comparison (same Plan, different Model sets or dates) is a future concern.

## Future Considerations

- Prompt versioning and diffing
- Model config variants (temperature, system prompt) as distinct entries
- Batch/parallel execution with rate limiting
- Export (CSV, JSON) of Reports
- Cross-Run trend analysis
- Multi-admin evaluation with inter-rater agreement metrics
- Notation-specific parse helpers (e.g. ABC validation, MusicXML schema check)
