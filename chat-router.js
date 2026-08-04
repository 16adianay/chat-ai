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

function resolveFormUpdate(update) {
  if (!update.field) {
    throw new Error(`Update is missing "field": ${JSON.stringify(update)}`);
  }

  const fieldDef = formFields.find((f) => f.name === update.field);
  const allowedValues = fieldDef?.values;
  const value = allowedValues
    ? allowedValues.find(
        (v) => v.toLowerCase() === String(update.value).toLowerCase(),
      )
    : update.value;

  if (allowedValues && !value) {
    throw new Error(`Invalid value "${update.value}" for field "${update.field}"`);
  }

  return { field: update.field, value };
}

function runFormCommand(text, form, aiIntegration) {
  const prompt = `${buildFormSystemPrompt()}\n\nUser request: "${text}"`;

  return executeAiCommand(prompt, aiIntegration).then((parsed) => {
    const updates = Array.isArray(parsed.updates) ? parsed.updates : [];

    if (updates.length === 0) {
      throw new Error("AI response contained no field updates");
    }

    const resolvedUpdates = updates.map(resolveFormUpdate);

    const summaries = resolvedUpdates.map(({ field, value }) => {
      form.updateData(field, value);
      return `Updated "${field}".`;
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
      throw new Error("AI response contained no grid actions");
    }

    const results = applyGridActions(gridInstance, actions);
    const failed = results.find((r) => r.status === "failure");

    if (failed) {
      throw new Error(failed.message);
    }

    return results.map((r) => r.message).join(" ");
  });
}

function reportAiResults(results, pushMessage) {
  const succeeded = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  const failed = results.filter((r) => r.status === "rejected");

  const lines = [];

  if (succeeded.length > 0) {
    lines.push(`✅ Done. ${succeeded.join(" ")}`);
  }

  if (failed.length > 0) {
    lines.push(
      succeeded.length > 0
        ? "⚠️ Some of that couldn't be completed. Please try again."
        : "❌ An unexpected error occurred. Please try again.",
    );
  }

  pushMessage({
    author: { id: "ai", name: "AI Assistant" },
    text: lines.join("\n"),
  });
}

function routeMessage(text, { intents, form, gridInstance, aiIntegration, pushMessage }) {
  const commandPromises = intents.map((intent) =>
    intent === "form"
      ? runFormCommand(text, form, aiIntegration)
      : runGridCommand(text, gridInstance, aiIntegration),
  );

  return Promise.allSettled(commandPromises).then((results) =>
    reportAiResults(results, pushMessage),
  );
}
