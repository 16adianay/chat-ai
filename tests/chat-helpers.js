// @ts-check
const { expect } = require("@playwright/test");

/**
 * Opens the AI Assistant popup via the floating action button and returns the
 * chat textarea locator, ready for typing.
 * @param {import('@playwright/test').Page} page
 */
async function openAiChat(page) {
  await page.goto("/");

  // Wait for DevExtreme to finish bootstrapping the widgets (form/grid/FAB).
  // The FAB renders as an overlay: the actual clickable/visible surface is
  // .dx-overlay-content nested inside the .dx-fa-button wrapper.
  const fab = page.locator(".dx-fa-button .dx-overlay-content");
  await fab.waitFor({ state: "visible" });
  await fab.click();

  const textarea = page.getByPlaceholder("Enter a prompt...");
  await textarea.waitFor({ state: "visible" });
  return textarea;
}

/**
 * Types a prompt into the open AI Chat and submits it with Enter, then waits
 * for a new assistant bubble to appear and returns its text content.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} textarea
 * @param {string} prompt
 */
async function sendChatMessage(page, textarea, prompt) {
  const bubbles = page.locator(".dx-chat-messagebubble-content");
  const countBefore = await bubbles.count();

  await textarea.click();
  await textarea.fill(prompt);
  await textarea.press("Enter");

  // A user bubble is added immediately; the assistant's reply is a second
  // bubble that only shows up once the AI round-trip finishes.
  await expect(bubbles).toHaveCount(countBefore + 2, { timeout: 30_000 });

  return bubbles.last().innerText();
}

/**
 * Reads a live DevExtreme widget option from the page (form/grid instances
 * are attached to their containers via jQuery, exactly as index.js sets them up).
 * @param {import('@playwright/test').Page} page
 * @param {"#form-container" | "#grid-container"} selector
 * @param {string} widgetName "dxForm" | "dxDataGrid"
 * @param {string} option
 */
async function getWidgetOption(page, selector, widgetName, option) {
  return page.evaluate(
    ({ selector, widgetName, option }) =>
      // eslint-disable-next-line no-undef
      window.$(selector)[widgetName]("instance").option(option),
    { selector, widgetName, option },
  );
}

module.exports = { openAiChat, sendChatMessage, getWidgetOption };
