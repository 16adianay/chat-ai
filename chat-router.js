function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error();
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
      const caption = form.itemOption(update.field)?.label?.text ?? update.field;
      return `Updated "${caption}".`;
    });

    return summaries.join(" ");
  });
}

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
