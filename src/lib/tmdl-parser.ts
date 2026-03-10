import JSZip from "jszip";
import type {
  SemanticModel,
  Table,
  Column,
  Measure,
  Partition,
  PartitionSource,
  Relationship,
  Role,
  TablePermission,
  DataSource,
  CalculationGroup,
  CalculationItem,
} from "./types";

export async function parseTmdlZip(file: File): Promise<SemanticModel> {
  const zip = await JSZip.loadAsync(file);
  const files = new Map<string, string>();

  // Extract all .tmdl files
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (!zipEntry.dir && path.endsWith(".tmdl")) {
      const content = await zipEntry.async("string");
      // Normalize path separators and strip leading folder prefix
      const normalizedPath = path.replace(/\\/g, "/");
      files.set(normalizedPath, content);
    }
  }

  // Find the root — sometimes files are nested inside a subfolder
  const rootPrefix = findRootPrefix(files);

  const getFile = (relativePath: string): string | undefined => {
    // Try with and without prefix
    return (
      files.get(rootPrefix + relativePath) ??
      files.get(relativePath) ??
      // Try case-insensitive
      Array.from(files.entries()).find(
        ([k]) => k.toLowerCase() === (rootPrefix + relativePath).toLowerCase()
      )?.[1]
    );
  };

  const getFilesInDir = (dir: string): Map<string, string> => {
    const result = new Map<string, string>();
    const prefix = rootPrefix + dir;
    for (const [path, content] of files) {
      if (path.startsWith(prefix) || path.toLowerCase().startsWith(prefix.toLowerCase())) {
        const fileName = path.slice(prefix.length);
        if (fileName && !fileName.includes("/")) {
          result.set(fileName, content);
        }
      }
    }
    return result;
  };

  // Parse database name
  const databaseContent = getFile("database.tmdl");
  const modelName = parseDatabaseName(databaseContent);

  // Parse tables
  const tableFiles = getFilesInDir("tables/");
  const tables: Table[] = [];
  const calculationGroups: CalculationGroup[] = [];
  for (const [, content] of tableFiles) {
    const result = parseTable(content);
    if (result) {
      tables.push(result.table);
      if (result.calculationGroup) {
        calculationGroups.push(result.calculationGroup);
      }
    }
  }

  // Parse relationships
  const relContent = getFile("relationships.tmdl");
  const relationships = relContent ? parseRelationships(relContent) : [];

  // Parse roles
  const roleFiles = getFilesInDir("roles/");
  const roles: Role[] = [];
  for (const [, content] of roleFiles) {
    const role = parseRole(content);
    if (role) roles.push(role);
  }

  // Parse data sources
  const dsContent = getFile("dataSources.tmdl");
  const dataSources = dsContent ? parseDataSources(dsContent) : [];

  // Parse expressions (shared expressions can also define data sources)
  const exprContent = getFile("expressions.tmdl");
  if (exprContent) {
    const exprSources = parseExpressionSources(exprContent);
    dataSources.push(...exprSources);
  }

  // Parse cultures
  const cultureFiles = getFilesInDir("cultures/");
  const cultures = Array.from(cultureFiles.keys()).map((f) =>
    f.replace(".tmdl", "")
  );

  // Parse perspectives
  const perspFiles = getFilesInDir("perspectives/");
  const perspectives = Array.from(perspFiles.keys()).map((f) =>
    f.replace(".tmdl", "")
  );

  return {
    name: modelName,
    tables,
    relationships,
    roles,
    dataSources,
    cultures,
    perspectives,
    calculationGroups,
  };
}

