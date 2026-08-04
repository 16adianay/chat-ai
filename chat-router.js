function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error();
  }
  return JSON.parse(match[0]);
}

// Shared plumbing: sends the prompt to the AI integration and resolves with
// the parsed JSON response (or rejects on any failure).
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

// Resolves with a human-readable summary of the form update(s), or rejects if
// the AI response doesn't contain any valid, known field/value updates.
function runFormCommand(text, form, aiIntegration) {
  const prompt = `${buildFormSystemPrompt()}\n\nUser request: "${text}"`;

  return executeAiCommand(prompt, aiIntegration).then((parsed) => {
    const updates = Array.isArray(parsed.updates) ? parsed.updates : [];

    if (updates.length === 0) {
      throw new Error();
    }

    const summaries = updates.map((update) => {
      if (!update.field) {
        throw new Error();
      }

      const fieldDef = formFields.find((f) => f.name === update.field);
      const allowedValues = fieldDef?.values;
      const value = allowedValues
        ? allowedValues.find(
            (v) => v.toLowerCase() === String(update.value).toLowerCase(),
          )
        : update.value;

      if (allowedValues && !value) {
        throw new Error();
      }

      form.updateData(update.field, value);
      return `Updated "${update.field}".`;
    });

    return summaries.join(" ");
  });
}

// Resolves with a human-readable summary of the applied grid actions, or
// rejects if the AI returned no actions or any action failed to apply.
function runGridCommand(text, gridInstance, aiIntegration) {
  const columnNames = getGridColumnNames(gridInstance);
  const prompt = `${buildGridSystemPrompt(columnNames)}\n\nUser request: "${text}"`;

  return executeAiCommand(prompt, aiIntegration).then((parsed) => {
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    if (actions.length === 0) {
      throw new Error();
    }

    const results = applyGridActions(gridInstance, actions);
    const hasFailure = results.some((r) => r.status === "failure");

    if (hasFailure) {
      throw new Error();
    }

    return results.map((r) => r.message).join(" ");
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

// Routes a single user message to one or more command handlers (form and/or
// grid, as decided by classifyIntent) and reports a single combined result:
// - success: one "✅ Done." message with both action summaries joined together.
// - failure: one generic "❌" message, if ANY of the actions failed.
function routeMessage(text, { intents, form, gridInstance, aiIntegration, pushMessage }) {
  const commandPromises = intents.map((intent) =>
    intent === "form"
      ? runFormCommand(text, form, aiIntegration)
      : runGridCommand(text, gridInstance, aiIntegration),
  );

  const combined = Promise.all(commandPromises).then((messages) =>
    messages.join(" "),
  );

  return reportAiResult(combined, pushMessage);
}
