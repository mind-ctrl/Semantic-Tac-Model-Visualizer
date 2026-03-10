import type { SemanticModel, Relationship } from "./types";

// ── Health Analysis Types ──

export interface HealthIssue {
  severity: "error" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  table?: string;
  measure?: string;
}

export interface ModelHealthResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  issues: HealthIssue[];
  stats: {
    totalChecks: number;
    errors: number;
    warnings: number;
    passed: number;
  };
}

// ── DAX Complexity Types ──

export interface DaxComplexityResult {
  measure: string;
  tableName: string;
  score: number;
  level: "simple" | "moderate" | "complex" | "very complex";
  factors: string[];
}

// ── Health Analysis ──

export function analyzeModelHealth(model: SemanticModel): ModelHealthResult {
  const issues: HealthIssue[] = [];
  let totalChecks = 0;

  // Build relationship lookup helpers
  const tableOutgoing = new Map<string, Relationship[]>();
  const tableIncoming = new Map<string, Relationship[]>();
  const relKeyColumns = new Set<string>();

  for (const rel of model.relationships) {
    tableOutgoing.set(rel.fromTable, [...(tableOutgoing.get(rel.fromTable) ?? []), rel]);
    tableIncoming.set(rel.toTable, [...(tableIncoming.get(rel.toTable) ?? []), rel]);
    relKeyColumns.add(`${rel.fromTable}::${rel.fromColumn}`);
    relKeyColumns.add(`${rel.toTable}::${rel.toColumn}`);
  }

  // Check: Bidirectional relationships
  for (const rel of model.relationships) {
    totalChecks++;
    if (rel.crossFilteringBehavior === "bothDirections") {
      issues.push({
        severity: "warning",
        category: "Relationships",
        title: "Bidirectional cross-filter",
        description: `Relationship ${rel.fromTable}[${rel.fromColumn}] → ${rel.toTable}[${rel.toColumn}] uses bidirectional filtering, which can cause ambiguity and performance issues.`,
        table: rel.fromTable,
      });
    }
  }

  // Check: Inactive relationships
  for (const rel of model.relationships) {
    totalChecks++;
    if (!rel.isActive) {
      issues.push({
        severity: "info",
        category: "Relationships",
        title: "Inactive relationship",
        description: `Relationship ${rel.fromTable}[${rel.fromColumn}] → ${rel.toTable}[${rel.toColumn}] is inactive. It must be activated via USERELATIONSHIP in DAX.`,
        table: rel.fromTable,
      });
    }
  }

  // Check: Bidirectional + RLS combination
  const hasBidiRels = model.relationships.some(
    (r) => r.crossFilteringBehavior === "bothDirections"
  );
  if (model.roles.length > 0 && hasBidiRels) {
    totalChecks++;
    issues.push({
      severity: "error",
      category: "Security",
      title: "Bidirectional filtering with RLS",
      description:
        "The model combines bidirectional cross-filtering with Row-Level Security. This is a known Power BI issue that can lead to unexpected data exposure or broken filters.",
    });
  }

  for (const table of model.tables) {
    const isMeasureOnly =
      table.columns.length === 0 && table.measures.length > 0;
    const hasRels =
      (tableOutgoing.get(table.name)?.length ?? 0) > 0 ||
      (tableIncoming.get(table.name)?.length ?? 0) > 0;

    // Check: Orphaned tables
    totalChecks++;
    if (!hasRels && !isMeasureOnly) {
      issues.push({
        severity: "warning",
        category: "Schema",
        title: "Orphaned table",
        description: `Table "${table.name}" has no relationships and is not a measures-only table.`,
        table: table.name,
      });
    }

    // Check: Column count
    totalChecks++;
    if (table.columns.length > 100) {
      issues.push({
        severity: "error",
        category: "Schema",
        title: "Excessive columns",
        description: `Table "${table.name}" has ${table.columns.length} columns (>100). This severely impacts performance and maintainability.`,
        table: table.name,
      });
    } else if (table.columns.length > 50) {
      issues.push({
        severity: "warning",
        category: "Schema",
        title: "High column count",
        description: `Table "${table.name}" has ${table.columns.length} columns (>50). Consider reducing to improve performance.`,
        table: table.name,
      });
    }

    // Check: Empty tables
    totalChecks++;
    if (table.columns.length === 0 && table.measures.length === 0) {
      issues.push({
        severity: "error",
        category: "Schema",
        title: "Empty table",
        description: `Table "${table.name}" has no columns and no measures.`,
        table: table.name,
      });
    }

    // Check: Table without description
    totalChecks++;
    if (!table.description) {
      issues.push({
        severity: "info",
        category: "Documentation",
        title: "Table missing description",
        description: `Table "${table.name}" has no description.`,
        table: table.name,
      });
    }

    // Check: Measures without descriptions
    for (const measure of table.measures) {
      totalChecks++;
      if (!measure.description) {
        issues.push({
          severity: "info",
          category: "Documentation",
          title: "Measure missing description",
          description: `Measure "${measure.name}" in "${table.name}" has no description.`,
          table: table.name,
          measure: measure.name,
        });
      }
    }

    // Check: Hidden columns that are relationship keys
    for (const col of table.columns) {
      if (col.isHidden && relKeyColumns.has(`${table.name}::${col.name}`)) {
        totalChecks++;
        issues.push({
          severity: "warning",
          category: "Schema",
          title: "Hidden relationship key",
          description: `Column "${col.name}" in "${table.name}" is hidden but used as a relationship key. This may confuse report authors.`,
          table: table.name,
        });
      }
    }

    // Check: Text columns in fact-like tables (many outgoing relationships)
    const outgoing = tableOutgoing.get(table.name) ?? [];
    if (outgoing.length >= 2) {
      for (const col of table.columns) {
        if (col.dataType === "string" && !relKeyColumns.has(`${table.name}::${col.name}`)) {
          totalChecks++;
          issues.push({
            severity: "warning",
            category: "Performance",
            title: "Text column in fact table",
            description: `Column "${col.name}" in fact-like table "${table.name}" is a text column. Text columns in fact tables increase model size.`,
            table: table.name,
          });
        }
      }
    }
  }

  // Check: Missing RLS when model has >5 tables
  totalChecks++;
  if (model.tables.length > 5 && model.roles.length === 0) {
    issues.push({
      severity: "info",
      category: "Security",
      title: "No Row-Level Security defined",
      description: `The model has ${model.tables.length} tables but no RLS roles. Consider whether data access restrictions are needed.`,
    });
  }

  // Calculate score
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errors * 10 - warnings * 3);
  const passed = totalChecks - issues.length;

  const grade: ModelHealthResult["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return {
    score,
    grade,
    issues,
    stats: { totalChecks, errors, warnings, passed },
  };
}

