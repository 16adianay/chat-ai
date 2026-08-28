// @ts-check
const { test, expect } = require("@playwright/test");
const {
  openAiChat,
  sendChatMessage,
  getWidgetOption,
} = require("./chat-helpers");

/**
 * NOTE ON THESE TESTS
 * --------------------
 * `ai-service.js` calls a real Azure OpenAI deployment configured in `data.js`.
 * These tests send real prompts through the chat UI and wait for the real
 * response, so they:
 *   - need network access to the configured Azure OpenAI endpoint,
 *   - are non-deterministic to the extent the LLM's phrasing/response varies,
 *   - will consume API quota/cost on every run.
 * Assertions below therefore check the resulting *application state*
 * (form data / grid options) rather than the exact wording of the chat reply,
 * and use generous timeouts to absorb model latency.
 */

test.describe("AI Chat — Form (Smart Paste)", () => {
  test("set the customer name to Tom Riddle", async ({ page }) => {
    const textarea = await openAiChat(page);
    const reply = await sendChatMessage(
      page,
      textarea,
      "set the customer name to Tom Riddle",
    );

    expect(reply).toContain("Done");

    const formData = await getWidgetOption(
      page,
      "#form-container",
      "dxForm",
      "formData",
    );
    expect(formData.FirstName).toBe("Tom");
    expect(formData.LastName).toBe("Riddle");
  });

  test("change birth to January 13 1977", async ({ page }) => {
    const textarea = await openAiChat(page);
    const reply = await sendChatMessage(
      page,
      textarea,
      "change birth to January 13 1977",
    );

    expect(reply).toContain("Done");

    const formData = await getWidgetOption(
      page,
      "#form-container",
      "dxForm",
      "formData",
    );
    const birthDate = new Date(formData.BirthDate);
    expect(birthDate.getFullYear()).toBe(1977);
    expect(birthDate.getMonth()).toBe(0); // January
    expect(birthDate.getDate()).toBe(13);
  });

  test("clear all fields", async ({ page }) => {
    const textarea = await openAiChat(page);

    const reply = await sendChatMessage(page, textarea, "clear all fields");
    expect(reply).toContain("Done");

    const formData = await getWidgetOption(
      page,
      "#form-container",
      "dxForm",
      "formData",
    );
    expect(formData.FirstName).toBeFalsy();
    expect(formData.LastName).toBeFalsy();
    expect(formData.Prefix).toBeFalsy();
    expect(formData.Position).toBeFalsy();
    expect(formData.State).toBeFalsy();
    expect(formData.BirthDate).toBeFalsy();
  });
});

test.describe("AI Chat — DataGrid commands", () => {
  test("sort Subject and Due date", async ({ page }) => {
    const textarea = await openAiChat(page);
    const reply = await sendChatMessage(
      page,
      textarea,
      "sort Subject and Due date",
    );

    expect(reply).toContain("Done");

    const subjectSort = await getSortOrder(page, "Subject");
    const dueDateSort = await getSortOrder(page, "DueDate");

    expect(subjectSort).not.toBeNull();
    expect(dueDateSort).not.toBeNull();
  });

  test("Clear all sorting", async ({ page }) => {
    const textarea = await openAiChat(page);

    // Establish sorting first so there's something to clear.
    await sendChatMessage(page, textarea, "sort Subject and Due date");
    expect(await getSortOrder(page, "Subject")).not.toBeNull();

    const reply = await sendChatMessage(page, textarea, "Clear all sorting");
    expect(reply).toContain("Done");

    const columns = [
      "Subject",
      "StartDate",
      "DueDate",
      "Priority",
      "Completion",
    ];
    for (const column of columns) {
      // DevExtreme's clearSorting() resets sortOrder to `undefined`
      expect(await getSortOrder(page, column)).toBeFalsy();
    }
  });

  test("Keep rows whose duedate is in May 2026", async ({ page }) => {
    const textarea = await openAiChat(page);
    const reply = await sendChatMessage(
      page,
      textarea,
      "Keep rows whose duedate is in May 2026",
    );

    expect(reply).toContain("Done");

    const filterValue = await getWidgetOption(
      page,
      "#grid-container",
      "dxDataGrid",
      "filterValue",
    );

    // Per the grid's `filterValue` command, filtering a date column by
    // year/month uses the 'anyof' operator with a "YYYY/M" token.
    expect(filterValue[0]).toBe("DueDate");
    expect(filterValue[1]).toBe("anyof");
    expect(filterValue[2]).toContain("2026/5");

    // Sanity check: every visible row's DueDate actually falls in May 2026.
    const dueDates = await page.evaluate(() =>
      // eslint-disable-next-line no-undef
      window
        .$("#grid-container")
        .dxDataGrid("instance")
        .getVisibleRows()
        .map((row) => row.data.DueDate),
    );
    for (const dueDate of dueDates) {
      const date = new Date(dueDate);
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(4); // May
    }
  });
});

test.describe("AI Chat — combined form + grid requests", () => {
  test("clear the First Name field and clear all filters", async ({ page }) => {
    const textarea = await openAiChat(page);

    // Establish a filter first so there's something for the grid part to clear.
    await sendChatMessage(
      page,
      textarea,
      "Keep rows whose duedate is in May 2026",
    );
    expect(
      await getWidgetOption(
        page,
        "#grid-container",
        "dxDataGrid",
        "filterValue",
      ),
    ).toBeTruthy();

    const reply = await sendChatMessage(
      page,
      textarea,
      "clear the First Name field and clear all filters",
    );
    expect(reply).toContain("Done");

    const formData = await getWidgetOption(
      page,
      "#form-container",
      "dxForm",
      "formData",
    );
    expect(formData.FirstName).toBeFalsy();

    const filterValue = await getWidgetOption(
      page,
      "#grid-container",
      "dxDataGrid",
      "filterValue",
    );
    expect(filterValue).toBeFalsy();
  });
});

/** @param {import('@playwright/test').Page} page */
async function getSortOrder(page, columnDataField) {
  return page.evaluate(
    (columnDataField) =>
      // eslint-disable-next-line no-undef
      window
        .$("#grid-container")
        .dxDataGrid("instance")
        .columnOption(columnDataField, "sortOrder"),
    columnDataField,
  );
}
