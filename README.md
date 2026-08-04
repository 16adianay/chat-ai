# Chat AI Demo — DevExtreme Form & DataGrid Assistant

A small, dependency-free (no bundler, no build step) demo that shows how to drive a
DevExtreme **Form** and **DataGrid** through a chat-style AI assistant. The user types a
plain-English request in a chat popup (e.g. *"change State to Texas and filter tasks by
Priority High"*), an LLM translates it into structured JSON commands, and the app applies
those commands to the widgets using only public DevExtreme APIs.

Everything runs directly in the browser via plain `<script>` tags — open [index.html](index.html)
and it works, no `npm install` required.

## Quick start

Try prompts like:

- `Change State to Texas`
- `Show Completed Tasks`
- `Filter tasks by Priority High and sort by Due Date descending`
- `Update FirstName to Diana and change Position to CMO`
- `Clear all filters`

## How it works — request lifecycle

In plain words:

1. **Build a single combined system prompt** describing both the Form's fields and the
   DataGrid's commands, and ask the AI to figure out — in one call — which part(s) of the
   user's message apply to which widget, responding with **strict JSON** (no prose, no code
   fences) shaped like `{"updates": [...], "actions": [...]}`.
2. **Parse and validate** the JSON response against known fields/columns/values.
3. **Apply** each individual update/action through the widget's public API
   (`form.updateData()`, `grid.option('filterValue', ...)`, `grid.columnOption(...)`, etc).
4. **Report** one combined chat message back to the user summarizing what succeeded.

There is no separate local classification step — the same AI call that extracts the
commands also implicitly decides whether the message is about the form, the grid, or both
(an unrelated widget simply gets an empty `updates`/`actions` array).

## File-by-file overview

