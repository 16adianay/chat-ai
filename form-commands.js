function buildFormSystemPrompt() {
  const fieldDescriptions = formFields
    .map((f) => `- "${f.name}": ${f.description}`)
    .join("\n");

  return [
    "You are a form assistant. Translate the user request into a single field update command.",
    "Available fields:",
    fieldDescriptions,
    "",
    "Respond with STRICT JSON only, no code fences, no explanations, in this shape:",
    '{"field": "<one of the available field names, or null if no matching field exists>", "value": "<new value, or null>"}',
    'If the user mentions a field that is NOT in the list above (e.g. "city"), respond with {"field": null, "value": null}.',
    'Do NOT substitute an unrelated field just because a value looks similar (e.g. do not use "State" when the user asks about "City").',
  ].join("\n");
}
