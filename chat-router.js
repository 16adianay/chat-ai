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
  return { status: "success", message: `Updated "${update.field}".` };
}

function runFormCommand(text, form, aiIntegration) {
  const prompt = `${buildFormSystemPrompt()}\n\nUser request: "${text}"`;

  return executeAiCommand(prompt, aiIntegration).then((parsed) => {
    const updates = Array.isArray(parsed.updates) ? parsed.updates : [];

    if (updates.length === 0) {
      throw new Error("AI response contained no field updates");
    }

    const results = updates.map((update) => applyFormUpdate(form, update));
    const succeeded = results.filter((r) => r.status === "success");

    if (succeeded.length === 0) {
      throw new Error(results[0].message);
    }

    return succeeded.map((r) => r.message).join(" ");
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

  const text =
    succeeded.length > 0
      ? `✅ Done. ${succeeded.join(" ")}`
      : "❌ An unexpected error occurred. Please try again.";

  pushMessage({
    author: { id: "ai", name: "AI Assistant" },
    text,
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
