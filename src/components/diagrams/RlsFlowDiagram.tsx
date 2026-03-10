"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeResizer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useModel } from "@/lib/model-context";
import { analyzeRlsFlow } from "@/lib/analysis";

function RlsRoleNode({ data, selected }: { data: { roleName: string; permission: string; filters: string; expression: string }; selected?: boolean }) {
  return (
    <div className="rounded-lg overflow-hidden border-2 border-[var(--color-accent-red)] shadow-lg relative" style={{ width: "100%", height: "100%", minWidth: 220 }}>
      <NodeResizer
        minWidth={200}
        minHeight={80}
        isVisible={!!selected}
        lineStyle={{ borderColor: "#BF4646" }}
        handleStyle={{ backgroundColor: "#BF4646", width: 8, height: 8 }}
      />
      <Handle type="source" position={Position.Right} style={{ background: "#BF4646", width: 8, height: 8 }} />
      <div className="px-3 py-2" style={{ background: "rgba(191, 70, 70, 0.12)" }}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-accent-red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm font-bold text-[var(--color-accent-red)]">{data.roleName}</span>
        </div>
      </div>
      <div className="px-3 py-2 space-y-1" style={{ background: "var(--color-surface)" }}>
        <div className="text-sm text-[var(--color-text-muted)]">PERMISSION: {data.permission}</div>
        <div className="text-sm text-[var(--color-text-muted)]">FILTERS: {data.filters}</div>
        {data.expression && (
          <div className="text-xs font-mono text-[var(--color-text-muted)] mt-1 bg-[var(--color-background)] px-2 py-1 rounded break-all" style={{ maxWidth: 300 }}>
            {data.expression}
          </div>
        )}
      </div>
    </div>
  );
}

function FilteredTableNode({ data, selected }: { data: { label: string; columns: number; partitionMode: string; filterType: "direct" | "downstream" | "unaffected" }; selected?: boolean }) {
  const borderColor = data.filterType === "direct" ? "#D4874D" : data.filterType === "downstream" ? "#D4874D" : "var(--color-border)";
  const bgColor = data.filterType === "direct" ? "rgba(212, 135, 77, 0.1)" : data.filterType === "downstream" ? "rgba(212, 135, 77, 0.05)" : "var(--color-surface)";
  const badgeText = data.filterType === "direct" ? "Filtered" : data.filterType === "downstream" ? "Downstream" : "";

  return (
    <div className="rounded-lg overflow-hidden border shadow-lg relative" style={{ borderColor, width: "100%", height: "100%", minWidth: 170, background: bgColor }}>
      <NodeResizer
        minWidth={150}
        minHeight={60}
        isVisible={!!selected}
        lineStyle={{ borderColor: "#D4874D" }}
        handleStyle={{ backgroundColor: "#D4874D", width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Top} style={{ background: "#D4874D", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#D4874D", width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: "#D4874D", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: "#D4874D", width: 8, height: 8 }} />
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--color-text)]">{data.label}</span>
        {badgeText && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(212, 135, 77, 0.2)", color: "#D4874D" }}>
            {badgeText}
          </span>
        )}
      </div>
      <div className="px-3 py-1 text-sm text-[var(--color-text-muted)]">
        {data.columns} cols
        {data.partitionMode !== "default" && (
          <span className="ml-2 text-xs px-1 rounded"
            style={{
              background: data.partitionMode === "directLake" ? "rgba(106,158,110,0.2)" : "rgba(212,135,77,0.2)",
              color: data.partitionMode === "directLake" ? "#6A9E6E" : "#D4874D",
            }}>
            {data.partitionMode}
          </span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  rlsRoleNode: RlsRoleNode,
  filteredTableNode: FilteredTableNode,
};

function RlsFlowInner({ nodes: initNodes, edges: initEdges }: { nodes: Node[]; edges: Edge[] }) {
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1 }}
      minZoom={0.3}
      maxZoom={2}
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(38, 37, 30, 0.06)" />
      <Controls />
      <MiniMap maskColor="rgba(247, 247, 244, 0.7)" pannable zoomable />
    </ReactFlow>
  );
}

