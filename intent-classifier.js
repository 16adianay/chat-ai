const GRID_ACTION_WORDS = [
  "filter",
  "sort",
  "group",
  "show",
  "hide",
  "column",
  "asc",
  "desc",
  "ascending",
  "descending",
  "page",
];

const FORM_ACTION_WORDS = ["change", "update", "set", "edit"];

function getGridKeywords(gridInstanceRef) {
  const columnWords = gridInstanceRef
    .getVisibleColumns()
    .flatMap((col) => [col.dataField, col.caption])
    .filter(Boolean)
    .map((w) => w.toLowerCase());

  return [...GRID_ACTION_WORDS, ...columnWords];
}

function getFormKeywords(formInstanceRef) {
  const items = formInstanceRef.option("items") ?? [];

  const fieldWords = items
    .flatMap((item) => [item.dataField, item.label?.text])
    .filter(Boolean)
    .map((w) => w.toLowerCase());

  return [...FORM_ACTION_WORDS, ...fieldWords];
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Counts how many keywords appear in the text as whole words, matching the
// keyword as a PREFIX followed by any word characters (\w*). This is a
// lightweight stand-in for proper stemming: it matches not just exact
// keywords and simple plurals ("filter"/"filters") but also common word
// forms derived from the same root ("sort"/"sorting"/"sorted",
// "update"/"updated", "filter"/"filtering"), without pulling in a stemming
// library. Word boundaries on both ends still prevent false matches inside
// unrelated words (e.g. "set" no longer matches inside "upset").
function countKeywordMatches(text, keywords) {
  return keywords.reduce((count, keyword) => {
    const pattern = new RegExp(`\\b${escapeForRegExp(keyword)}\\w*\\b`, "i");
    return count + (pattern.test(text) ? 1 : 0);
  }, 0);
}

function classifyIntent(text, gridInstanceRef, formInstanceRef) {
  const gridKeywords = getGridKeywords(gridInstanceRef);
  const formKeywords = getFormKeywords(formInstanceRef);

  const gridScore = countKeywordMatches(text, gridKeywords);
  const formScore = countKeywordMatches(text, formKeywords);

  const intents = [];
  if (formScore > 0) intents.push("form");
  if (gridScore > 0) intents.push("grid");

  return intents.length > 0 ? intents : ["form"];
}
