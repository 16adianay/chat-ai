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

function routeToForm(text, form, aiIntegration, pushMessage) {
  return reportAiResult(
    new Promise((resolve, reject) => {
      aiIntegration.execute(
        {
          text: `${buildFormSystemPrompt()}\n\nUser request: "${text}"`,
        },
        {
          onComplete: (finalResponse) => {
            try {
              const parsed = extractJson(finalResponse);

              if (!parsed.field) {
                throw new Error();
              }

              const fieldDef = formFields.find((f) => f.name === parsed.field);
              const allowedValues = fieldDef?.values;
              const value = allowedValues
                ? allowedValues.find(
                    (v) =>
                      v.toLowerCase() === String(parsed.value).toLowerCase(),
                  )
                : parsed.value;

              if (allowedValues && !value) {
                throw new Error();
              }

              form.updateData(parsed.field, value);
              resolve(`Updated "${parsed.field}".`);
            } catch (error) {
              reject(error);
            }
          },
          onError: (error) => reject(error),
        },
      );
    }),
    pushMessage,
  );
}

function routeToGrid(text, gridInstance, aiIntegration, pushMessage) {
  return reportAiResult(
    new Promise((resolve, reject) => {
      aiIntegration.execute(
        {
          text: `${buildGridSystemPrompt(gridColumnNames)}\n\nUser request: "${text}"`,
        },
        {
          onComplete: (finalResponse) => {
            try {
              const parsed = extractJson(finalResponse);
              const actions = Array.isArray(parsed.actions)
                ? parsed.actions
                : [];

              if (actions.length === 0) {
                throw new Error();
              }

              const results = applyGridActions(gridInstance, actions);
              const hasFailure = results.some((r) => r.status === "failure");

              if (hasFailure) {
                throw new Error();
              }

              resolve(results.map((r) => r.message).join(" "));
            } catch (error) {
              reject(error);
            }
          },
          onError: (error) => reject(error),
        },
      );
    }),
    pushMessage,
  );
}
