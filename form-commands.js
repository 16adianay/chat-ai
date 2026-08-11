const SMART_PASTE_TIMEOUT_MS = 30000;

const CLEAR_PATTERNS = [
  /^(?:clear|reset|remove|unset)\s+(?:the\s+)?(.+?)(?:\s+field)?$/i,
  /^set\s+(.+?)\s+to\s+(?:empty|blank|none|null|nothing|"")$/i,
  /^(?:empty|blank)\s+(?:out\s+)?(?:the\s+)?(.+?)(?:\s+field)?$/i,
];

const CLEAR_ALL_PATTERN =
  /^(?:clear|reset)\s+(?:all\s+)?(?:the\s+)?fields?$|^reset\s+(?:the\s+)?form$/i;

function buildFieldAliasMap(form) {
  const aliases = new Map();
  const items = form.option("items") || [];

  const register = (key, dataField) => {
    if (!key) return;
    aliases.set(key.trim().toLowerCase(), dataField);
  };

  items.forEach((item) => {
    if (!item.dataField) return;
    register(item.dataField, item.dataField);
    register(item.label?.text, item.dataField);
    register(
      item.dataField.replace(/([a-z])([A-Z])/g, "$1 $2"),
      item.dataField,
    );
  });

  return aliases;
}

function resolveFieldName(fragment, aliasMap) {
  const normalized = fragment.trim().toLowerCase().replace(/\s+/g, " ");
  return aliasMap.get(normalized) ?? null;
}

function applyFormFieldClear(form, text) {
  const trimmed = text.trim();

  if (CLEAR_ALL_PATTERN.test(trimmed)) {
    form.clear();
    return { status: "success", message: "Cleared all form fields." };
  }

  for (const pattern of CLEAR_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    const aliasMap = buildFieldAliasMap(form);
    const dataField = resolveFieldName(match[1], aliasMap);

    if (dataField === undefined) return null;

    if (!dataField) {
      return {
        status: "failure",
        message: `I couldn't find a field named "${match[1].trim()}" to clear.`,
      };
    }

    setTimeout(() => {
      form.updateData(dataField, null);
    }, 1000);

    return { status: "success", message: `Cleared ${dataField}.` };
  }

  return null;
}

function applyFormSmartPaste(form, text) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result) => {
      if (settled) return;
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
        message:
          "I couldn't update the form. Please try rephrasing your request.",
      });
    }, SMART_PASTE_TIMEOUT_MS);

    form.on("smartPasted", handleSmartPasted);
    form.smartPaste(text);
  });
}