function findRootPrefix(files: Map<string, string>): string {
  const paths = Array.from(files.keys());
  if (paths.length === 0) return "";

  // Check if files are directly at root (e.g., "database.tmdl")
  if (paths.some((p) => p === "database.tmdl" || p === "model.tmdl")) {
    return "";
  }

  // Find common prefix that ends with /
  // e.g., "MyModel.SemanticModel/definition/"
  const firstPath = paths[0];
  const segments = firstPath.split("/");
  let prefix = "";
  for (let i = 0; i < segments.length - 1; i++) {
    const candidate = segments.slice(0, i + 1).join("/") + "/";
    // Check if this prefix leads to known files
    if (
      paths.some(
        (p) =>
          p.startsWith(candidate + "database.tmdl") ||
          p.startsWith(candidate + "model.tmdl") ||
          p.startsWith(candidate + "tables/")
      )
    ) {
      prefix = candidate;
      break;
    }
  }
  return prefix;
}

function parseDatabaseName(content: string | undefined): string {
  if (!content) return "Unknown Model";
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("database ")) {
      return unquoteName(trimmed.slice("database ".length));
    }
    // Also check compatibilityLevel line for context
  }
  return "Unknown Model";
}

function parseTable(content: string): { table: Table; calculationGroup: CalculationGroup | null } | null {
  const lines = content.split("\n");
  let tableName = "";
  let tableDescription = "";
  const columns: Column[] = [];
  const measures: Measure[] = [];
  const partitions: Partition[] = [];
  let isHidden = false;
  let calcGroup: CalculationGroup | null = null;
  let currentCalcItem: Partial<CalculationItem> | null = null;
  let calcItemExprLines: string[] = [];
  let collectingCalcItemExpr = false;

  let currentObject: "none" | "column" | "measure" | "partition" | "hierarchy" | "annotation" | "calculationGroup" | "other" = "none";
  let currentColumn: Partial<Column> = {};
  let currentMeasure: Partial<Measure> = {};
  let currentPartition: Partial<Partition> = {};
  let expressionLines: string[] = [];
  let collectingExpression = false;
  let descriptionLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      if (collectingExpression) expressionLines.push("");
      continue;
    }

    // Collect descriptions (/// comments)
    if (trimmed.startsWith("///")) {
      descriptionLines.push(trimmed.slice(3).trim());
      continue;
    }

    // Table declaration
    if (trimmed.startsWith("table ") && !line.startsWith("\t") && !line.startsWith("  ")) {
      tableName = unquoteName(trimmed.slice("table ".length));
      tableDescription = descriptionLines.join(" ");
      descriptionLines = [];
      continue;
    }

    // Table-level properties
    if (getIndentLevel(line) === 1) {
      // Finish previous object
      finishCurrentObject();

      if (trimmed === "isHidden") {
        isHidden = true;
        continue;
      }

      if (trimmed.startsWith("column ")) {
        currentObject = "column";
        const nameAndDefault = trimmed.slice("column ".length);
        const name = nameAndDefault.split("=")[0].trim();
        currentColumn = {
          name: unquoteName(name),
          description: descriptionLines.join(" "),
          dataType: "string",
          sourceColumn: "",
          isHidden: false,
          sortByColumn: "",
          dataCategory: "",
        };
        // Check for default expression (calculated column)
        if (nameAndDefault.includes("=")) {
          expressionLines = [nameAndDefault.split("=").slice(1).join("=").trim()];
          collectingExpression = true;
        }
        descriptionLines = [];
        continue;
      }

      if (trimmed.startsWith("measure ")) {
        currentObject = "measure";
        const rest = trimmed.slice("measure ".length);
        const eqIdx = rest.indexOf("=");
        const name = eqIdx >= 0 ? rest.slice(0, eqIdx).trim() : rest.trim();
        currentMeasure = {
          name: unquoteName(name),
          description: descriptionLines.join(" "),
          expression: "",
          displayFolder: "",
          formatString: "",
          isHidden: false,
        };
        if (eqIdx >= 0) {
          const expr = rest.slice(eqIdx + 1).trim();
          if (expr) {
            expressionLines = [expr];
          }
          collectingExpression = true;
        }
        descriptionLines = [];
        continue;
      }

      if (trimmed.startsWith("partition ")) {
        currentObject = "partition";
        const rest = trimmed.slice("partition ".length);
        const eqIdx = rest.indexOf("=");
        const name = eqIdx >= 0 ? rest.slice(0, eqIdx).trim() : rest.trim();
        const sourceType = eqIdx >= 0 ? rest.slice(eqIdx + 1).trim() : "";
        currentPartition = {
          name: unquoteName(name),
          mode: "default",
          source: {
            type: sourceType || "unknown",
            expression: "",
          },
        };
        descriptionLines = [];
        continue;
      }

      if (trimmed.startsWith("calculationGroup")) {
        finishCurrentObject();
        currentObject = "calculationGroup";
        calcGroup = { tableName: "", precedence: 0, calculationItems: [] };
        descriptionLines = [];
        continue;
      }

      if (trimmed.startsWith("hierarchy ") || trimmed.startsWith("annotation ")) {
        currentObject = "other";
        descriptionLines = [];
        continue;
      }

      // Table-level property
      parseProperty(trimmed, {
        isHidden: () => { isHidden = true; },
      });
      descriptionLines = [];
      continue;
    }

    // Level 2+ — properties of the current object
    if (getIndentLevel(line) >= 2 && currentObject !== "none") {
      if (collectingExpression && currentObject === "measure") {
        // Check if this is still part of expression or a property
        if (trimmed.startsWith("formatString:") || trimmed.startsWith("displayFolder:") || trimmed.startsWith("isHidden") || trimmed.startsWith("lineageTag:") || trimmed.startsWith("description:")) {
          collectingExpression = false;
          currentMeasure.expression = expressionLines.filter(l => l !== undefined).join("\n").trim();
          expressionLines = [];
          // Fall through to property parsing
        } else {
          expressionLines.push(trimmed);
          continue;
        }
      }

      if (collectingExpression && currentObject === "partition") {
        if (trimmed.startsWith("source") && trimmed.includes("=")) {
          collectingExpression = true;
          expressionLines = [];
          const afterEq = trimmed.split("=").slice(1).join("=").trim();
          if (afterEq) expressionLines.push(afterEq);
          continue;
        }
      }

      if (currentObject === "column") {
        parseProperty(trimmed, {
          dataType: (v: string) => { currentColumn.dataType = v; },
          datatype: (v: string) => { currentColumn.dataType = v; },
          sourceColumn: (v: string) => { currentColumn.sourceColumn = unquoteName(v); },
          isHidden: () => { currentColumn.isHidden = true; },
          sortByColumn: (v: string) => { currentColumn.sortByColumn = unquoteName(v); },
          dataCategory: (v: string) => { currentColumn.dataCategory = v; },
        });
      } else if (currentObject === "measure") {
        parseProperty(trimmed, {
          formatString: (v: string) => { currentMeasure.formatString = v; },
          displayFolder: (v: string) => { currentMeasure.displayFolder = unquoteName(v); },
          isHidden: () => { currentMeasure.isHidden = true; },
        });
      } else if (currentObject === "calculationGroup") {
        if (trimmed.startsWith("precedence:")) {
          if (calcGroup) calcGroup.precedence = parseInt(trimmed.split(":")[1].trim(), 10) || 0;
        } else if (trimmed.startsWith("calculationItem ")) {
          // Finish previous calc item
          if (currentCalcItem && currentCalcItem.name) {
            if (collectingCalcItemExpr) {
              currentCalcItem.expression = calcItemExprLines.join("\n").trim();
              collectingCalcItemExpr = false;
              calcItemExprLines = [];
            }
            if (calcGroup) calcGroup.calculationItems.push(currentCalcItem as CalculationItem);
          }
          const rest = trimmed.slice("calculationItem ".length);
          const eqIdx = rest.indexOf("=");
          const name = eqIdx >= 0 ? rest.slice(0, eqIdx).trim() : rest.trim();
          const expr = eqIdx >= 0 ? rest.slice(eqIdx + 1).trim() : "";
          currentCalcItem = {
            name: unquoteName(name),
            expression: expr,
            ordinal: 0,
          };
          if (eqIdx >= 0 && expr) {
            calcItemExprLines = [expr];
            collectingCalcItemExpr = true;
          }
        } else if (trimmed.startsWith("ordinal:") && currentCalcItem) {
          if (collectingCalcItemExpr) {
            currentCalcItem.expression = calcItemExprLines.join("\n").trim();
            collectingCalcItemExpr = false;
            calcItemExprLines = [];
          }
          currentCalcItem.ordinal = parseInt(trimmed.split(":")[1].trim(), 10) || 0;
        } else if (collectingCalcItemExpr) {
          calcItemExprLines.push(trimmed);
        }
      } else if (currentObject === "partition") {
        if (trimmed.startsWith("mode:")) {
          const mode = trimmed.split(":")[1].trim().toLowerCase();
          currentPartition.mode = normalizePartitionMode(mode);
        } else if (trimmed.startsWith("source") && trimmed.includes("=")) {
          collectingExpression = true;
          expressionLines = [];
          const afterEq = trimmed.split("=").slice(1).join("=").trim();
          if (afterEq) expressionLines.push(afterEq);
        } else if (collectingExpression) {
          expressionLines.push(trimmed);
        }
        // Parse entityName, schemaName for entity partitions
        if (trimmed.startsWith("entityName:")) {
          if (!currentPartition.source) currentPartition.source = { type: "", expression: "" };
          currentPartition.source.entityName = trimmed.split(":").slice(1).join(":").trim();
        }
        if (trimmed.startsWith("schemaName:")) {
          if (!currentPartition.source) currentPartition.source = { type: "", expression: "" };
          currentPartition.source.schemaName = trimmed.split(":").slice(1).join(":").trim();
        }
      }
      continue;
    }
  }

  // Finish last object
  finishCurrentObject();

  if (!tableName) return null;

  // Set tableName on calc group if found
  if (calcGroup) {
    calcGroup.tableName = tableName;
  }

  // Determine table type
  const type = partitions.some(
    (p) => p.source.type === "calculated" || p.source.type === "calculatedPartitionSource"
  ) || !!calcGroup
    ? "calculated"
    : "entity";

  return {
    table: {
      name: tableName,
      columns,
      measures,
      partitions,
      type,
      isHidden,
      description: tableDescription,
    },
    calculationGroup: calcGroup,
  };

  function finishCurrentObject() {
    if (collectingExpression) {
      if (currentObject === "measure") {
        currentMeasure.expression = expressionLines.join("\n").trim();
      } else if (currentObject === "partition" && currentPartition.source) {
        currentPartition.source.expression = expressionLines.join("\n").trim();
      }
      collectingExpression = false;
      expressionLines = [];
    }

    if (currentObject === "calculationGroup") {
      // Finish last calc item
      if (currentCalcItem && currentCalcItem.name) {
        if (collectingCalcItemExpr) {
          currentCalcItem.expression = calcItemExprLines.join("\n").trim();
          collectingCalcItemExpr = false;
          calcItemExprLines = [];
        }
        if (calcGroup) calcGroup.calculationItems.push(currentCalcItem as CalculationItem);
        currentCalcItem = null;
      }
    }

    if (currentObject === "column" && currentColumn.name) {
      columns.push(currentColumn as Column);
      currentColumn = {};
    } else if (currentObject === "measure" && currentMeasure.name) {
      measures.push(currentMeasure as Measure);
      currentMeasure = {};
    } else if (currentObject === "partition" && currentPartition.name) {
      partitions.push(currentPartition as Partition);
      currentPartition = {};
    }
    currentObject = "none";
  }
}

