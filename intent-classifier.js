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

function classifyIntent(text, gridInstanceRef, formInstanceRef) {
  const lower = text.toLowerCase();

  const gridKeywords = getGridKeywords(gridInstanceRef);
  const formKeywords = getFormKeywords(formInstanceRef);

  const gridScore = gridKeywords.reduce(
    (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
    0,
  );
  const formScore = formKeywords.reduce(
    (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
    0,
  );

  // Fallback: if no keyword matched, assume the message is about the form
  if (gridScore === 0 && formScore === 0) {
    return "form";
  }

  return gridScore >= formScore ? "grid" : "form";
}