// ── DAX Complexity Analysis ──

const DAX_FUNCTIONS = /\b(CALCULATE|FILTER|SUMX|AVERAGEX|COUNTX|MAXX|MINX|RANKX|ADDCOLUMNS|SUMMARIZE|SUMMARIZECOLUMNS|TOPN|GENERATE|GENERATEALL|CROSSJOIN|UNION|INTERSECT|EXCEPT|TREATAS|KEEPFILTERS|ALL|ALLEXCEPT|ALLSELECTED|VALUES|DISTINCT|RELATED|RELATEDTABLE|LOOKUPVALUE|EARLIER|EARLIEST|SWITCH|IF|DIVIDE|FORMAT|DATEADD|DATESYTD|DATESQTD|DATESMTD|TOTALYTD|TOTALQTD|TOTALMTD|SAMEPERIODLASTYEAR|PARALLELPERIOD|SELECTEDVALUE|HASONEVALUE|ISBLANK|ISEMPTY|ISINSCOPE|ISFILTERED|ISCROSSFILTERED|USERELATIONSHIP|CROSSFILTER|VAR|RETURN)\b/gi;

const ITERATOR_FUNCTIONS = /\b(SUMX|AVERAGEX|COUNTX|MAXX|MINX|RANKX|PRODUCTX|CONCATENATEX)\b/gi;