function parseRelationships(content: string): Relationship[] {
  const relationships: Relationship[] = [];
  const lines = content.split("\n");
  let current: Partial<Relationship> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("///") || trimmed.startsWith("ref ")) continue;

    if (trimmed.startsWith("relationship ")) {
      if (current && current.fromTable) {
        relationships.push(fillRelationship(current));
      }
      current = {
        crossFilteringBehavior: "single",
        isActive: true,
      };
      continue;
    }

    if (current) {
      if (trimmed.startsWith("fromColumn:")) {
        const ref = trimmed.slice("fromColumn:".length).trim();
        const { table, column } = parseColumnRef(ref);
        current.fromTable = table;
        current.fromColumn = column;
      } else if (trimmed.startsWith("toColumn:")) {
        const ref = trimmed.slice("toColumn:".length).trim();
        const { table, column } = parseColumnRef(ref);
        current.toTable = table;
        current.toColumn = column;
      } else if (trimmed.startsWith("crossFilteringBehavior:")) {
        const val = trimmed.split(":")[1].trim().toLowerCase();
        current.crossFilteringBehavior =
          val === "bothdirections" ? "bothDirections" : "single";
      } else if (trimmed.startsWith("isActive:")) {
        current.isActive = trimmed.split(":")[1].trim().toLowerCase() !== "false";
      } else if (trimmed === "isActive") {
        current.isActive = true;
      }
    }
  }

  if (current && current.fromTable) {
    relationships.push(fillRelationship(current));
  }

  return relationships;
}

