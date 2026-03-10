"use client";

import { useModel } from "@/lib/model-context";

export default function OlsDisplay() {
  const { model, obfuscateName, reduceToSemantics } = useModel();

  if (!model) return null;

  // Collect all column permissions across all roles
  const olsEntries = model.roles.flatMap((role) =>
    (role.columnPermissions || []).map((cp) => ({
      roleName: role.name,
      tableName: cp.tableName,
      columnName: cp.columnName,
      permission: cp.metadataPermission,
    }))
  );

  if (olsEntries.length === 0) return null;

  // Group by role
  const byRole = new Map<string, typeof olsEntries>();
  for (const entry of olsEntries) {
    const list = byRole.get(entry.roleName) || [];
    list.push(entry);
    byRole.set(entry.roleName, list);
  }

  const permissionColor = (p: string) => {
    if (p === "none") return { bg: "rgba(239,68,68,0.15)", text: "#ef4444" };
    if (p === "read") return { bg: "rgba(16,185,129,0.15)", text: "#10b981" };
    return { bg: "rgba(107,114,128,0.15)", text: "#6b7280" };
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
      <div className="px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Object-Level Security (OLS)
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Column-level metadata permissions restrict which columns are visible to each role.
        </p>
      </div>

      <div className="px-6 py-4 space-y-4">
        {Array.from(byRole.entries()).map(([roleName, entries]) => (
          <div key={roleName}>
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {reduceToSemantics ? obfuscateName(roleName, "Role") : roleName}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--color-text-muted)] text-xs">
                    <th className="text-left py-1.5 pr-4 font-medium">Table</th>
                    <th className="text-left py-1.5 pr-4 font-medium">Column</th>
                    <th className="text-left py-1.5 font-medium">Permission</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const color = permissionColor(entry.permission);
                    return (
                      <tr key={i} className="border-t border-[var(--color-border)]">
                        <td className="py-1.5 pr-4 text-[var(--color-text)]">
                          {reduceToSemantics ? obfuscateName(entry.tableName, "Table") : entry.tableName}
                        </td>
                        <td className="py-1.5 pr-4 text-[var(--color-text)]">
                          {reduceToSemantics ? obfuscateName(entry.columnName, "Column") : entry.columnName}
                        </td>
                        <td className="py-1.5">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: color.bg, color: color.text }}
                          >
                            {entry.permission}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
