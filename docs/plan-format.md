# MusicBench Plan Format

This document describes the JSON format used to import and export evaluation plans in MusicBench. It is intentionally self-contained: an LLM given only this document should be able to produce a valid plan file with no other context.

---

## What is a Plan?

A **Plan** is a reusable evaluation definition. It specifies:

- A **prompt template** the system sends to each language model
- A list of **test inputs** substituted into the template one at a time
- An **eval strategy** that determines how model outputs are judged

Running a Plan against one or more models produces **Trials** (one per model × input pair). Trials are then judged to produce a **Report** with per-model scores.

---

## Wire Format

A plan file is a UTF-8 encoded JSON file containing either:

- A **single plan object**, or
- An **array of plan objects** (for bulk import)

File extension convention: `<name>.musicbench.json`

---

## Schema

```json
{
  "name": "string (required)",
  "promptTemplate": "string (required)",
  "inputs": ["string (required, non-empty array)"],
  "evalStrategy": "parse | rate | compare (required)",
  "parseCode": "string | null (required when evalStrategy is parse; null otherwise)",
  "folder": "string (optional, default: \"Imported\")"
}
```

### Field Reference

| Field            | Type             | Required | Description |
| ---------------- | ---------------- | -------- | ----------- |
| `name`           | `string`         | Yes      | Human-readable name shown in the Build sidebar. |
| `promptTemplate` | `string`         | Yes      | The prompt sent to each model. **Must contain the literal placeholder `{{input}}`**, which is replaced with each test input at run time. May contain additional static instructions. |
| `inputs`         | `string[]`       | Yes      | One or more test inputs. Each input is substituted into `{{input}}` in the template. Must be a non-empty array. |
| `evalStrategy`   | `"parse" \| `"rate"` \| `"compare"` | Yes | Judgment method. See [Eval Strategies](#eval-strategies) below. |
| `parseCode`      | `string \| null` | Yes      | Required (non-null) when `evalStrategy` is `"parse"`. A JavaScript function body string that receives the model output and returns `true` (pass) or `false` (fail). Must be `null` for `"rate"` and `"compare"` strategies. See [Parse Code Contract](#parse-code-contract). |
| `folder`         | `string`         | No       | Name of the folder to place the plan in. If the folder does not exist it will be created. Defaults to `"Imported"`. |

---

## Eval Strategies

### `"parse"` — Automated assertion

Each model output is passed to your `parseCode` function immediately after the trial completes. No human review is needed. Best for outputs with a deterministic, machine-checkable structure (e.g. "does the output contain valid ABC notation headers?").

- Judgment type: **Verdict** (pass / fail)
- Human effort: none
- Score: pass rate per model (0–100%)

### `"rate"` — Human star rating

After all trials complete, a human reviews each output and assigns a score from 1–5. Best for subjective quality judgments where you want a cardinal score.

- Judgment type: **Rating** (1–5)
- Human effort: one rating per trial
- Score: mean rating normalised to 0–1

### `"compare"` — Human side-by-side ranking

After all trials complete, a human sees all models' outputs for the same input side-by-side and ranks them from best to worst. Best when the relative ordering of models matters more than absolute quality.

- Judgment type: **Ranking** (ordinal per input)
- Human effort: one ranking per input (across all models simultaneously)
- Score: inverse mean rank normalised to 0–1 (rank 1 = best = score 1.0)

---

## Parse Code Contract

When `evalStrategy` is `"parse"`, `parseCode` must be a **JavaScript function body string**. It is executed as:

```js
const assert = new Function("output", parseCode);
const pass = assert(modelOutput);
```

### Rules

1. The function receives a single argument: `output` (string) — the raw text the model produced.
2. It must return a **truthy** value for pass, or a **falsy** value for fail.
3. Any **thrown exception** is caught and treated as a fail (with the error message recorded).
4. The function runs in a plain `new Function` context — no DOM, no imports, no `require`. Only built-in JavaScript globals are available (`String`, `RegExp`, `JSON`, `Array`, etc.).
5. The string should be the **body** of the function, not the full function declaration. Do not include `function assert(output) { ... }` — write only the statements inside the braces.

### Example parse code bodies

Check for ABC notation required headers:
```js
return /^X:\s*\d+/m.test(output) &&
       /^T:/m.test(output) &&
       /^M:/m.test(output) &&
       /^K:/m.test(output);
