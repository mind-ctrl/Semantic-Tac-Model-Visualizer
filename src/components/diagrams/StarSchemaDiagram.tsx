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
import { classifyTables } from "@/lib/analysis";
import type { TableClassification } from "@/lib/types";

const roleColors: Record<string, string> = {
  fact: "#9B7AA0",
  dimension: "#7EACB5",
  bridge: "#D4874D",
  measure: "#6A9E6E",
  utility: "#B09A86",
};

const roleLabels: Record<string, string> = {
  fact: "Fact",
  dimension: "Dim",
  bridge: "Bridge",
  measure: "Measures",
  utility: "Utility",
};

const BASE_STAR_W = 340;
const BASE_STAR_H = 140;

function SchemaNode({ data, selected }: { data: { label: string; role: string; columns: number; measures: number; partitionMode: string; scale: number }; selected?: boolean }) {
  const color = roleColors[data.role] || roleColors.utility;
  const s = data.scale || 1;
  return (
    <div className="rounded-lg overflow-hidden border shadow-lg relative" style={{ borderColor: color, width: "100%", height: "100%", minWidth: BASE_STAR_W * s }}>
      <NodeResizer
        minWidth={200}
        minHeight={80}
        isVisible={!!selected}
        lineStyle={{ borderColor: color }}
        handleStyle={{ backgroundColor: color, width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Top} style={{ background: color, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 10, height: 10 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: color, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: color, width: 10, height: 10 }} />
      <div className="flex items-center justify-between" style={{ background: color, padding: `${14 * s}px ${24 * s}px` }}>
        <span className="font-bold text-white truncate" style={{ fontSize: `${20 * s}px` }}>{data.label}</span>
        <span className="text-white/80 ml-3 shrink-0" style={{ fontSize: `${16 * s}px` }}>{roleLabels[data.role]}</span>
      </div>
      <div style={{ background: "var(--color-surface)", padding: `${16 * s}px ${24 * s}px` }}>
        <div className="flex items-center gap-4 text-[var(--color-text-muted)]" style={{ fontSize: `${16 * s}px`, marginBottom: `${10 * s}px` }}>
          <span>{data.columns} columns</span>
          {data.measures > 0 && <span>{data.measures} measures</span>}
        </div>
        <div>
          <span
            className="rounded font-medium"
            style={{
              background: data.partitionMode === "directLake" ? "rgba(106,158,110,0.2)" : "rgba(212,135,77,0.2)",
              color: data.partitionMode === "directLake" ? "#6A9E6E" : "#D4874D",
              fontSize: `${14 * s}px`,
              padding: `${2 * s}px ${8 * s}px`,
            }}
          >
            {data.partitionMode}
          </span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { schemaNode: SchemaNode };

function StarSchemaInner({ nodes: initNodes, edges: initEdges, onNodeClick, selectedTable }: { nodes: Node[]; edges: Edge[]; onNodeClick?: (tableName: string) => void; selectedTable?: string | null }) {
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  const styledEdges = useMemo(() => {
    if (!selectedTable) return edges;
    return edges.map((edge) => {
      const isConnected = edge.source === selectedTable || edge.target === selectedTable;
      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: isConnected ? "#BF4646" : (edge.style?.stroke || "#7EACB580"),
          strokeWidth: isConnected ? 3 : (edge.style?.strokeWidth || 2),
          opacity: isConnected ? 1 : 0.25,
        },
        animated: isConnected ? true : edge.animated,
      };
    });
  }, [edges, selectedTable]);

  const styledNodes = useMemo(() => {
    if (!selectedTable) return nodes;
    const connectedTables = new Set<string>([selectedTable]);
    for (const edge of edges) {
      if (edge.source === selectedTable) connectedTables.add(edge.target);
      if (edge.target === selectedTable) connectedTables.add(edge.source);
    }
    return nodes.map((node) => ({
      ...node,
      style: {
        ...node.style,
        opacity: connectedTables.has(node.id) ? 1 : 0.3,
      },
    }));
  }, [nodes, edges, selectedTable]);

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={styledEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onNodeClick?.(node.id)}
      fitView
      fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1 }}
      minZoom={0.3}
      maxZoom={2}
      defaultEdgeOptions={{ type: "default" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(38, 37, 30, 0.06)" />
      <Controls />
      <MiniMap
        nodeColor={(n) => roleColors[n.data?.role as string] || "#B09A86"}
        maskColor="rgba(247, 247, 244, 0.7)"
        pannable
        zoomable
      />
    </ReactFlow>
  );
}

