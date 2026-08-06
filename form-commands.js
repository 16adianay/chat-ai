const SMART_PASTE_TIMEOUT_MS = 30000;

const FORM_RELATED_KEYWORDS = [
  "name",
  "person",
  "prefix",
  "title",
  "position",
  "job",
  "role",
  "state",
  "birth",
  "born",
  "dob",
  "set",
  "update",
  "change",
  "rename",
  "edit",
  "fill",
  "paste",
];

function isFormRelatedText(text) {
  const normalized = text.toLowerCase();
  const knownValues = [...titles, ...positions, ...states];

  return (
    FORM_RELATED_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    knownValues.some((value) => normalized.includes(value.toLowerCase()))
  );
}

function applyFormSmartPaste(form, text) {
  if (!isFormRelatedText(text)) {
    return Promise.resolve({
      status: "failure",
      message: "I couldn't find any form fields matching the request.",
    });
  }

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
