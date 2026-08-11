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

function buildGridSystemPrompt(columnNames) {
  return [
    "You control a task DataGrid on this page.",
    "This page ALSO has a separate employee/customer profile form (fields like name, title/prefix, " +
      "position, state, birth date) that is handled elsewhere - it is NOT part of this grid.",
    "Figure out what the user's request is about and translate ONLY the part that is clearly about " +
      "the task grid into the matching commands described below.",
    'Do NOT create a grid action just because a value could technically fit a text column (e.g. ' +
      '"Subject"). If the request is about the profile form (e.g. mentions a person\'s name, title, ' +
      "job position, state, or birth date), leave that part out of \"actions\" entirely - even if no " +
      "other part of the request is grid-related.",
    "",
    buildGridPromptSection(columnNames),
    "",
    "Respond with STRICT JSON only, no code fences, no explanations, matching this schema:",
    JSON.stringify(buildGridResponseSchema()),
    "",
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
  const prompt = `${buildGridSystemPrompt(columnNames)}\n\nUser request: "${text}"`;

  const gridResultsPromise = executeAiCommand(prompt, aiIntegration)
    .then((parsed) => {
      const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
      return { results: applyGridActions(gridInstance, actions, text), error: null };
    })
    .catch((error) => ({ results: [], error }));

  const formResultsPromise = (() => {
    const clearResult = applyFormFieldClear(form, text);
    if (clearResult) {
      return Promise.resolve([clearResult]);
    }
    return applyFormSmartPaste(form, text).then((result) => [result]);
  })();

  return Promise.all([formResultsPromise, gridResultsPromise]).then(
    ([formResults, { results: gridResults, error: gridError }]) => {
      const succeeded = [...formResults, ...gridResults]
        .filter((r) => r.status === "success")
        .map((r) => r.message);

      if (succeeded.length === 0) {
        throw gridError ?? new ChatCommandError(FIELD_OR_VALUE_NOT_FOUND_MESSAGE);
      }

      if (gridError) {
        console.warn("Grid AI request failed, but form succeeded:", gridError);
      }

      return succeeded.join(" ");
    },
  );
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
