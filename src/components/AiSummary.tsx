"use client";

import { useState, useCallback } from "react";
import { useModel } from "@/lib/model-context";
import type { SemanticModel } from "@/lib/types";

function buildModelSummaryText(model: SemanticModel): string {
  const lines: string[] = [];
  lines.push(`Model: ${model.name}`);
  lines.push(`Tables: ${model.tables.length}`);
  lines.push(`Relationships: ${model.relationships.length}`);
  lines.push(`RLS Roles: ${model.roles.length}`);

  const totalCols = model.tables.reduce((sum, t) => sum + t.columns.length, 0);
  const totalMeasures = model.tables.reduce((sum, t) => sum + t.measures.length, 0);
  lines.push(`Total Columns: ${totalCols}`);
  lines.push(`Total Measures: ${totalMeasures}`);

  lines.push("\n--- Tables ---");
  for (const t of model.tables) {
    const mode = t.partitions[0]?.mode || "default";
    lines.push(`  ${t.name}: ${t.columns.length} cols, ${t.measures.length} measures, type=${t.type}, mode=${mode}`);
  }

  lines.push("\n--- Relationships ---");
  for (const r of model.relationships) {
    lines.push(`  ${r.fromTable}.${r.fromColumn} -> ${r.toTable}.${r.toColumn} (${r.crossFilteringBehavior}${r.isActive ? "" : ", inactive"})`);
  }

  if (model.roles.length > 0) {
    lines.push("\n--- RLS Roles ---");
    for (const role of model.roles) {
      lines.push(`  ${role.name} (${role.modelPermission})`);
      for (const tp of role.tablePermissions) {
        lines.push(`    ${tp.tableName}: ${tp.filterExpression.slice(0, 100)}`);
      }
    }
  }

  // Include top measures (up to 20)
  const allMeasures = model.tables.flatMap((t) =>
    t.measures.map((m) => ({ table: t.name, ...m }))
  );
  if (allMeasures.length > 0) {
    lines.push("\n--- Key Measures (sample) ---");
    for (const m of allMeasures.slice(0, 20)) {
      const expr = m.expression ? m.expression.slice(0, 150) : "";
      lines.push(`  [${m.table}] ${m.name} = ${expr}`);
    }
  }

  return lines.join("\n");
}

export default function AiSummary() {
  const { model, reduceToSemantics } = useModel();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = useCallback(async () => {
    if (!model) return;
    setLoading(true);
    setError(null);

    try {
      const modelSummary = reduceToSemantics
        ? "Model details hidden (Reduce to Semantics is enabled). Please provide a generic architecture analysis."
        : buildModelSummaryText(model);

      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelSummary }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate summary");
      } else {
        setSummary(data.summary);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [model, reduceToSemantics]);

  if (!model) return null;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-bold text-[var(--color-text)]">AI Architecture Summary</h2>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[var(--color-accent-purple)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing...
            </span>
          ) : summary ? "Regenerate" : "Generate Summary"}
        </button>
      </div>

      <div className="px-6 py-4">
        {error && (
          <div className="p-4 bg-[var(--color-accent-red)]/10 border border-[var(--color-accent-red)]/30 rounded-lg text-[var(--color-accent-red)] text-sm mb-4">
            {error}
          </div>
        )}

        {!summary && !loading && !error && (
          <p className="text-[var(--color-text-muted)] text-sm">
            Click &quot;Generate Summary&quot; to get an AI-powered analysis of your model architecture.
            Requires a Perplexity API key in <code className="text-xs bg-[var(--color-surface-light)] px-1.5 py-0.5 rounded">.env.local</code>
          </p>
        )}

        {loading && !summary && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-[var(--color-accent-purple)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {summary && (
          <div className="prose prose-sm max-w-none">
            {summary.split("\n\n").map((paragraph, i) => (
              <p key={i} className="text-sm text-[var(--color-text)] leading-relaxed mb-3">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
