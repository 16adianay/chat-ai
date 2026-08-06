class ChatCommandError extends Error {}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);

  try {
    return JSON.parse(match[0]);
  } catch {
    throw new ChatCommandError(
      "❌ I received an unexpected response from the AI. Please rephrase your request and try again.",
    );
  }
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
        onError: reject,
      },
    );
  });
}

function applyFormUpdate(form, update) {
  const fieldDef = formFields.find((f) => f.name === update.field);

  if (!fieldDef) {
    return {
      status: "failure",
      message: `I couldn't find a form field named "${update.field}".`,
    };
  }

  const caption = form.itemOption(update.field)?.label?.text ?? update.field;
  const allowedValues = fieldDef.values;
  const value = allowedValues
    ? allowedValues.find(
        (v) => v.toLowerCase() === String(update.value).toLowerCase(),
      )
    : update.value;

  if (allowedValues && !value) {
    return {
      status: "failure",
      message: `"${update.value}" isn't a valid value for "${caption}". Valid options are: ${allowedValues.join(", ")}.`,
    };
  }

  form.updateData(update.field, value);
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

const FIELD_OR_VALUE_NOT_FOUND_MESSAGE =
  "❌ I couldn't find that field or column, or the value you entered isn't valid. Please check the name and value and try again.";

const MAX_USER_MESSAGE_LENGTH = 2000;

function runCommand(text, { form, gridInstance, aiIntegration }) {
  if (text.length > MAX_USER_MESSAGE_LENGTH) {
    return Promise.reject(
      new ChatCommandError(
        "❌ That message is too long for me to process. Please shorten it and try again.",
      ),
    );
  }

  const columnNames = getGridColumnNames(gridInstance);
  const prompt = `${buildCombinedSystemPrompt(columnNames)}\n\nUser request: "${text}"`;

  return executeAiCommand(prompt, aiIntegration).then((parsed) => {
    const updates = Array.isArray(parsed.updates) ? parsed.updates : [];
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    const formResults = updates.map((update) => applyFormUpdate(form, update));
    const gridResults = applyGridActions(gridInstance, actions, text);

    const succeeded = [...formResults, ...gridResults]
      .filter((r) => r.status === "success")
      .map((r) => r.message);

    if (succeeded.length === 0) {
      throw new ChatCommandError(FIELD_OR_VALUE_NOT_FOUND_MESSAGE);
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
    .catch((error) => {
      const text =
        error instanceof ChatCommandError
          ? error.message
          : "❌ I couldn't reach the AI service. Please check your connection and try again.";

      pushMessage({
        author: { id: "ai", name: "AI Assistant" },
        text,
      });
    });
}

function routeMessage(text, { form, gridInstance, aiIntegration, pushMessage }) {
  return reportAiResult(
    runCommand(text, { form, gridInstance, aiIntegration }),
    pushMessage,
  );
}
