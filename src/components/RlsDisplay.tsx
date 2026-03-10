"use client";

import { useModel } from "@/lib/model-context";

export default function RlsDisplay() {
  const { model, obfuscateName, reduceToSemantics } = useModel();
  if (!model || model.roles.length === 0) return null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Row-Level Security Roles</h2>
      <div className="space-y-4">
        {model.roles.map((role) => (
          <div
            key={role.name}
            className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-[var(--color-accent-red)]/20 text-[var(--color-accent-red)]">
                {obfuscateName(role.name, "Role")}
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">
                Permission: {role.modelPermission}
              </span>
            </div>
            {role.tablePermissions.map((perm, i) => (
              <div key={i} className="ml-4 flex items-start gap-2">
                <span className="font-mono text-sm text-[var(--color-primary-light)]">
                  {obfuscateName(perm.tableName, "Table")}
                </span>
                <span className="text-[var(--color-text-muted)]">=</span>
                <code className="font-mono text-sm text-[var(--color-text-muted)] bg-[var(--color-background)] px-2 py-0.5 rounded">
                  {reduceToSemantics ? "[filter expression hidden]" : perm.filterExpression}
                </code>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