| File | Responsibility |
|---|---|
| [index.html](index.html) | Page shell. Loads DevExtreme/jQuery from CDN, the OpenAI SDK from esm.sh, and all local scripts in dependency order. Contains the demo's inline CSS. |
| [data.js](data.js) | Static demo data and config: Azure OpenAI connection settings (`deployment`, `endpoint`, `apiKey`, `apiVersion`), the `employee` record and `tasks` list bound to the Form/DataGrid, dropdown option lists (`titles`, `states`, `positions`), grid `Priority` colors, and `formFields` (metadata describing each form field: name, human description, allowed values — used to build the AI prompt and to validate AI responses). |
| [index.js](index.js) | App bootstrap. Creates the `dxChat` popup, the `dxForm`, and the `dxDataGrid`, wires up the floating action button, and forwards every submitted chat message straight to `routeMessage`. |
| [chat-router.js](chat-router.js) | The orchestration layer. Builds the combined prompt, makes the single AI call, parses/validates its JSON response, applies the resulting updates/actions to the form/grid, and reports a single chat message back to the user. See [chat-router.js deep dive](#chat-routerjs-deep-dive). |
| [form-commands.js](form-commands.js) | Builds the *form* section of the combined prompt: a description of the Form's available fields (from `formFields` in `data.js`). |
| [grid-commands.js](grid-commands.js) | Defines the registry of grid commands (`filterValue`, `clearFilter`, `sorting`, `clearSorting`, `columnsVisibility`), each with a JSON Schema for its arguments and an `execute(grid, args)` function that calls the corresponding public DataGrid API. Also builds the *grid* section of the combined prompt and applies a batch of AI-returned `actions`. |
| [ai-service.js](ai-service.js) | Wraps the Azure OpenAI JS SDK behind DevExtreme's `AIIntegration` interface (`sendRequest({ prompt }) -> { promise, abort }`), including basic retry-on-rate-limit handling. This is the only file that talks to the network/LLM. |

Load order in `index.html` matters: `data.js` must load before `form-commands.js`/
`grid-commands.js` (they reference its constants), and `chat-router.js` must load after both
command modules (it calls their `build*PromptSection`/`apply*` functions).

There used to be a separate `intent-classifier.js` that decided locally (via keyword
matching) whether a message was about the form, the grid, or both, before sending up to two
separate AI prompts. That file has been removed — the AI now receives one combined prompt
describing both widgets and decides for itself what each part of the message applies to, in
a single request.

## `chat-router.js` deep dive

### Combined requests (`runCommand`)

1. Builds one combined system prompt via `buildCombinedSystemPrompt(columnNames)`, which
   concatenates `buildFormPromptSection()` (from `form-commands.js`) and
   `buildGridPromptSection(columnNames)` (from `grid-commands.js`, columns read live via
   `getGridColumnNames`), plus a single JSON Schema built by `buildCombinedResponseSchema()`
   (which reuses the grid's `actions` schema from `buildGridResponseSchema()` and adds an
   `updates` array for form fields).
2. Sends that prompt + the user's text to the AI in **one** request. Expects back
   `{"updates": [{"field": "...", "value": "..."}], "actions": [{"name": "<command>", "args": {...}}]}`.
   A single message can populate both arrays at once (e.g. *"change State to Texas and
   filter tasks by Priority High"*), just `updates` (form-only), just `actions` (grid-only),
   or neither (rejected, see below).
3. Each form update is applied independently via `applyFormUpdate(form, update)`:
   - Unknown field name → `{status: "failure"}`.
   - Value not in the field's allowed list (e.g. an invalid `Position`) → `{status: "failure"}`.
   - Otherwise calls `form.updateData(field, value)` and returns `{status: "success", message: 'Updated "<caption>".'}`
     (the caption comes from `form.itemOption(field)?.label?.text`, falling back to the raw
     `dataField` if no label is configured).
4. Each grid action is applied independently via `applyGridActions(gridInstance, actions)`,
   which maps `action.name` to an entry in the `gridCommands` registry and calls its
   `execute(grid, args)`, returning `{status: "success"|"failure", message}` per action —
   **the same tolerant, per-item reporting used for form updates**, not an all-or-nothing
   batch.
5. **Only successful updates/actions are reported**, regardless of whether they came from the
   form or the grid. All success messages (form + grid) are joined together. If **none**
   succeeded, the whole request is rejected (surfaces as the generic `❌` error — see below).

This means a request like `"update Name to Diana and change Position to ASD"` (an invalid
position) will apply the name change, reply `✅ Done. Updated "Name".`, and silently ignore
the invalid `Position` request rather than rejecting the whole message — and the same is now
true for grid actions: a message with one valid and one invalid grid command still applies
and reports the valid one.

### Reporting (`reportAiResult` / `routeMessage`)

`routeMessage` runs the single combined request's promise via `reportAiResult`, which pushes
one chat message:

- If **at least one** update/action succeeded → `✅ Done. <joined success messages>`.
- If **none** succeeded (including AI/network errors) → `❌ An unexpected error occurred. Please try again.`

There is intentionally no separate "partially failed" warning message — failures (invalid
field values, unknown grid actions, AI errors) are simply omitted from the report rather than
called out, per the team's preference to keep the chat output focused on what *did* happen.

## Grid commands reference

Defined in [grid-commands.js](grid-commands.js)'s `gridCommands` registry, each with a JSON
Schema (used to build the AI response schema) and an `execute` implementation using only
public `dxDataGrid` methods:

| Command | Purpose | Public API used |
|---|---|---|
| `filterValue` | Filter one column by an operator/value (`=`, `<>`, `<`, `<=`, `>`, `>=`, `contains`, `notcontains`, `startswith`, `endswith`). Dates are parsed from ISO-like strings; the boolean `Completion` column accepts `true`/`false`/`"completed"`/`100`/etc. | `grid.option('filterValue', [column, operator, value])` |
| `clearFilter` | Clears all active filters. | `grid.clearFilter()` |
| `sorting` | Sorts a column `asc`/`desc`, or clears sorting on it with `"none"`. | `grid.columnOption(column, 'sortOrder', value)` |
| `clearSorting` | Removes sorting from every column. | `grid.clearSorting()` |
| `columnsVisibility` | Shows or hides a column. | `grid.columnOption(column, 'visible', bool)` |

Selection commands are intentionally not implemented since selection is disabled in this
demo's grid configuration.
