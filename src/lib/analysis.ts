import type {
  SemanticModel,
  Table,
  Relationship,
  TableClassification,
  MeasureDependency,
  RlsFilterFlow,
  Role,
} from "./types";

// Classify tables as fact, dimension, bridge, measure, or utility
export function classifyTables(model: SemanticModel): TableClassification[] {
  return model.tables.map((table) => {
    const incoming = model.relationships.filter((r) => r.toTable === table.name);
    const outgoing = model.relationships.filter((r) => r.fromTable === table.name);

    const partitionMode = table.partitions.length > 0
      ? table.partitions[0].mode
      : "default";

    let role: TableClassification["role"] = "utility";

    // Measure table: has measures but few/no real columns, or only 1 column
    if (table.measures.length > 0 && table.columns.length <= 2 && outgoing.length === 0 && incoming.length === 0) {
      role = "measure";
    }
    // Fact table: has outgoing relationships (many-side) and few/no incoming
    else if (outgoing.length > 0 && incoming.length === 0) {
      role = "fact";
    }
    // Dimension table: has incoming relationships (one-side) and no outgoing
    else if (incoming.length > 0 && outgoing.length === 0) {
      role = "dimension";
    }
    // Bridge: has both incoming and outgoing relationships
    else if (incoming.length > 0 && outgoing.length > 0) {
      role = "bridge";
    }
    // Fact with many outgoing
    else if (outgoing.length >= 3) {
      role = "fact";
    }

    return {
      table,
      role,
      partitionMode,
      incomingRelationships: incoming,
      outgoingRelationships: outgoing,
    };
  });
}

// Parse DAX expressions to find measure dependencies
export function analyzeMeasureDependencies(model: SemanticModel): MeasureDependency[] {
  const allMeasures = new Map<string, { tableName: string; measureName: string }>();
  const allColumns = new Map<string, { tableName: string; columnName: string }>();

  // Index all measures and columns
  for (const table of model.tables) {
    for (const measure of table.measures) {
      allMeasures.set(measure.name.toLowerCase(), {
        tableName: table.name,
        measureName: measure.name,
      });
      // Also index as Table[Measure]
      allMeasures.set(`${table.name.toLowerCase()}[${measure.name.toLowerCase()}]`, {
        tableName: table.name,
        measureName: measure.name,
      });
    }
    for (const column of table.columns) {
      const key = `${table.name.toLowerCase()}[${column.name.toLowerCase()}]`;
      allColumns.set(key, { tableName: table.name, columnName: column.name });
    }
  }

  const dependencies: MeasureDependency[] = [];

  for (const table of model.tables) {
    for (const measure of table.measures) {
      const depMeasures: { tableName: string; measureName: string }[] = [];
      const depColumns: { tableName: string; columnName: string }[] = [];

      if (!measure.expression) continue;

      const expr = measure.expression;

      // Find [MeasureName] references (unqualified)
      const bracketRefs = expr.match(/\[([^\]]+)\]/g) || [];
      for (const ref of bracketRefs) {
        const name = ref.slice(1, -1).toLowerCase();
        // Check if it's a measure reference
        if (allMeasures.has(name)) {
          const dep = allMeasures.get(name)!;
          if (dep.measureName !== measure.name || dep.tableName !== table.name) {
            if (!depMeasures.some((d) => d.measureName === dep.measureName && d.tableName === dep.tableName)) {
              depMeasures.push(dep);
            }
          }
        }
      }

      // Find 'TableName'[ColumnName] references (qualified)
      const qualifiedRefs = expr.match(/'([^']+)'\[([^\]]+)\]/g) || [];
      for (const ref of qualifiedRefs) {
        const match = ref.match(/'([^']+)'\[([^\]]+)\]/);
        if (match) {
          const tName = match[1].toLowerCase();
          const cName = match[2].toLowerCase();
          const key = `${tName}[${cName}]`;

          if (allMeasures.has(key)) {
            const dep = allMeasures.get(key)!;
            if (!depMeasures.some((d) => d.measureName === dep.measureName && d.tableName === dep.tableName)) {
              depMeasures.push(dep);
            }
          } else if (allColumns.has(key)) {
            const dep = allColumns.get(key)!;
            if (!depColumns.some((d) => d.columnName === dep.columnName && d.tableName === dep.tableName)) {
              depColumns.push(dep);
            }
          }
        }
      }

      // Find TableName[ColumnName] references (without quotes)
      const unquotedRefs = expr.match(/([A-Za-z_]\w*)\[([^\]]+)\]/g) || [];
      for (const ref of unquotedRefs) {
        const match = ref.match(/([A-Za-z_]\w*)\[([^\]]+)\]/);
        if (match) {
          const tName = match[1].toLowerCase();
          const cName = match[2].toLowerCase();
          const key = `${tName}[${cName}]`;

          if (allColumns.has(key)) {
            const dep = allColumns.get(key)!;
            if (!depColumns.some((d) => d.columnName === dep.columnName && d.tableName === dep.tableName)) {
              depColumns.push(dep);
            }
          }
        }
      }

      dependencies.push({
        measure,
        tableName: table.name,
        dependsOnMeasures: depMeasures,
        dependsOnColumns: depColumns,
      });
    }
  }

  return dependencies;
}

