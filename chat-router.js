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

// Resolves a single AI-returned update into { field, value }, or throws if
// the field is unknown or the value isn't one of the field's allowed values.
// Does NOT apply the update - see runFormCommand for the two-phase flow.
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

// Resolves with a human-readable summary of the form update(s), or rejects if
// the AI response doesn't contain any valid, known field/value updates.
//
// Validation happens in two phases so a single invalid update can't leave the
// form partially changed:
//   1. resolve & validate every update first (no side effects yet)
//   2. only once all of them are known-good, apply them all via form.updateData()
function runFormCommand(text, form, aiIntegration) {
  const prompt = `${buildFormSystemPrompt()}\n\nUser request: "${text}"`;

  return executeAiCommand(prompt, aiIntegration).then((parsed) => {
    const updates = Array.isArray(parsed.updates) ? parsed.updates : [];

    if (updates.length === 0) {
      throw new Error("AI response contained no field updates");
    }

    // Phase 1: validate all updates up front (throws on the first invalid one).
    const resolvedUpdates = updates.map(resolveFormUpdate);

    // Phase 2: only apply once every update is known to be valid.
    const summaries = resolvedUpdates.map(({ field, value }) => {
      form.updateData(field, value);
      return `Updated "${field}".`;
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

// Reports the outcome of one or more command promises as a single chat
// message, handling partial success/failure instead of collapsing everything
// into one generic error as soon as any single intent fails:
//   - all succeeded -> one "✅ Done. ..." message with every summary joined.
//   - all failed    -> one generic "❌" error message.
//   - mixed         -> both a "✅ Done. ..." line for what succeeded and a
//                      "⚠️" line noting that something else couldn't be done.
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

// Routes a single user message to one or more command handlers (form and/or
// grid, as decided by classifyIntent) and reports a combined result. Uses
// Promise.allSettled so that if one intent fails, the outcome of the other
// intent is still reported instead of being swallowed by a generic error.
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
