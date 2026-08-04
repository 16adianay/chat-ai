function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("AI response did not contain a JSON object");
  }
  return JSON.parse(match[0]);
}

function executeAiCommand(text, aiIntegration) {
  return new Promise((resolve, reject) => {
    aiIntegration.execute(
      { text },
      {
        onComplete: (finalResponse) => {
          try {
            resolve(extractJson(finalResponse));
          } catch (error) {
            reject(error);
          }
        },
        onError: (error) => reject(error),
      },
    );
  });
}

function applyFormUpdate(form, update) {
  const fieldDef = formFields.find((f) => f.name === update.field);

  if (!fieldDef) {
    return { status: "failure", message: `Unknown field: ${update.field}` };
  }

  const allowedValues = fieldDef.values;
  const value = allowedValues
    ? allowedValues.find(
        (v) => v.toLowerCase() === String(update.value).toLowerCase(),
      )
    : update.value;

  if (allowedValues && !value) {
    return {
      status: "failure",
      message: `Invalid value "${update.value}" for field "${update.field}"`,
    };
  }

  form.updateData(update.field, value);
  const caption = form.itemOption(update.field)?.label?.text ?? update.field;
  return { status: "success", message: `Updated "${caption}".` };
}

function buildCombinedResponseSchema() {
  const { actions } = buildGridResponseSchema().properties;

  return {
    type: "object",
    properties: {
      updates: {
        type: "array",
        description: "Form field updates to apply, in order.",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            value: { type: ["string", "number", "boolean"] },
          },
          required: ["field", "value"],
        },
      },
      actions,
    },
    required: ["updates", "actions"],
  };
}

function buildCombinedSystemPrompt(columnNames) {
  return [
    "You control two DevExtreme widgets on this page: an employee Form and a task DataGrid.",
    "Figure out what the user's request is about - it may only update form fields, only affect " +
      "the grid, or do both in the same message - and translate each part into the matching " +
      "commands described below.",
    "",
    buildFormPromptSection(),
    "",
    buildGridPromptSection(columnNames),
    "",
    "Respond with STRICT JSON only, no code fences, no explanations, matching this schema:",
    JSON.stringify(buildCombinedResponseSchema()),
    "",
    'If the request has nothing to do with the form, respond with "updates": [].',
    'If the request has nothing to do with the grid, respond with "actions": [].',
  ].join("\n");
}

function runCommand(text, { form, gridInstance, aiIntegration }) {
  const columnNames = getGridColumnNames(gridInstance);
  const prompt = `${buildCombinedSystemPrompt(columnNames)}\n\nUser request: "${text}"`;

  return executeAiCommand(prompt, aiIntegration).then((parsed) => {
    const updates = Array.isArray(parsed.updates) ? parsed.updates : [];
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    const formResults = updates.map((update) => applyFormUpdate(form, update));
    const gridResults = applyGridActions(gridInstance, actions);

    const succeeded = [...formResults, ...gridResults]
      .filter((r) => r.status === "success")
      .map((r) => r.message);

    if (succeeded.length === 0) {
      throw new Error("AI response contained no actionable updates");
    }

    return succeeded.join(" ");
  });
}

function reportAiResult(promise, pushMessage) {
  return promise
    .then((message) => {
      pushMessage({
        author: { id: "ai", name: "AI Assistant" },
        text: `✅ Done. ${message}`,
      });
    })
    .catch(() => {
      pushMessage({
        author: { id: "ai", name: "AI Assistant" },
        text: "❌ An unexpected error occurred. Please try again.",
      });
    });
}

function routeMessage(text, { form, gridInstance, aiIntegration, pushMessage }) {
  return reportAiResult(
    runCommand(text, { form, gridInstance, aiIntegration }),
    pushMessage,
  );
}