export default function RlsFlowDiagram() {
  const { model, obfuscateName, reduceToSemantics } = useModel();

  const { nodes, edges, key } = useMemo(() => {
    if (!model || model.roles.length === 0) return { nodes: [], edges: [], key: "empty" };

    const flows = analyzeRlsFlow(model);
    const n: Node[] = [];
    const e: Edge[] = [];

    const allDirectlyFiltered = new Set(flows.flatMap((f) => f.directlyFiltered));
    const allDownstream = new Set(flows.flatMap((f) => f.downstreamFiltered));

    const COL_ROLE = 0;
    const COL_DIRECT = 500;
    const COL_DOWNSTREAM = 1000;
    const COL_UNAFFECTED = 1500;
    const ROW_HEIGHT = 140;

    let roleY = 0;
    for (const flow of flows) {
      const roleId = `role-${flow.role.name}`;
      const filterTableNames = flow.role.tablePermissions.map((p) => p.tableName).join(", ");
      const firstExpr = flow.role.tablePermissions[0]?.filterExpression || "";

      n.push({
        id: roleId,
        type: "rlsRoleNode",
        position: { x: COL_ROLE, y: roleY },
        data: {
          roleName: obfuscateName(flow.role.name, "Role"),
          permission: flow.role.modelPermission,
          filters: obfuscateName(filterTableNames, "Table"),
          expression: reduceToSemantics ? "[hidden]" : firstExpr.slice(0, 100),
        },
      });

      for (const tableName of flow.directlyFiltered) {
        e.push({
          id: `${roleId}->${tableName}`,
          source: roleId,
          target: tableName,
          style: { stroke: "#BF4646", strokeWidth: 2 },
          label: "RLS filter",
          labelStyle: { fill: "#BF4646", fontSize: 13 },
          labelBgStyle: { fill: "#f7f7f4", fillOpacity: 0.9 },
        });
      }

      roleY += 280;
    }

    let directY = 0;
    let downstreamY = 0;
    let unaffectedY = 0;

    for (const table of model.tables) {
      let filterType: "direct" | "downstream" | "unaffected" = "unaffected";
      let x: number;
      let y: number;

      if (allDirectlyFiltered.has(table.name)) {
        filterType = "direct";
        x = COL_DIRECT;
        y = directY;
        directY += ROW_HEIGHT;
      } else if (allDownstream.has(table.name)) {
        filterType = "downstream";
        x = COL_DOWNSTREAM;
        y = downstreamY;
        downstreamY += ROW_HEIGHT;
      } else {
        filterType = "unaffected";
        x = COL_UNAFFECTED;
        y = unaffectedY;
        unaffectedY += ROW_HEIGHT;
      }

      n.push({
        id: table.name,
        type: "filteredTableNode",
        position: { x, y },
        data: {
          label: obfuscateName(table.name, "Table"),
          columns: table.columns.length,
          partitionMode: table.partitions[0]?.mode || "default",
          filterType,
        },
      });
    }

    for (const rel of model.relationships) {
      const isRelevant = allDirectlyFiltered.has(rel.toTable) || allDownstream.has(rel.toTable) ||
        allDirectlyFiltered.has(rel.fromTable) || allDownstream.has(rel.fromTable);

      e.push({
        id: `rls-rel-${rel.fromTable}-${rel.toTable}`,
        source: rel.toTable,
        target: rel.fromTable,
        style: {
          stroke: isRelevant ? "#D4874D" : "rgba(38, 37, 30, 0.08)",
          strokeWidth: isRelevant ? 2 : 1,
          strokeDasharray: rel.isActive ? undefined : "5 5",
        },
        animated: isRelevant,
      });
    }

    return { nodes: n, edges: e, key: `rls-${model.name}-${Date.now()}` };
  }, [model, obfuscateName, reduceToSemantics]);

  if (!model || model.roles.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
        No RLS roles defined in this model.
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <RlsFlowInner key={key} nodes={nodes} edges={edges} />
      <div className="absolute top-4 left-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs space-y-1.5">
        <div className="font-semibold text-[var(--color-text)] mb-2">RLS Filter Flow</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--color-accent-red)]" />
          <span className="text-[var(--color-text-muted)]">RLS Role</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-accent-orange)]" />
          <span className="text-[var(--color-text-muted)]">Directly Filtered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-accent-orange)]/50" />
          <span className="text-[var(--color-text-muted)]">Downstream (via relationships)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface-light)]" />
          <span className="text-[var(--color-text-muted)]">Unaffected</span>
        </div>
        <div className="border-t border-[var(--color-border)] pt-1.5 mt-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-[var(--color-accent-red)]" />
            <span className="text-[var(--color-text-muted)]">Filter propagation</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-0 border-t-2 border-dashed border-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-muted)]">Inactive relationship</span>
          </div>
        </div>
      </div>
    </div>
  );
}
