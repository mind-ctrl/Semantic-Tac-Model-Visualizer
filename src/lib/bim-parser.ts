import type {
  SemanticModel,
  Table,
  Column,
  Measure,
  Partition,
  Relationship,
  Role,
  TablePermission,
  ColumnPermission,
  DataSource,
  CalculationGroup,
  CalculationItem,
} from "./types";

/**
 * Parse a .bim (model.bim) JSON file into a SemanticModel.
 * The .bim format is TMSL — a single JSON file containing the entire model.
 */
export function parseBimJson(json: string): SemanticModel {
  const root = JSON.parse(json);

  // The model can be at root level or under root.model
  const model = root.model || root;
  const dbName = root.name || model.name || "Unknown Model";

  const tables: Table[] = (model.tables || []).map(parseBimTable);
  const relationships: Relationship[] = (model.relationships || []).map(parseBimRelationship);
  const roles: Role[] = (model.roles || []).map(parseBimRole);
  const dataSources: DataSource[] = (model.dataSources || []).map(parseBimDataSource);

  const cultures = (model.cultures || []).map((c: { name?: string }) => c.name || "");
  const perspectives = (model.perspectives || []).map((p: { name?: string }) => p.name || "");

  // Parse calculation groups from tables that have them
  const calculationGroups: CalculationGroup[] = (model.tables || [])
    .filter((t: BimTable) => t.calculationGroup)
    .map((t: BimTable) => parseBimCalculationGroup(t.name || "", t.calculationGroup));

  return {
    name: dbName,
    tables,
    relationships,
    roles,
    dataSources,
    cultures: cultures.filter(Boolean),
    perspectives: perspectives.filter(Boolean),
    calculationGroups,
  };
}

interface BimColumn {
  name?: string;
  dataType?: string;
  sourceColumn?: string;
  isHidden?: boolean;
  description?: string;
  sortByColumn?: string;
  dataCategory?: string;
  type?: string;
}

interface BimMeasure {
  name?: string;
  expression?: string | string[];
  displayFolder?: string;
  description?: string;
  formatString?: string;
  isHidden?: boolean;
}

interface BimPartition {
  name?: string;
  mode?: string;
  source?: {
    type?: string;
    expression?: string | string[];
    entityName?: string;
    schemaName?: string;
    url?: string;
  };
}

interface BimTable {
  name?: string;
  columns?: BimColumn[];
  measures?: BimMeasure[];
  partitions?: BimPartition[];
  isHidden?: boolean;
  description?: string;
  calculationGroup?: unknown;
}

function parseBimTable(t: BimTable): Table {
  const columns: Column[] = (t.columns || [])
    .filter((c: BimColumn) => c.type !== "rowNumber") // Skip internal row number columns
    .map((c: BimColumn) => ({
      name: c.name || "",
      dataType: c.dataType || "string",
      sourceColumn: c.sourceColumn || "",
      isHidden: c.isHidden || false,
      description: c.description || "",
      sortByColumn: c.sortByColumn || "",
      dataCategory: c.dataCategory || "",
    }));

  const measures: Measure[] = (t.measures || []).map((m: BimMeasure) => ({
    name: m.name || "",
    expression: Array.isArray(m.expression) ? m.expression.join("\n") : (m.expression || ""),
    displayFolder: m.displayFolder || "",
    description: m.description || "",
    formatString: m.formatString || "",
    isHidden: m.isHidden || false,
  }));

  const partitions: Partition[] = (t.partitions || []).map((p: BimPartition) => ({
    name: p.name || "",
    mode: normalizeMode(p.mode),
    source: {
      type: p.source?.type || "unknown",
      expression: Array.isArray(p.source?.expression) ? p.source.expression.join("\n") : (p.source?.expression || ""),
      entityName: p.source?.entityName,
      schemaName: p.source?.schemaName,
      url: p.source?.url,
    },
  }));

  // Determine type
  const isCalculated = partitions.some(
    (p) => p.source.type === "calculated" || p.source.type === "calculatedPartitionSource"
  ) || !!t.calculationGroup;

  return {
    name: t.name || "",
    columns,
    measures,
    partitions,
    type: isCalculated ? "calculated" : "entity",
    isHidden: t.isHidden || false,
    description: t.description || "",
  };
}

interface BimRelationship {
  fromTable?: string;
  fromColumn?: string;
  toTable?: string;
  toColumn?: string;
  crossFilteringBehavior?: string;
  isActive?: boolean;
}

function parseBimRelationship(r: BimRelationship): Relationship {
  return {
    fromTable: r.fromTable || "",
    fromColumn: r.fromColumn || "",
    toTable: r.toTable || "",
    toColumn: r.toColumn || "",
    crossFilteringBehavior:
      r.crossFilteringBehavior?.toLowerCase() === "bothdirections" ? "bothDirections" : "single",
    isActive: r.isActive !== false,
  };
}

interface BimRole {
  name?: string;
  description?: string;
  modelPermission?: string;
  tablePermissions?: { name?: string; filterExpression?: string | string[]; columnPermissions?: { name?: string; metadataPermission?: string }[] }[];
}

function parseBimRole(r: BimRole): Role {
  const tablePermissions: TablePermission[] = (r.tablePermissions || []).map(
    (tp) => ({
      tableName: tp.name || "",
      filterExpression: Array.isArray(tp.filterExpression)
        ? tp.filterExpression.join("\n")
        : (tp.filterExpression || ""),
    })
  );

  const columnPermissions: ColumnPermission[] = [];
  for (const tp of r.tablePermissions || []) {
    for (const cp of tp.columnPermissions || []) {
      columnPermissions.push({
        tableName: tp.name || "",
        columnName: cp.name || "",
        metadataPermission: (cp.metadataPermission as "none" | "default" | "read") || "default",
      });
    }
  }

  return {
    name: r.name || "",
    description: r.description || "",
    modelPermission: r.modelPermission || "read",
    tablePermissions,
    columnPermissions,
  };
}

interface BimDataSource {
  name?: string;
  type?: string;
  connectionString?: string;
  connectionDetails?: { address?: Record<string, string> };
}

function parseBimDataSource(ds: BimDataSource): DataSource {
  let connectionString = ds.connectionString || "";
  if (!connectionString && ds.connectionDetails?.address) {
    connectionString = Object.values(ds.connectionDetails.address).join("; ");
  }
  return {
    name: ds.name || "",
    type: ds.type || "",
    connectionString,
  };
}

interface BimCalculationGroup {
  precedence?: number;
  calculationItems?: { name?: string; expression?: string | string[]; ordinal?: number }[];
}

function parseBimCalculationGroup(tableName: string, cg: unknown): CalculationGroup {
  const group = cg as BimCalculationGroup;
  const calculationItems: CalculationItem[] = (group.calculationItems || []).map((item) => ({
    name: item.name || "",
    expression: Array.isArray(item.expression) ? item.expression.join("\n") : (item.expression || ""),
    ordinal: item.ordinal || 0,
  }));

  return {
    tableName,
    precedence: group.precedence || 0,
    calculationItems,
  };
}

function normalizeMode(mode?: string): Partition["mode"] {
  if (!mode) return "default";
  const lower = mode.toLowerCase();
  if (lower === "import") return "import";
  if (lower === "directlake") return "directLake";
  if (lower === "directquery") return "directQuery";
  if (lower === "dual") return "dual";
  return "default";
}
