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
import { extractDataSources } from "@/lib/analysis";

function SourceNode({ data, selected }: { data: { label: string; type: string; url?: string }; selected?: boolean }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--color-accent-green)] shadow-lg relative" style={{ width: "100%", height: "100%", minWidth: 240 }}>
      <NodeResizer
        minWidth={200}
        minHeight={60}
        isVisible={!!selected}
        lineStyle={{ borderColor: "#6A9E6E" }}
        handleStyle={{ backgroundColor: "#6A9E6E", width: 8, height: 8 }}
      />
      <Handle type="source" position={Position.Right} style={{ background: "#6A9E6E", width: 8, height: 8 }} />
      <div className="px-4 py-3" style={{ background: "#3D6B42" }}>
        <div className="text-base font-bold text-white">{data.label}</div>
      </div>
      <div className="px-4 py-2 space-y-1" style={{ background: "var(--color-surface)" }}>
        <div className="text-sm text-[var(--color-text-muted)]">Type: {data.type}</div>
        {data.url && (
          <div className="text-xs text-[var(--color-primary-light)] truncate max-w-[220px]">{data.url}</div>
        )}
      </div>
    </div>
  );
}

function TableGroupNode({ data, selected }: { data: { label: string; tables: string[]; count: number; badge: string }; selected?: boolean }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--color-border)] shadow-lg relative" style={{ width: "100%", height: "100%", minWidth: 200 }}>
      <NodeResizer
        minWidth={180}
        minHeight={60}
        isVisible={!!selected}
        lineStyle={{ borderColor: "#7EACB5" }}
        handleStyle={{ backgroundColor: "#7EACB5", width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Left} style={{ background: "#7EACB5", width: 8, height: 8 }} />
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: "var(--color-surface-light)" }}>
        <span className="text-sm font-bold text-[var(--color-text)]">{data.label}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary-light)]">
          {data.count}
        </span>
      </div>
      <div className="px-4 py-2" style={{ background: "var(--color-surface)" }}>
        {data.tables.map((t, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
            <span className="text-[var(--color-text)]">{t}</span>
            <span className="text-xs px-1 rounded" style={{
              background: data.badge === "DL" ? "rgba(106,158,110,0.2)" : "rgba(212,135,77,0.2)",
              color: data.badge === "DL" ? "#6A9E6E" : "#D4874D",
            }}>
              {data.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = {
  sourceNode: SourceNode,
  tableGroupNode: TableGroupNode,
};

function DataSourcesInner({ nodes: initNodes, edges: initEdges }: { nodes: Node[]; edges: Edge[] }) {
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
      defaultEdgeOptions={{ type: "default" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(38, 37, 30, 0.06)" />
      <Controls />
      <MiniMap maskColor="rgba(247, 247, 244, 0.7)" pannable zoomable />
    </ReactFlow>
  );
}

export default function DataSourcesDiagram() {
  const { model, obfuscateName } = useModel();

  const { nodes, edges, key } = useMemo(() => {
    if (!model) return { nodes: [], edges: [], key: "empty" };

    const sources = extractDataSources(model);
    const n: Node[] = [];
    const e: Edge[] = [];
    let y = 0;

    sources.forEach((source, i) => {
      const sourceId = `source-${i}`;
      const groupId = `group-${i}`;
      const isCalculated = source.name === "DAX Engine";

      n.push({
        id: sourceId,
        type: "sourceNode",
        position: { x: 0, y },
        data: {
          label: source.name,
          type: source.type,
          url: source.url,
        },
      });

      n.push({
        id: groupId,
        type: "tableGroupNode",
        position: { x: 450, y },
        data: {
          label: `${source.tables.length} ${source.name} Tables`,
          tables: source.tables.map((t) => obfuscateName(t, "Table")),
          count: source.tables.length,
          badge: isCalculated ? "IMP" : "DL",
        },
      });

      e.push({
        id: `ds-edge-${i}`,
        source: sourceId,
        target: groupId,
        type: "default",
        animated: true,
        style: {
          stroke: isCalculated ? "#D4874D" : "#9B7AA0",
          strokeWidth: 2,
          strokeDasharray: "8 4",
        },
        label: isCalculated ? "DATATABLE / DAX" : "Direct Lake",
        labelStyle: { fill: isCalculated ? "#D4874D" : "#9B7AA0", fontSize: 14 },
        labelBgStyle: { fill: "#f7f7f4", fillOpacity: 0.9 },
      });

      y += Math.max(100, source.tables.length * 24 + 60) + 40;
    });

    return { nodes: n, edges: e, key: `ds-${model.name}-${Date.now()}` };
  }, [model, obfuscateName]);

  if (!model) return null;

  return (
    <div className="w-full h-full">
      <DataSourcesInner key={key} nodes={nodes} edges={edges} />
      <div className="absolute top-4 left-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs space-y-1.5">
        <div className="font-semibold text-[var(--color-text)] mb-2">Data Pipeline</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--color-accent-green)]" />
          <span className="text-[var(--color-text-muted)]">Data Source</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface-light)] border border-[var(--color-border)]" />
          <span className="text-[var(--color-text-muted)]">Table Group</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-6 h-0 border-t-2 border-dashed border-[var(--color-accent-purple)]" />
          <span className="text-[var(--color-text-muted)]">Direct Lake</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0 border-t-2 border-dashed border-[var(--color-accent-orange)]" />
          <span className="text-[var(--color-text-muted)]">Calculated / DAX</span>
        </div>
      </div>
    </div>
  );
}