function parseRole(content: string): Role | null {
  const lines = content.split("\n");
  let roleName = "";
  let description = "";
  let modelPermission = "read";
  const tablePermissions: TablePermission[] = [];
  let currentTablePerm: Partial<TablePermission> | null = null;
  let collectingExpr = false;
  let exprLines: string[] = [];
  let descLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      if (collectingExpr) exprLines.push("");
      continue;
    }

    if (trimmed.startsWith("///")) {
      descLines.push(trimmed.slice(3).trim());
      continue;
    }

    if (trimmed.startsWith("role ") && getIndentLevel(line) === 0) {
      roleName = unquoteName(trimmed.slice("role ".length));
      description = descLines.join(" ");
      descLines = [];
      continue;
    }

    if (trimmed.startsWith("modelPermission:")) {
      modelPermission = trimmed.split(":")[1].trim();
      continue;
    }

    if (trimmed.startsWith("tablePermission ")) {
      // Finish previous
      if (currentTablePerm && currentTablePerm.tableName) {
        if (collectingExpr) {
          currentTablePerm.filterExpression = exprLines.join("\n").trim();
          collectingExpr = false;
          exprLines = [];
        }
        tablePermissions.push(currentTablePerm as TablePermission);
      }

      const rest = trimmed.slice("tablePermission ".length);
      const eqIdx = rest.indexOf("=");
      const tableName = eqIdx >= 0 ? rest.slice(0, eqIdx).trim() : rest.trim();
      const expr = eqIdx >= 0 ? rest.slice(eqIdx + 1).trim() : "";

      currentTablePerm = {
        tableName: unquoteName(tableName),
        filterExpression: expr,
      };

      if (!expr) {
        collectingExpr = true;
        exprLines = [];
      }
      continue;
    }

    if (collectingExpr) {
      exprLines.push(trimmed);
      continue;
    }
  }

  // Finish last
  if (currentTablePerm && currentTablePerm.tableName) {
    if (collectingExpr) {
      currentTablePerm.filterExpression = exprLines.join("\n").trim();
    }
    tablePermissions.push(currentTablePerm as TablePermission);
  }

  if (!roleName) return null;
  return { name: roleName, description, modelPermission, tablePermissions, columnPermissions: [] };
}

