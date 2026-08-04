function buildFormPromptSection() {
  const fieldDescriptions = formFields
    .map((f) => `- "${f.name}": ${f.description}`)
    .join("\n");

  return [
    "FORM: translate any part of the request that updates the employee form into one or more field update commands (the \"updates\" array).",
    "The user may ask to update a single field, or paste a block of text that mentions several " +
      'fields at once (e.g. separate lines like "Name: John Smith" and "Birth Date: 10/15/2024") - ' +
      "in that case, return one update per field mentioned.",
    "Available form fields:",
    fieldDescriptions,
    'If the user mentions a field that is NOT in the list above (e.g. "city"), omit it from "updates".',
    'Do NOT substitute an unrelated field just because a value looks similar (e.g. do not use "State" when the user asks about "City").',
  ].join("\n");
}