function countMatches(text: string, regex: RegExp): number {
  return (text.match(regex) || []).length;
}

function maxNestingDepth(expression: string): number {
  let max = 0;
  let current = 0;
  for (const ch of expression) {
    if (ch === "(") { current++; max = Math.max(max, current); }
    else if (ch === ")") { current = Math.max(0, current - 1); }
  }
  return max;
}

function countUniqueDaxFunctions(expression: string): number {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(DAX_FUNCTIONS.source, "gi");
  while ((match = regex.exec(expression)) !== null) {
    found.add(match[0].toUpperCase());
  }
  return found.size;
}

function countMeasureReferences(expression: string, allMeasureNames: Set<string>): number {
  let count = 0;
  for (const name of allMeasureNames) {
    // Match [MeasureName] references
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\[${escaped}\\]`, "g");
    count += (expression.match(regex) || []).length;
  }
  return count;
}

export function analyzeDaxComplexity(model: SemanticModel): DaxComplexityResult[] {
  // Collect all measure names for cross-reference detection
  const allMeasureNames = new Set<string>();
  for (const table of model.tables) {
    for (const m of table.measures) {
      allMeasureNames.add(m.name);
    }
  }

  const results: DaxComplexityResult[] = [];

  for (const table of model.tables) {
    for (const measure of table.measures) {
      const expr = measure.expression || "";
      if (!expr.trim()) continue;

      let score = 0;
      const factors: string[] = [];

      // Expression length
      if (expr.length > 1000) { score += 30; factors.push("Very long expression (>1000 chars)"); }
      else if (expr.length > 500) { score += 20; factors.push("Long expression (>500 chars)"); }
      else if (expr.length > 200) { score += 10; factors.push("Moderate length expression (>200 chars)"); }

      // CALCULATE count
      const calcCount = countMatches(expr, /\bCALCULATE\b/gi);
      if (calcCount > 0) { score += calcCount * 10; factors.push(`CALCULATE used ${calcCount}x`); }

      // Nesting depth
      const depth = maxNestingDepth(expr);
      if (depth > 2) {
        const extra = depth - 2;
        score += extra * 5;
        factors.push(`Nesting depth: ${depth} levels`);
      }

      // Unique DAX functions
      const uniqueFns = countUniqueDaxFunctions(expr);
      if (uniqueFns > 5) {
        score += (uniqueFns - 5) * 2;
        factors.push(`${uniqueFns} unique DAX functions`);
      }

      // FILTER usage
      const filterCount = countMatches(expr, /\bFILTER\b/gi);
      if (filterCount > 0) { score += filterCount * 15; factors.push(`FILTER used ${filterCount}x`); }

      // Iterator functions
      const iterCount = countMatches(expr, ITERATOR_FUNCTIONS);
      if (iterCount > 0) { score += iterCount * 10; factors.push(`Iterator functions used ${iterCount}x`); }

      // VAR count
      const varCount = countMatches(expr, /\bVAR\b/gi);
      if (varCount > 0) { score += varCount * 3; factors.push(`${varCount} variables (good practice)`); }

      // Measure references
      const measureRefs = countMeasureReferences(expr, allMeasureNames);
      if (measureRefs > 0) { score += measureRefs * 5; factors.push(`References ${measureRefs} other measure(s)`); }

      const level: DaxComplexityResult["level"] =
        score <= 20 ? "simple" : score <= 40 ? "moderate" : score <= 70 ? "complex" : "very complex";

      results.push({ measure: measure.name, tableName: table.name, score, level, factors });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
