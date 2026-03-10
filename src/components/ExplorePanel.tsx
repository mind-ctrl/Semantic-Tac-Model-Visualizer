"use client";

import { useState } from "react";
import type { Table, Measure, Relationship } from "@/lib/types";
import { useModel } from "@/lib/model-context";

interface ExplorePanelProps {
  selectedTable: string | null;
  onClose: () => void;
}

export default function ExplorePanel({ selectedTable, onClose }: ExplorePanelProps) {
  const { model, obfuscateName, reduceToSemantics } = useModel();
  const [expandedMeasure, setExpandedMeasure] = useState<string | null>(null);

  if (!model || !selectedTable) return null;

  const table = model.tables.find((t) => t.name === selectedTable);
  if (!table) return null;

  const incoming = model.relationships.filter((r) => r.toTable === selectedTable);
  const outgoing = model.relationships.filter((r) => r.fromTable === selectedTable);

  const displayName = obfuscateName(table.name, "Table");

  return (
    <div className="w-80 h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-light)]">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text)]">{displayName}</h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            {table.columns.length} cols, {table.measures.length} measures
          </span>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Table info */}
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex gap-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{
              background: table.type === "calculated" ? "rgba(245,158,11,0.2)" : "rgba(59,130,246,0.2)",
              color: table.type === "calculated" ? "#f59e0b" : "#3b82f6",
            }}>
              {table.type}
            </span>
            {table.partitions[0] && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{
                background: table.partitions[0].mode === "directLake" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)",
                color: table.partitions[0].mode === "directLake" ? "#10b981" : "#f59e0b",
              }}>
                {table.partitions[0].mode}
              </span>
            )}
            {table.isHidden && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[var(--color-surface-light)] text-[var(--color-text-muted)]">
                hidden
              </span>
            )}
          </div>
          {table.description && !reduceToSemantics && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">{table.description}</p>
          )}
        </div>

        {/* Relationships */}
        {(incoming.length > 0 || outgoing.length > 0) && (
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h4 className="text-xs font-semibold text-[var(--color-text)] mb-2">Relationships</h4>
            {outgoing.map((rel, i) => (
              <RelationshipItem key={`out-${i}`} rel={rel} direction="outgoing" obfuscateName={obfuscateName} />
            ))}
            {incoming.map((rel, i) => (
              <RelationshipItem key={`in-${i}`} rel={rel} direction="incoming" obfuscateName={obfuscateName} />
            ))}
          </div>
        )}

        {/* Columns */}
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h4 className="text-xs font-semibold text-[var(--color-text)] mb-2">
            Columns ({table.columns.length})
          </h4>
          <div className="space-y-1">
            {table.columns.map((col, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--color-text)] truncate" style={{ opacity: col.isHidden ? 0.5 : 1 }}>
                  {col.isHidden && <span className="text-[var(--color-text-muted)]">[H] </span>}
                  {obfuscateName(col.name, "Column")}
                </span>
                <span className="text-[var(--color-primary-light)] ml-2 shrink-0">{col.dataType}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Measures with preview */}
        {table.measures.length > 0 && (
          <div className="px-4 py-3">
            <h4 className="text-xs font-semibold text-[var(--color-text)] mb-2">
              Measures ({table.measures.length})
            </h4>
            <div className="space-y-1">
              {table.measures.map((m, i) => (
                <MeasurePreview
                  key={i}
                  measure={m}
                  isExpanded={expandedMeasure === m.name}
                  onToggle={() => setExpandedMeasure(expandedMeasure === m.name ? null : m.name)}
                  obfuscateName={obfuscateName}
                  reduceToSemantics={reduceToSemantics}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RelationshipItem({ rel, direction, obfuscateName }: {
  rel: Relationship;
  direction: "incoming" | "outgoing";
  obfuscateName: (name: string, prefix: string) => string;
}) {
  return (
    <div className="flex items-center gap-1 text-[10px] py-0.5">
      <span className={direction === "outgoing" ? "text-[var(--color-accent-orange)]" : "text-[var(--color-primary-light)]"}>
        {direction === "outgoing" ? "→" : "←"}
      </span>
      <span className="text-[var(--color-text)]">
        {obfuscateName(direction === "outgoing" ? rel.toTable : rel.fromTable, "Table")}
      </span>
      <span className="text-[var(--color-text-muted)]">
        ({obfuscateName(rel.fromColumn, "Column")} = {obfuscateName(rel.toColumn, "Column")})
      </span>
      {rel.crossFilteringBehavior === "bothDirections" && (
        <span className="text-[8px] px-1 rounded bg-[var(--color-accent-orange)]/20 text-[var(--color-accent-orange)]">bi</span>
      )}
    </div>
  );
}

function MeasurePreview({ measure, isExpanded, onToggle, obfuscateName, reduceToSemantics }: {
  measure: Measure;
  isExpanded: boolean;
  onToggle: () => void;
  obfuscateName: (name: string, prefix: string) => string;
  reduceToSemantics: boolean;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[10px] py-1 hover:bg-[var(--color-surface-light)] rounded px-1 -mx-1"
      >
        <span className="text-[var(--color-text)] truncate flex items-center gap-1">
          <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {obfuscateName(measure.name, "Measure")}
        </span>
        {measure.isHidden && (
          <span className="text-[8px] text-[var(--color-text-muted)]">[H]</span>
        )}
      </button>
      {isExpanded && !reduceToSemantics && measure.expression && (
        <div className="mt-1 mb-2">
          <DaxHighlighter expression={measure.expression} />
          {measure.formatString && (
            <div className="text-[9px] text-[var(--color-text-muted)] mt-1 px-2">
              Format: {measure.formatString}
            </div>
          )}
          {measure.description && (
            <div className="text-[9px] text-[var(--color-text-muted)] mt-1 px-2 italic">
              {measure.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple DAX syntax highlighter
function DaxHighlighter({ expression }: { expression: string }) {
  const keywords = /\b(CALCULATE|FILTER|ALL|ALLEXCEPT|VALUES|DISTINCT|RELATED|RELATEDTABLE|SUMMARIZE|SUMMARIZECOLUMNS|ADDCOLUMNS|SELECTCOLUMNS|TOPN|EARLIER|EARLIEST|SWITCH|TRUE|FALSE|BLANK|IF|AND|OR|NOT|IN|RETURN|VAR|DIVIDE|INT|SELECTEDMEASURE|ISSELECTEDMEASURE|HASONEVALUE|HASONEFILTER|ISBLANK|ISEMPTY|ISERROR|SELECTEDVALUE)\b/gi;
  const functions = /\b(SUM|SUMX|AVERAGE|AVERAGEX|COUNT|COUNTX|COUNTA|COUNTAX|COUNTROWS|COUNTBLANK|MIN|MINX|MAX|MAXX|DISTINCTCOUNT|RANKX|PERCENTILE|MEDIAN|PRODUCT|PRODUCTX|CONCATENATEX|FORMAT|YEAR|MONTH|DAY|DATE|DATESYTD|DATESMTD|DATESQTD|TOTALYTD|TOTALMTD|TOTALQTD|SAMEPERIODLASTYEAR|DATEADD|PARALLELPERIOD|LASTDATE|FIRSTDATE|ENDOFMONTH|STARTOFMONTH|CALENDAR|CALENDARAUTO|USERELATIONSHIP|CROSSFILTER|TREATAS|LOOKUPVALUE|GENERATESERIES|GENERATE|UNION|INTERSECT|EXCEPT|NATURALINNERJOIN|NATURALLEFTOUTERJOIN|ROUNDUP|ROUNDDOWN|ROUND|ABS|POWER|SQRT|LOG|LN|EXP|MOD|QUOTIENT|SIGN|CEILING|FLOOR|RAND|RANDBETWEEN|LEFT|RIGHT|MID|LEN|FIND|SEARCH|REPLACE|SUBSTITUTE|TRIM|UPPER|LOWER|PROPER|CONCATENATE|EXACT|FIXED|REPT|TEXT|VALUE|UNICHAR|UNICODE|PATHCONTAINS|PATHITEM|PATHITEMREVERSE|PATHLENGTH|ISINSCOPE|REMOVEFILTERS)\b/gi;
  const strings = /"[^"]*"/g;
  const numbers = /\b\d+(\.\d+)?\b/g;
  const comments = /\/\/.*$/gm;
  const tableRefs = /'[^']+'/g;
  const columnRefs = /\[[^\]]+\]/g;

  // Simple tokenization - apply in order of precedence
  let html = expression
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Apply highlighting in specific order
  html = html.replace(comments, '<span style="color:#6b7280;font-style:italic">$&</span>');
  html = html.replace(strings, '<span style="color:#ef4444">$&</span>');
  html = html.replace(tableRefs, '<span style="color:#8b5cf6">$&</span>');
  html = html.replace(columnRefs, '<span style="color:#60a5fa">$&</span>');
  html = html.replace(keywords, '<span style="color:#f59e0b;font-weight:600">$&</span>');
  html = html.replace(functions, '<span style="color:#10b981">$&</span>');
  html = html.replace(numbers, '<span style="color:#f472b6">$&</span>');

  return (
    <pre
      className="text-[9px] font-mono leading-relaxed bg-[var(--color-background)] rounded px-2 py-1.5 overflow-x-auto max-h-48 overflow-y-auto"
      style={{ color: "var(--color-text)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
