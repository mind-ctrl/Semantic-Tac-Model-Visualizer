"use client";

import { useModel } from "@/lib/model-context";

export default function RelationshipsView() {
  const { model, obfuscateName } = useModel();
  if (!model || model.relationships.length === 0) return null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Relationships</h2>
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-sm text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              <th className="text-left px-6 py-3 font-medium">From (Many)</th>
              <th className="text-center px-2 py-3 font-medium" />
              <th className="text-left px-6 py-3 font-medium">To (One)</th>
              <th className="text-left px-6 py-3 font-medium">Cross Filter</th>
              <th className="text-left px-6 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {model.relationships.map((rel, i) => (
              <tr
                key={i}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-light)] transition-colors"
              >
                <td className="px-6 py-3 font-mono text-sm">
                  {obfuscateName(rel.fromTable, "Table")}.
                  {obfuscateName(rel.fromColumn, "Column")}
                </td>
                <td className="px-2 py-3 text-[var(--color-text-muted)] text-center">&rarr;</td>
                <td className="px-6 py-3 font-mono text-sm">
                  {obfuscateName(rel.toTable, "Table")}.
                  {obfuscateName(rel.toColumn, "Column")}
                </td>
                <td className="px-6 py-3">
                  {rel.crossFilteringBehavior === "bothDirections" ? (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-[var(--color-accent-orange)]/20 text-[var(--color-accent-orange)]">
                      bothDirections
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--color-text-muted)]">single</span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm">
                  {rel.isActive ? (
                    <span className="text-[var(--color-accent)]">Yes</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
