const SMART_PASTE_TIMEOUT_MS = 30000;

function applyFormSmartPaste(form, text) {
  // Always try Smart Paste - DevExtreme's own aiIntegration decides whether the
  // text is relevant to the form, and smartPasted already reports 0 populated
  // fields as a failure below. A local keyword-based gate here was unreliable
  // (common words like "update"/"set"/"name" match almost any message) and
  // caused both false positives (extra AI calls for grid-only messages) and
  // false negatives (form-relevant text with no matching keyword never even
  // reaching Smart Paste), so it has been removed in favor of trusting the
  // Form's own classification.
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      form.off("smartPasted", handleSmartPasted);
      resolve(result);
    };

    const handleSmartPasted = (e) => {
      const fieldCount = Object.keys(e.aiResult ?? {}).length;
      finish(
        fieldCount > 0
          ? { status: "success", message: "Updated the form." }
          : {
              status: "failure",
              message: "I couldn't find any form fields matching the request.",
            },
      );
    };

    const timeoutId = setTimeout(() => {
      finish({
        status: "failure",
        message: "I couldn't update the form. Please try rephrasing your request.",
      });
    }, SMART_PASTE_TIMEOUT_MS);

    form.on("smartPasted", handleSmartPasted);
    form.smartPaste(text);
  });
}
