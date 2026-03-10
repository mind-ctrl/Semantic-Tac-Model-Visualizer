"use client";

import { useMemo } from "react";
import { useModel } from "@/lib/model-context";
import {
  analyzeDaxComplexity,
  type DaxComplexityResult,
} from "@/lib/health-analysis";

function complexityColor(level: DaxComplexityResult["level"]): string {
  switch (level) {
    case "simple":       return "var(--color-accent-green)";
    case "moderate":     return "var(--color-primary)";
    case "complex":      return "var(--color-accent-orange)";
    case "very complex": return "var(--color-accent-red)";
  }
}

export default function HealthDashboard() {
  const { model } = useModel();

  const daxResults = useMemo(() => (model ? analyzeDaxComplexity(model) : []), [model]);

  if (!model) return null;

  const maxDaxScore = Math.max(1, ...daxResults.map((r) => r.score));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* DAX Complexity */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold">DAX Complexity</h3>
          <span className="text-xs text-[var(--color-text-dim)]">{daxResults.length} measures</span>
        </div>

        {daxResults.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--color-text-muted)]">
            No measures found in this model.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {daxResults.map((r) => {
              const clr = complexityColor(r.level);
              return (
                <div key={`${r.tableName}.${r.measure}`} className="px-5 py-3 hover:bg-[var(--color-surface)]/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{r.measure}</span>
                      <span className="text-[10px] text-[var(--color-text-dim)]">{r.tableName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{ color: clr, background: `color-mix(in srgb, ${clr} 10%, transparent)` }}
                      >
                        {r.level}
                      </span>
                      <span className="text-sm font-bold w-8 text-right font-mono" style={{ color: clr }}>
                        {r.score}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-[var(--color-surface-light)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (r.score / maxDaxScore) * 100)}%`,
                        backgroundColor: clr,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  {r.factors.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.factors.map((f, i) => (
                        <span key={i} className="text-[10px] text-[var(--color-text-dim)] bg-[var(--color-surface-light)] px-1.5 py-0.5 rounded-md">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
