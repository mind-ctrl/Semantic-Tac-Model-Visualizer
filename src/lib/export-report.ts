import type { SemanticModel } from "./types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportModelAsHtml(model: SemanticModel): void {
  const totalColumns = model.tables.reduce((sum, t) => sum + t.columns.length, 0);
  const totalMeasures = model.tables.reduce((sum, t) => sum + t.measures.length, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(model.name)} - Semantic Model Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #0b1121;
    color: #e2e8f0;
    padding: 2rem;
    line-height: 1.6;
  }
  h1 { color: #60a5fa; margin-bottom: 0.5rem; }
  h2 { color: #3b82f6; margin: 2rem 0 1rem; border-bottom: 1px solid #1e293b; padding-bottom: 0.5rem; }
  h3 { color: #94a3b8; margin: 1.5rem 0 0.75rem; }
  .stats {
    display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0;
  }
  .stat {
    background: #111827; border: 1px solid #1e293b; border-radius: 8px;
    padding: 1rem 1.5rem; min-width: 140px;
  }
  .stat-value { font-size: 1.5rem; font-weight: 700; color: #60a5fa; }
  .stat-label { font-size: 0.875rem; color: #94a3b8; }
  table {
    width: 100%; border-collapse: collapse; margin: 1rem 0;
    background: #111827; border-radius: 8px; overflow: hidden;
  }
  th {
    background: #1e293b; padding: 0.75rem 1rem; text-align: left;
    font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;
  }
  td { padding: 0.75rem 1rem; border-top: 1px solid #1e293b; font-size: 0.875rem; }
  tr:hover td { background: rgba(59, 130, 246, 0.05); }
  .badge {
    display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px;
    font-size: 0.75rem; font-weight: 500;
  }
  .badge-import { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .badge-directlake { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
  .badge-directquery { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
  .badge-dual { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
  .badge-default { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
  .code {
    font-family: ui-monospace, monospace; background: #1e293b;
    padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.8rem;
  }
  .section { margin-bottom: 2rem; }
  .timestamp { color: #64748b; font-size: 0.75rem; margin-top: 2rem; }
</style>
</head>
<body>
  <h1>${escapeHtml(model.name)}</h1>
  <p style="color:#94a3b8;">Semantic Model Report</p>

  <h2>Summary</h2>
  <div class="stats">
    <div class="stat"><div class="stat-value">${model.tables.length}</div><div class="stat-label">Tables</div></div>
    <div class="stat"><div class="stat-value">${totalColumns}</div><div class="stat-label">Columns</div></div>
    <div class="stat"><div class="stat-value">${totalMeasures}</div><div class="stat-label">Measures</div></div>
    <div class="stat"><div class="stat-value">${model.relationships.length}</div><div class="stat-label">Relationships</div></div>
    <div class="stat"><div class="stat-value">${model.roles.length}</div><div class="stat-label">RLS Roles</div></div>
    <div class="stat"><div class="stat-value">${model.dataSources.length}</div><div class="stat-label">Data Sources</div></div>
  </div>

  <h2>Tables</h2>
  ${model.tables
    .map(
      (t) => `
  <div class="section">
    <h3>${escapeHtml(t.name)} ${t.isHidden ? '<span style="color:#64748b;">(hidden)</span>' : ""}</h3>
    ${t.description ? `<p style="color:#94a3b8;font-size:0.875rem;margin-bottom:0.5rem;">${escapeHtml(t.description)}</p>` : ""}
    <p style="font-size:0.8rem;color:#64748b;">Type: ${t.type} | Partition: ${t.partitions.map((p) => `<span class="badge badge-${p.mode}">${p.mode}</span>`).join(" ")}</p>
    ${
      t.columns.length > 0
        ? `<table>
      <thead><tr><th>Column</th><th>Data Type</th><th>Source</th><th>Hidden</th></tr></thead>
      <tbody>${t.columns
        .map(
          (c) =>
            `<tr><td>${escapeHtml(c.name)}</td><td><span class="code">${escapeHtml(c.dataType)}</span></td><td>${escapeHtml(c.sourceColumn || "")}</td><td>${c.isHidden ? "Yes" : ""}</td></tr>`
        )
        .join("")}</tbody>
    </table>`
        : ""
    }
    ${
      t.measures.length > 0
        ? `<table>
      <thead><tr><th>Measure</th><th>Expression</th><th>Folder</th></tr></thead>
      <tbody>${t.measures
        .map(
          (m) =>
            `<tr><td>${escapeHtml(m.name)}</td><td><span class="code">${escapeHtml(m.expression)}</span></td><td>${escapeHtml(m.displayFolder || "")}</td></tr>`
        )
        .join("")}</tbody>
    </table>`
        : ""
    }
  </div>`
    )
    .join("")}

  <h2>Relationships</h2>
  <table>
    <thead><tr><th>From</th><th>To</th><th>Cross Filter</th><th>Active</th></tr></thead>
    <tbody>${model.relationships
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.fromTable)}.${escapeHtml(r.fromColumn)}</td><td>${escapeHtml(r.toTable)}.${escapeHtml(r.toColumn)}</td><td>${r.crossFilteringBehavior}</td><td>${r.isActive ? "Yes" : "No"}</td></tr>`
      )
      .join("")}</tbody>
  </table>

  ${
    model.roles.length > 0
      ? `<h2>Row-Level Security Roles</h2>
  ${model.roles
    .map(
      (role) => `
  <div class="section">
    <h3>${escapeHtml(role.name)}</h3>
    ${role.description ? `<p style="color:#94a3b8;font-size:0.875rem;">${escapeHtml(role.description)}</p>` : ""}
    <p style="font-size:0.8rem;color:#64748b;">Permission: ${escapeHtml(role.modelPermission)}</p>
    ${
      role.tablePermissions.length > 0
        ? `<table>
      <thead><tr><th>Table</th><th>Filter Expression</th></tr></thead>
      <tbody>${role.tablePermissions
        .map(
          (tp) =>
            `<tr><td>${escapeHtml(tp.tableName)}</td><td><span class="code">${escapeHtml(tp.filterExpression)}</span></td></tr>`
        )
        .join("")}</tbody>
    </table>`
        : ""
    }
  </div>`
    )
    .join("")}`
      : ""
  }

  <div class="timestamp">Generated on ${new Date().toLocaleString()}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${model.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_report.html`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
