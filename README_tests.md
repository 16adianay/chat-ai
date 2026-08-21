# chat-ai — Playwright E2E Tests

End-to-end tests that drive the AI Chat popup to control the demo's
DevExtreme Form (via Smart Paste) and DataGrid (via AI-generated grid
commands), and assert on the resulting widget state.

## Files

```
package.json
playwright.config.js
tests/
  chat-helpers.js   # shared helpers: open chat, send message, read widget state
  ai-chat.spec.js   # the 5 test scenarios
```

Copy these into the root of this repo (same level as `index.html`).

## Setup

```bash
npm install
npx playwright install --with-deps chromium
```

## Run

```bash
npm run test:e2e          # headless
npm run test:e2e:headed   # watch the browser
npm run test:e2e:ui       # interactive Playwright UI
```

`playwright.config.js` automatically serves the repo root with `npx serve`
on `http://127.0.0.1:4173` before running tests — no manual server needed.

## View results

```bash
npx playwright show-report
```

Terminal output ends with a summary line (`5 passed` / `x passed, y failed`).
On failure, a screenshot, video, and trace are saved (see the HTML report).

## Test scenarios

| #   | Prompt                                   | Assertion                                                                                                    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `set the customer name to Tom Riddle`    | Form `FirstName === "Tom"`, `LastName === "Riddle"`                                                          |
| 2   | `change birth to January 13 1977`        | Form `BirthDate` parses to 1977-01-13                                                                        |
| 3   | `sort Subject and Due date`              | Grid `sortOrder` set on both `Subject` and `DueDate`                                                         |
| 4   | `Clear all sorting`                      | Grid `sortOrder` cleared on every column                                                                     |
| 5   | `Keep rows whose duedate is in May 2023` | Grid `filterValue` is `['DueDate', 'anyof', [...'2023/5'...]]`; every visible row's `DueDate` is in May 2023 |

## Key selectors (for future maintenance)

- Open chat: `.dx-fa-button .dx-overlay-content` (the single
  `dxSpeedDialAction` renders as an overlay-wrapped main FAB button)
- Chat input: `getByPlaceholder("Enter a prompt...")` — set via the
  `dxChat-textareaPlaceholder` localization override in `index.js`
- Chat bubbles: `.dx-chat-messagebubble-content`
- Form/grid state is read directly via
  `$("#form-container").dxForm("instance")` /
  `$("#grid-container").dxDataGrid("instance")` inside `page.evaluate`,
  the same way `index.js` holds onto them.
