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

// Counts how many keywords appear in the text as whole words, so short
// keywords (e.g. "state", "set") don't falsely match inside unrelated
// words (e.g. "estate", "upset").
function countKeywordMatches(text, keywords) {
  return keywords.reduce((count, keyword) => {
    const pattern = new RegExp(`\\b${escapeForRegExp(keyword)}\\b`, "i");
    return count + (pattern.test(text) ? 1 : 0);
  }, 0);
}

function classifyIntent(text, gridInstanceRef, formInstanceRef) {
  const gridKeywords = getGridKeywords(gridInstanceRef);
  const formKeywords = getFormKeywords(formInstanceRef);

  const gridScore = countKeywordMatches(text, gridKeywords);
  const formScore = countKeywordMatches(text, formKeywords);

  // Fallback: if no keyword matched, assume the message is about the form
  if (gridScore === 0 && formScore === 0) {
    return "form";
  }

  return gridScore >= formScore ? "grid" : "form";
}
