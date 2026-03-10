"use client";

import { useModel } from "@/lib/model-context";

export default function ModelSummary() {
  const { model, obfuscateName } = useModel();
  if (!model) return null;

  const totalColumns = model.tables.reduce((sum, t) => sum + t.columns.length, 0);
  const totalMeasures = model.tables.reduce((sum, t) => sum + t.measures.length, 0);

  const partitionModes = new Set<string>();
  for (const table of model.tables) {
    for (const p of table.partitions) {
      if (p.mode === "directLake") partitionModes.add("Direct Lake");
      else if (p.mode === "import") partitionModes.add("Import");
      else if (p.mode === "directQuery") partitionModes.add("DirectQuery");
      else if (p.mode === "dual") partitionModes.add("Dual");
    }
  }

  const hasOneLake = model.tables.some((t) =>
    t.partitions.some((p) =>
      p.source.expression?.includes("onelake") ||
      p.source.expression?.includes("fabric.microsoft.com")
    )
  );
  if (hasOneLake) partitionModes.add("Direct Lake (OneLake)");

  const stats = [
    { label: "Tables", value: model.tables.length, color: "var(--color-primary)" },
    { label: "Measures", value: totalMeasures, color: "var(--color-accent)" },
    { label: "Columns", value: totalColumns, color: "var(--color-accent-purple)" },
    { label: "Relationships", value: model.relationships.length, color: "var(--color-accent-orange)" },
    { label: "RLS Roles", value: model.roles.length, color: "var(--color-accent-green)" },
  ];

  return (
    <div>
      {/* Stats row - horizontal metric cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4"
          >
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: s.color }} />
            <div className="text-2xl font-bold tracking-tight" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Data source badges */}
      {partitionModes.size > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">Source</span>
          <div className="h-3 w-px bg-[var(--color-border)]" />
          {Array.from(partitionModes).map((mode) => (
            <span
              key={mode}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[var(--color-primary)]/8 text-[var(--color-primary-light)] border border-[var(--color-primary)]/15"
            >
              {mode}
            </span>
          ))}
        </div>
      )}

      {/* Tables list - card style instead of table */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tables</h3>
          <span className="text-xs text-[var(--color-text-dim)]">{model.tables.length} total</span>
        </div>
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {model.tables.map((table) => {
            const mode = table.partitions[0]?.mode || "default";
            return (
              <div
                key={table.name}
                className="px-5 py-3 flex items-center gap-4 hover:bg-[var(--color-surface)]/50 transition-colors group"
              >
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium font-mono truncate block">
                    {obfuscateName(table.name, "Table")}
                  </span>
                </div>

                {/* Mini stats */}
                <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] shrink-0">
                  <span title="Columns">{table.columns.length} cols</span>
                  {table.measures.length > 0 && (
                    <span className="text-[var(--color-accent-light)]" title="Measures">{table.measures.length}m</span>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  <PartitionBadge mode={mode} />
                  {table.type === "calculated" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-surface-light)] text-[var(--color-text-dim)]">
                      calculated
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PartitionBadge({ mode }: { mode: string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    import: { bg: "var(--color-accent-orange)", text: "var(--color-accent-orange)", border: "var(--color-accent-orange)" },
    directLake: { bg: "var(--color-accent-green)", text: "var(--color-accent-green)", border: "var(--color-accent-green)" },
    directQuery: { bg: "var(--color-accent-purple)", text: "var(--color-accent-purple)", border: "var(--color-accent-purple)" },
    dual: { bg: "var(--color-accent)", text: "var(--color-accent)", border: "var(--color-accent)" },
  };

  const c = config[mode];
  if (!c) return null;

  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-md"
      style={{
        background: `color-mix(in srgb, ${c.bg} 10%, transparent)`,
        color: c.text,
        border: `1px solid color-mix(in srgb, ${c.border} 20%, transparent)`,
      }}
    >
      {mode}
    </span>
  );
}
