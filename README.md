# Chat AI Demo — DevExtreme Form & DataGrid Assistant

A small, dependency-free (no bundler, no build step) demo that shows how to drive a
DevExtreme **Form** and **DataGrid** through a chat-style AI assistant. The user types a
plain-English request in a chat popup (e.g. _"change State to Texas and filter tasks by
Priority High"_), an LLM translates it into structured JSON commands, and the app applies
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

In plain words, every chat message triggers two independent operations in parallel:

1. **Form**: the raw message text is handed straight to the Form's built-in
   [Smart Paste](https://js.devexpress.com/jQuery/Documentation/ApiReference/UI_Components/dxForm/Methods/#smartPastetext)
   feature (`form.smartPaste(text)`), which uses the Form's own `aiIntegration` to figure out
   which fields (if any) the text is about and populates them directly — no custom prompt or
   schema needed on our side.
2. **Grid**: a system prompt describing the DataGrid's commands is sent to the AI, which
   responds with **strict JSON** (no prose, no code fences) shaped like `{"actions": [...]}`.
   That response is parsed/validated and each action is applied through the grid's public API
   (`grid.option('filterValue', ...)`, `grid.columnOption(...)`, etc).

Both operations report their own success/failure per field/action, and a single combined chat
message summarizes everything that succeeded across both.

## File-by-file overview

| File                                 | Responsibility                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [index.html](index.html)             | Page shell. Loads DevExtreme/jQuery from CDN, the OpenAI SDK from esm.sh, and all local scripts in dependency order. Contains the demo's inline CSS.                                                                                                                                                                                                  |
| [data.js](data.js)                   | Static demo data and config: Azure OpenAI connection settings (`deployment`, `endpoint`, `apiKey`, `apiVersion`), the `employee` record and `tasks` list bound to the Form/DataGrid, dropdown option lists (`titles`, `states`, `positions`), and grid `Priority` colors.                                                                             |
| [index.js](index.js)                 | App bootstrap. Creates the `dxChat` popup, the `dxForm` (wired to the shared `aiIntegration` for Smart Paste), and the `dxDataGrid`, wires up the floating action button, and forwards every submitted chat message straight to `routeMessage`.                                                                                                       |
| [chat-router.js](chat-router.js)     | The orchestration layer. Kicks off the Form's Smart Paste and the grid's AI call in parallel, parses/validates the grid JSON response, applies the resulting actions, and reports a single chat message back to the user. See [chat-router.js deep dive](#chat-routerjs-deep-dive).                                                                   |
| [form-commands.js](form-commands.js) | Wraps `form.smartPaste(text)` in a Promise (`applyFormSmartPaste`) that resolves once the Form's `smartPasted` event fires, reporting success/failure based on how many fields the AI populated.                                                                                                                                                      |
| [grid-commands.js](grid-commands.js) | Defines the registry of grid commands (`filterValue`, `clearFilter`, `sorting`, `clearSorting`, `columnsVisibility`), each with a JSON Schema for its arguments and an `execute(grid, args)` function that calls the corresponding public DataGrid API. Also builds the _grid_ section of the AI prompt and applies a batch of AI-returned `actions`. |
| [ai-service.js](ai-service.js)       | Wraps the Azure OpenAI JS SDK behind DevExtreme's `AIIntegration` interface (`sendRequest({ prompt }) -> { promise, abort }`), including basic retry-on-rate-limit handling. This is the only file that talks to the network/LLM. The same instance is shared by the chat's grid requests and by the Form's Smart Paste.                              |

Load order in `index.html` matters: `data.js` must load before `form-commands.js`/
`grid-commands.js` (they reference its constants), and `chat-router.js` must load after both
command modules (it calls their `build*PromptSection`/`apply*` functions).

There used to be a separate `intent-classifier.js` that decided locally (via keyword
matching) whether a message was about the form, the grid, or both, before sending up to two
separate AI prompts. That file has been removed. Form updates are now handled entirely by
the Form's own built-in Smart Paste feature instead of a custom prompt/schema; only grid
commands still go through our own AI call.

## `chat-router.js` deep dive

### Requests (`runCommand`)

1. Kicks off two independent operations **in parallel** for every message:
   - **Form**: `applyFormSmartPaste(form, text)` (from `form-commands.js`) calls
     `form.smartPaste(text)`, which uses the Form's own `aiIntegration` to decide which
     fields (if any) the text is about and populates them directly — DevExtreme handles the
     prompt/schema/parsing internally, we don't build any of that ourselves.
   - **Grid**: builds a system prompt via `buildGridSystemPrompt(columnNames)` (which wraps
     `buildGridPromptSection(columnNames)` from `grid-commands.js`, columns read live via
     `getGridColumnNames`, plus the JSON Schema from `buildGridResponseSchema()`) and sends
     it + the user's text to the AI. Expects back
     `{"actions": [{"name": "<command>", "args": {...}}]}`.
2. `applyFormSmartPaste` resolves once the Form's `smartPasted` event fires: if the AI
   populated at least one field, `{status: "success", message: "Updated the form."}`;
   otherwise `{status: "failure"}`.
3. Each grid action is applied independently via `applyGridActions(gridInstance, actions)`,
   which maps `action.name` to an entry in the `gridCommands` registry and calls its
   `execute(grid, args)`, returning `{status: "success"|"failure", message}` per action — not
   an all-or-nothing batch.
4. **Only successful form/grid results are reported as "Done"**. All success messages are
   joined together. If **none** succeeded — the Form found nothing to paste, an unknown
   column was referenced, or the grid AI call/response failed — the whole request is
   rejected with one message (the specific grid AI error if there was one, otherwise the
   generic "couldn't find that field or column" message) instead of listing every reason.

This means a message with one valid and one invalid grid command still applies and reports
only the valid one, and a form Smart Paste that only matches some of the pasted fields still
reports success as long as at least one field was populated.

### Reporting (`reportAiResult` / `routeMessage`)

`routeMessage` runs `runCommand`'s combined promise via `reportAiResult`, which pushes one
chat message:

- If **at least one** form field or grid action succeeded → `✅ Done. <joined success messages>`.
- If **none** succeeded — Smart Paste found nothing to populate and the grid AI call
  returned nothing relevant or referenced an unknown column → `❌ I couldn't find that field
or column, or the value you entered isn't valid. Please check the name and value and try
again.` (or the grid AI call's specific error, if it had one).
- If the grid AI's response couldn't be parsed as JSON → `❌ I received an unexpected response
from the AI. Please rephrase your request and try again.`
- If the outgoing request was rejected for being too long → `❌ That message is too long for
me to process. Please shorten it and try again.`
- For any other unexpected error (network failure, AI service outage, etc.) → `❌ I couldn't
reach the AI service. Please check your connection and try again.`

Each specific case is raised as a `ChatCommandError` (defined in `chat-router.js`) whose
`message` is shown to the user as-is; anything else falls back to the generic network-error
text above.

## Grid commands reference

Defined in [grid-commands.js](grid-commands.js)'s `gridCommands` registry, each with a JSON
Schema (used to build the AI response schema) and an `execute` implementation using only
public `dxDataGrid` methods:

| Command             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Public API used                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `filterValue`       | Filter one column by an operator/value (`=`, `<>`, `<`, `<=`, `>`, `>=`, `contains`, `notcontains`, `startswith`, `endswith`). Dates are parsed from ISO-like strings; the boolean `Completion` column accepts `true`/`false`/`"completed"`/`100`/etc. A date column can also be filtered by year/month with `anyof` and an array of `"YYYY"` or `"YYYY/M"` strings (e.g. `["2023/5"]` for May 2023) — the same mechanism the grid's own header filter uses when you pick a year then a month. | `grid.option('filterValue', [column, operator, value])`, e.g. `['DueDate', 'anyof', ['2023/5']]` |
| `clearFilter`       | Clears all active filters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `grid.clearFilter()`                                                                             |
| `sorting`           | Sorts a column `asc`/`desc`, or clears sorting on it with `"none"`.                                                                                                                                                                                                                                                                                                                                                                                                                            | `grid.columnOption(column, 'sortOrder', value)`                                                  |
| `clearSorting`      | Removes sorting from every column.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `grid.clearSorting()`                                                                            |
| `columnsVisibility` | Shows or hides a column.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `grid.columnOption(column, 'visible', bool)`                                                     |

Selection commands are intentionally not implemented since selection is disabled in this
demo's grid configuration.