```

Check that output is valid JSON:
```js
try { JSON.parse(output); return true; } catch { return false; }
```

Check that output contains a specific keyword (case-insensitive):
```js
return output.toLowerCase().includes("melody");
```

---

## Examples

### Example 1 — Parse strategy (ABC notation validator)

```json
{
  "name": "ABC Notation Headers",
  "folder": "Music Format Tests",
  "promptTemplate": "Generate a short ABC notation tune for the following description. Output only the ABC notation with no explanation.\n\nDescription: {{input}}",
  "inputs": [
    "A cheerful C major melody in 4/4 time",
    "A melancholic minor key waltz",
    "A simple pentatonic folk tune in G major"
  ],
  "evalStrategy": "parse",
  "parseCode": "const required = ['X:', 'T:', 'M:', 'K:'];\nreturn required.every(header => output.includes(header));"
}
```

### Example 2 — Rate strategy (melodic quality)

```json
{
  "name": "Melodic Quality Rating",
  "folder": "Subjective Eval",
  "promptTemplate": "Compose a short melody in ABC notation for the following prompt. Include a title and meter. Output only the ABC notation.\n\n{{input}}",
  "inputs": [
    "A lullaby in F major with a gentle stepwise motion",
    "An energetic dance tune in D major using dotted rhythms",
    "A blues-influenced phrase in minor pentatonic scale",
    "A baroque-style sequence with sequence repetition",
    "A modal tune using the Dorian mode on D"
  ],
  "evalStrategy": "rate",
  "parseCode": null
}
```

### Example 3 — Compare strategy (harmonic style)

```json
{
  "name": "Harmonic Style Comparison",
  "folder": "Comparative Benchmarks",
  "promptTemplate": "Write a four-bar chord progression in ABC notation using the chords described below. Include voice leading. Output only the ABC notation.\n\n{{input}}",
  "inputs": [
    "A jazz ii–V–I in C major with extensions",
    "A classical I–IV–V–I cadence in G major",
    "A modal interchange using borrowed chords in A minor"
  ],
  "evalStrategy": "compare",
  "parseCode": null
}
```

---

## Bulk Import (Array Format)

To import multiple plans at once, wrap them in a JSON array:

```json
[
  {
    "name": "Plan A",
    "folder": "Batch Import",
    "promptTemplate": "{{input}}",
    "inputs": ["test 1"],
    "evalStrategy": "rate",
    "parseCode": null
  },
  {
    "name": "Plan B",
    "folder": "Batch Import",
    "promptTemplate": "Generate ABC for: {{input}}",
    "inputs": ["a waltz", "a march"],
    "evalStrategy": "parse",
    "parseCode": "return output.includes('X:') && output.includes('K:');"
  }
]
```

---

## Validation Rules Summary

| Rule | Details |
| ---- | ------- |
| `name` must be non-empty | Whitespace-only names are rejected. |
| `promptTemplate` must contain `{{input}}` | Exact match including braces. |
| `inputs` must be non-empty | At least one input string required. |
| `inputs` strings must be non-empty | Blank input strings are rejected. |
| `evalStrategy` must be one of three values | `"parse"`, `"rate"`, or `"compare"`. |
| `parseCode` required for `parse` strategy | Must be a non-null, non-empty string. |
| `parseCode` must be null for non-parse | Set to `null` for `rate` and `compare`. |
| Internal fields are ignored on import | `id`, `folderId`, `createdAt`, `updatedAt` are silently ignored if present. |

---

## Tips for LLM-Generated Plans

- Always include `{{input}}` in `promptTemplate` — without it the plan is invalid.
- For `parseCode`, write only the function body; do not wrap it in a function declaration.
- Use `return` explicitly — the function body is not an arrow function and will not implicitly return.
- Prefer `String.prototype.includes` and `RegExp.prototype.test` over complex parsing in `parseCode`; keep assertions simple and robust to minor formatting variation.
- Choose `"rate"` when quality is inherently subjective and hard to express as a boolean assertion.
- Choose `"compare"` when you have multiple models and want to know which is relatively better rather than assigning absolute scores.
- Choose `"parse"` for structural or format compliance checks where correctness is unambiguous.