function parseDataSources(content: string): DataSource[] {
  const dataSources: DataSource[] = [];
  const lines = content.split("\n");
  let current: Partial<DataSource> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("///")) continue;

    if (trimmed.startsWith("dataSource ")) {
      if (current && current.name) dataSources.push(current as DataSource);
      current = {
        name: unquoteName(trimmed.slice("dataSource ".length)),
        type: "",
        connectionString: "",
      };
      continue;
    }

    if (current) {
      if (trimmed.startsWith("type:")) {
        current.type = trimmed.split(":").slice(1).join(":").trim();
      } else if (trimmed.startsWith("connectionString:")) {
        current.connectionString = trimmed.split(":").slice(1).join(":").trim();
      }
    }
  }

  if (current && current.name) dataSources.push(current as DataSource);
  return dataSources;
}

function parseExpressionSources(content: string): DataSource[] {
  // Shared expressions can define data source connections
  const sources: DataSource[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("expression ")) {
      const rest = trimmed.slice("expression ".length);
      const eqIdx = rest.indexOf("=");
      if (eqIdx >= 0) {
        const name = unquoteName(rest.slice(0, eqIdx).trim());
        const value = rest.slice(eqIdx + 1).trim().replace(/\s*meta\s*\[.*\]/, "").trim().replace(/^"(.*)"$/, "$1");
        if (value && (value.includes("://") || value.includes("."))) {
          sources.push({ name, type: "expression", connectionString: value });
        }
      }
    }
  }
  return sources;
}