export default function StarSchemaDiagram({ onNodeClick, selectedTable, nodeScale = 1 }: { onNodeClick?: (tableName: string) => void; selectedTable?: string | null; nodeScale?: number }) {
  const { model, obfuscateName } = useModel();

  const { nodes, edges, key } = useMemo(() => {
    if (!model) return { nodes: [], edges: [], key: "empty" };

    const s = nodeScale;
    const classifications = classifyTables(model);

    // Build a lookup of relationships per table
    const relsByTable = new Map<string, Set<string>>();
    for (const rel of model.relationships) {
      if (!relsByTable.has(rel.fromTable)) relsByTable.set(rel.fromTable, new Set());
      if (!relsByTable.has(rel.toTable)) relsByTable.set(rel.toTable, new Set());
      relsByTable.get(rel.fromTable)!.add(rel.toTable);
      relsByTable.get(rel.toTable)!.add(rel.fromTable);
    }

    const classMap = new Map<string, TableClassification>();
    for (const c of classifications) classMap.set(c.table.name, c);

    // Separate by role
    const facts = classifications.filter((c) => c.role === "fact");
    const dims = classifications.filter((c) => c.role === "dimension");
    const bridges = classifications.filter((c) => c.role === "bridge");
    const measures = classifications.filter((c) => c.role === "measure");
    const utilities = classifications.filter((c) => c.role === "utility");

    const positions: Record<string, { x: number; y: number }> = {};
    const NODE_W = BASE_STAR_W * s;
    const NODE_H = BASE_STAR_H * s;
    const DIM_RADIUS = 560 * s;
    const FACT_SPACING = 1300 * s;

    if (facts.length === 0) {
      // No facts — lay out everything in a circle
      const all = classifications;
      const radius = Math.max(300, all.length * 40);
      all.forEach((c, i) => {
        const angle = (2 * Math.PI * i) / all.length - Math.PI / 2;
        positions[c.table.name] = {
          x: Math.cos(angle) * radius - NODE_W / 2,
          y: Math.sin(angle) * radius - NODE_H / 2,
        };
      });
    } else {
      // Place each fact table, then arrange its connected dimensions around it
      const assignedDims = new Set<string>();

      facts.forEach((fact, fi) => {
        const cx = fi * FACT_SPACING;
        const cy = 0;
        positions[fact.table.name] = { x: cx - NODE_W / 2, y: cy - NODE_H / 2 };

        // Find dimensions connected to this fact
        const connectedNames = relsByTable.get(fact.table.name) || new Set();
        const factDims = dims.filter(
          (d) => connectedNames.has(d.table.name) && !assignedDims.has(d.table.name)
        );
        // Also include bridges connected to this fact
        const factBridges = bridges.filter(
          (b) => connectedNames.has(b.table.name) && !assignedDims.has(b.table.name)
        );
        const ring = [...factDims, ...factBridges];

        ring.forEach((d, di) => {
          assignedDims.add(d.table.name);
          const angle = (2 * Math.PI * di) / ring.length - Math.PI / 2;
          positions[d.table.name] = {
            x: cx + Math.cos(angle) * DIM_RADIUS - NODE_W / 2,
            y: cy + Math.sin(angle) * DIM_RADIUS - NODE_H / 2,
          };
        });
      });

      // Place unassigned dimensions that aren't connected to any fact
      const unassignedDims = dims.filter((d) => !assignedDims.has(d.table.name));
      const unassignedBridges = bridges.filter((b) => !assignedDims.has(b.table.name));
      const remaining = [...unassignedDims, ...unassignedBridges, ...measures, ...utilities];

      if (remaining.length > 0) {
        // Place them in a row below the main star clusters
        const startX = -((remaining.length - 1) * (NODE_W + 40)) / 2;
        const bottomY = DIM_RADIUS + 250;
        remaining.forEach((c, i) => {
          positions[c.table.name] = {
            x: startX + i * (NODE_W + 40),
            y: bottomY,
          };
        });
      }
    }

    const n: Node[] = classifications.map((c) => ({
      id: c.table.name,
      type: "schemaNode",
      position: positions[c.table.name] || { x: 0, y: 0 },
      data: {
        label: obfuscateName(c.table.name, "Table"),
        role: c.role,
        columns: c.table.columns.length,
        measures: c.table.measures.length,
        partitionMode: c.partitionMode,
        scale: s,
      },
    }));

    const e: Edge[] = model.relationships.map((rel, i) => ({
      id: `star-rel-${i}`,
      source: rel.fromTable,
      target: rel.toTable,
      animated: rel.crossFilteringBehavior === "bothDirections",
      style: {
        stroke: rel.crossFilteringBehavior === "bothDirections" ? "#D4874D" : "#7EACB580",
        strokeWidth: 2,
      },
      label: `${obfuscateName(rel.fromColumn, "Column")} = ${obfuscateName(rel.toColumn, "Column")}`,
      labelStyle: { fill: "rgba(38, 37, 30, 0.55)", fontSize: 14 * s, fontWeight: 500 },
      labelBgStyle: { fill: "#f7f7f4", fillOpacity: 0.9 },
    }));

    return { nodes: n, edges: e, key: `star-${model.name}-${nodeScale}-${Date.now()}` };
  }, [model, obfuscateName, nodeScale]);

  if (!model) return null;

  return (
    <div className="w-full h-full">
      <StarSchemaInner key={key} nodes={nodes} edges={edges} onNodeClick={onNodeClick} selectedTable={selectedTable} />
      <div className="absolute top-4 left-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs space-y-1.5">
        <div className="font-semibold text-[var(--color-text)] mb-2">Schema Roles</div>
        {Object.entries(roleColors).map(([role, color]) => (
          <div key={role} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-[var(--color-text-muted)] capitalize">{roleLabels[role] || role}</span>
          </div>
        ))}
        <div className="border-t border-[var(--color-border)] pt-1.5 mt-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-[var(--color-primary)]" />
            <span className="text-[var(--color-text-muted)]">Fact relationship</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-0 border-t-2 border-dashed border-[var(--color-accent-orange)]" />
            <span className="text-[var(--color-text-muted)]">Bidirectional</span>
          </div>
        </div>
      </div>
    </div>
  );
}
