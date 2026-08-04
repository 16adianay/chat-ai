function buildFormSystemPrompt() {
  const fieldDescriptions = formFields
    .map((f) => `- "${f.name}": ${f.description}`)
    .join("\n");

  return [
    "You are a form assistant. Translate the user request into one or more field update commands.",
    "The user may ask to update a single field, or paste a block of text that mentions several " +
      'fields at once (e.g. separate lines like "Name: John Smith" and "Birth Date: 10/15/2024") - ' +
      "in that case, return one update per field mentioned.",
    "Available fields:",
    fieldDescriptions,
    "",
    "Respond with STRICT JSON only, no code fences, no explanations, in this shape:",
    '{"updates": [{"field": "<one of the available field names>", "value": "<new value>"}]}',
    'If the user mentions a field that is NOT in the list above (e.g. "city"), omit it from "updates".',
    'Do NOT substitute an unrelated field just because a value looks similar (e.g. do not use "State" when the user asks about "City").',
    'If no fields can be mapped, respond with {"updates": []}.',
  ].join("\n");
}