// Analyze how RLS filters propagate through relationships
export function analyzeRlsFlow(model: SemanticModel): RlsFilterFlow[] {
  const flows: RlsFilterFlow[] = [];

  for (const role of model.roles) {
    const directlyFiltered = new Set<string>();
    const downstreamFiltered = new Set<string>();

    // Find directly filtered tables
    for (const perm of role.tablePermissions) {
      directlyFiltered.add(perm.tableName);
    }

    // Propagate through relationships (BFS)
    const visited = new Set<string>(directlyFiltered);
    const queue = Array.from(directlyFiltered);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Find tables that this table filters (via relationships where current is the "one" side)
      for (const rel of model.relationships) {
        if (!rel.isActive) continue;

        let target: string | null = null;

        // Single direction: filter flows from one-side to many-side
        // In Power BI, the "to" column is the one-side (primary key)
        if (rel.toTable === current) {
          target = rel.fromTable;
        }

        // Bidirectional: filter also flows from many-side to one-side
        if (rel.crossFilteringBehavior === "bothDirections" && rel.fromTable === current) {
          target = rel.toTable;
        }

        if (target && !visited.has(target)) {
          visited.add(target);
          downstreamFiltered.add(target);
          queue.push(target);
        }
      }
    }

    const allTableNames = model.tables.map((t) => t.name);
    const unaffected = allTableNames.filter(
      (t) => !directlyFiltered.has(t) && !downstreamFiltered.has(t)
    );

    flows.push({
      role,
      directlyFiltered: Array.from(directlyFiltered),
      downstreamFiltered: Array.from(downstreamFiltered),
      unaffected,
    });
  }

  return flows;
}

// Get unique data source info from partitions
export function extractDataSources(model: SemanticModel) {
  const sources = new Map<string, { name: string; type: string; tables: string[]; url?: string }>();

  for (const table of model.tables) {
    for (const partition of table.partitions) {
      const mode = partition.mode;
      let sourceKey: string = mode;
      let sourceName: string = mode;
      let sourceType: string = mode;
      let url: string | undefined;

      if (partition.source.entityName) {
        sourceKey = `entity:${partition.source.entityName}`;
      }

      if (mode === "directLake") {
        sourceName = "Direct Lake";
        sourceType = "Azure Data Lake / OneLake";
        // Try to find URL from expression
        if (partition.source.expression) {
          const urlMatch = partition.source.expression.match(/https?:\/\/[^\s"']+/);
          if (urlMatch) url = urlMatch[0];
        }
      } else if (mode === "import") {
        sourceName = "Import";
        sourceType = "In-Memory";
        // Check if it's a DAX calculated table
        if (partition.source.type === "calculated" || partition.source.type === "calculatedPartitionSource") {
          sourceName = "DAX Engine";
          sourceType = "In-Memory Calculation";
        }
      } else if (mode === "directQuery") {
        sourceName = "DirectQuery";
        sourceType = "Live Connection";
      }

      const key = `${sourceName}:${sourceType}`;
      if (!sources.has(key)) {
        sources.set(key, { name: sourceName, type: sourceType, tables: [], url });
      }
      sources.get(key)!.tables.push(table.name);
    }
  }

  return Array.from(sources.values());
}