// Helper functions

function unquoteName(name: string): string {
  let n = name.trim();
  // Remove single quotes
  if (n.startsWith("'") && n.endsWith("'")) {
    n = n.slice(1, -1).replace(/''/g, "'");
  }
  // Remove double quotes
  if (n.startsWith('"') && n.endsWith('"')) {
    n = n.slice(1, -1).replace(/""/g, '"');
  }
  return n;
}

function parseColumnRef(ref: string): { table: string; column: string } {
  // Format: 'Table Name'.'Column Name' or Table.Column
  const cleaned = ref.trim();
  const parts: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "'" && !inQuote) {
      inQuote = true;
      continue;
    }
    if (ch === "'" && inQuote) {
      if (cleaned[i + 1] === "'") {
        current += "'";
        i++;
        continue;
      }
      inQuote = false;
      continue;
    }
    if (ch === "." && !inQuote) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);

  return {
    table: parts[0] || "",
    column: parts[1] || parts[0] || "",
  };
}

function getIndentLevel(line: string): number {
  let tabs = 0;
  let spaces = 0;
  for (const ch of line) {
    if (ch === "\t") tabs++;
    else if (ch === " ") spaces++;
    else break;
  }
  // TMDL uses tabs by default, but some tools use spaces (typically 4)
  return tabs > 0 ? tabs : Math.floor(spaces / 4);
}

function normalizePartitionMode(mode: string): Partition["mode"] {
  const lower = mode.toLowerCase();
  if (lower === "import") return "import";
  if (lower === "directlake") return "directLake";
  if (lower === "directquery") return "directQuery";
  if (lower === "dual") return "dual";
  return "default";
}

function fillRelationship(partial: Partial<Relationship>): Relationship {
  return {
    fromTable: partial.fromTable || "",
    fromColumn: partial.fromColumn || "",
    toTable: partial.toTable || "",
    toColumn: partial.toColumn || "",
    crossFilteringBehavior: partial.crossFilteringBehavior || "single",
    isActive: partial.isActive ?? true,
  };
}

function parseProperty(trimmed: string, handlers: Record<string, (value: string) => void>) {
  // Boolean shorthand (e.g., "isHidden" alone on a line)
  if (handlers[trimmed]) {
    handlers[trimmed]("");
    return;
  }

  const colonIdx = trimmed.indexOf(":");
  if (colonIdx >= 0) {
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (handlers[key]) {
      handlers[key](value);
    }
  }
}
