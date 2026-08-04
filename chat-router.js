function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error();
  }
  return JSON.parse(match[0]);
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

// Shared plumbing for both routers: sends the prompt to the AI integration
// and resolves with the parsed JSON response (or rejects on any failure).
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

function routeToForm(text, form, aiIntegration, pushMessage) {
  const prompt = `${buildFormSystemPrompt()}\n\nUser request: "${text}"`;

  const promise = executeAiCommand(prompt, aiIntegration).then((parsed) => {
    if (!parsed.field) {
      throw new Error();
    }

    const fieldDef = formFields.find((f) => f.name === parsed.field);
    const allowedValues = fieldDef?.values;
    const value = allowedValues
      ? allowedValues.find(
          (v) => v.toLowerCase() === String(parsed.value).toLowerCase(),
        )
      : parsed.value;

    if (allowedValues && !value) {
      throw new Error();
    }

    form.updateData(parsed.field, value);
    return `Updated "${parsed.field}".`;
  });

  return reportAiResult(promise, pushMessage);
}

function routeToGrid(text, gridInstance, aiIntegration, pushMessage) {
  const prompt = `${buildGridSystemPrompt(gridColumnNames)}\n\nUser request: "${text}"`;

  const promise = executeAiCommand(prompt, aiIntegration).then((parsed) => {
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

  return reportAiResult(promise, pushMessage);
}
