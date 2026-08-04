const gridCommands = {
  filterValue: {
    description:
      "Apply a filter to a single column. Pass column (dataField), operator, and value. " +
      'Supported operators: "=", "<>", "<", "<=", ">", ">=", "contains", "notcontains", "startswith", "endswith". ' +
      'Date values must be in "YYYY-MM-DDTHH:mm:ss" format (e.g. "2024-05-10T00:00:00"). ' +
      'The "Completion" column is a boolean (task completed or not): use operator "=" with value true for ' +
      "completed tasks, or value false for tasks that are not completed.",
    schema: {
      type: "object",
      properties: {
        column: { type: "string" },
        operator: {
          type: "string",
          enum: [
            "=",
            "<>",
            "<",
            "<=",
            ">",
            ">=",
            "contains",
            "notcontains",
            "startswith",
            "endswith",
          ],
        },
        value: { type: ["string", "number", "boolean"] },
      },
      required: ["column", "operator", "value"],
    },
    execute(grid, args) {
      const column = grid.columnOption(args.column);
      if (!column) {
        return {
          status: "failure",
          message: `Unknown column: ${args.column}`,
        };
      }

      let { value } = args;

      if (args.column === "Completion" && typeof value !== "boolean") {
        const normalized = String(value).trim().toLowerCase();
        value =
          value === 100 ||
          ["true", "completed", "yes", "100"].includes(normalized);
      }

      if (
        (column.dataType === "date" || column.dataType === "datetime") &&
        typeof value === "string"
      ) {
        const parsedDate = new Date(value);
        if (!Number.isNaN(parsedDate.getTime())) {
          value = parsedDate;
        }
      }

      try {
        grid.option("filterValue", [args.column, args.operator, value]);
        return {
          status: "success",
          message: `Filtered by "${column.caption ?? args.column}".`,
        };
      } catch {
        return { status: "failure", message: "Could not apply filter." };
      }
    },
  },

  clearFilter: {
    description: "Clear all filters on the grid.",
    schema: { type: "object", properties: {} },
    execute(grid) {
      try {
        grid.clearFilter();
        return { status: "success", message: "Filter cleared." };
      } catch {
        return { status: "failure", message: "Could not clear filter." };
      }
    },
  },

  sorting: {
    description:
      'Sort a column ascending or descending. Pass sortOrder "none" to remove sorting from this column only.',
    schema: {
      type: "object",
      properties: {
        column: { type: "string" },
        sortOrder: { type: "string", enum: ["asc", "desc", "none"] },
      },
      required: ["column", "sortOrder"],
    },
    execute(grid, args) {
      const column = grid.columnOption(args.column);
      if (!column) {
        return {
          status: "failure",
          message: `Unknown column: ${args.column}`,
        };
      }

      try {
        grid.columnOption(
          args.column,
          "sortOrder",
          args.sortOrder === "none" ? undefined : args.sortOrder,
        );

        const caption = column.caption ?? args.column;
        const message =
          args.sortOrder === "none"
            ? `Cleared sorting on "${caption}".`
            : `Sorted by "${caption}" (${args.sortOrder === "asc" ? "ascending" : "descending"}).`;

        return { status: "success", message };
      } catch {
        return { status: "failure", message: "Could not apply sorting." };
      }
    },
  },

  clearSorting: {
    description: "Remove sorting from all columns.",
    schema: { type: "object", properties: {} },
    execute(grid) {
      try {
        grid.clearSorting();
        return { status: "success", message: "Sorting cleared." };
      } catch {
        return { status: "failure", message: "Could not clear sorting." };
      }
    },
  },

  columnsVisibility: {
    description: "Show or hide a column.",
    schema: {
      type: "object",
      properties: {
        column: { type: "string" },
        visible: { type: "boolean" },
      },
      required: ["column", "visible"],
    },
    execute(grid, args) {
      const column = grid.columnOption(args.column);
      if (!column) {
        return {
          status: "failure",
          message: `Unknown column: ${args.column}`,
        };
      }

      try {
        grid.columnOption(args.column, "visible", args.visible);
        const caption = column.caption ?? args.column;
        return {
          status: "success",
          message: args.visible
            ? `Showed column "${caption}".`
            : `Hid column "${caption}".`,
        };
      } catch {
        return {
          status: "failure",
          message: "Could not change column visibility.",
        };
      }
    },
  },
};

function buildGridResponseSchema() {
  const branches = Object.entries(gridCommands).map(([name, cmd]) => ({
    type: "object",
    properties: {
      name: { type: "string", enum: [name] },
      args: cmd.schema,
    },
    required: ["name", "args"],
  }));

  return {
    type: "object",
    properties: {
      actions: {
        type: "array",
        description: "List of grid commands to execute, in order.",
        items: { anyOf: branches },
      },
    },
    required: ["actions"],
  };
}

function buildGridSystemPrompt(columnNames) {
  const commandDescriptions = Object.entries(gridCommands)
    .map(([name, cmd]) => `- "${name}": ${cmd.description}`)
    .join("\n");

  return [
    "You are a data grid assistant. Translate the user request into one or more grid commands.",
    `Available columns (dataField): ${columnNames.join(", ")}.`,
    'The "Completion" column is a boolean: true means the task is completed, false means it is not. ' +
      'To filter for "completed" tasks, use {"column": "Completion", "operator": "=", "value": true}. ' +
      'To filter for "not completed" tasks, use {"column": "Completion", "operator": "=", "value": false}.',
    "Available commands:",
    commandDescriptions,
    "",
    "Respond with STRICT JSON only, no code fences, no explanations, matching this schema:",
    JSON.stringify(buildGridResponseSchema()),
    "",
    'If the request cannot be mapped to any command, respond with {"actions":[]}.',
  ].join("\n");
}

function getGridColumnNames(gridInstance) {
  return gridInstance
    .getVisibleColumns()
    .map((col) => col.dataField)
    .filter(Boolean);
}

function applyGridActions(grid, actions) {
  return actions.map((action) => {
    const command = gridCommands[action.name];

    if (!command) {
      return {
        status: "failure",
        message: `Unknown command: ${action.name}`,
      };
    }

    return command.execute(grid, action.args ?? {});
  });
}
