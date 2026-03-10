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
import { layeredLayout } from "./layout-utils";

const BASE_NODE_WIDTH = 380;
const BASE_COL_HEIGHT = 34;
const BASE_HEADER_HEIGHT = 52;
const MAX_VISIBLE_COLS = 12;

function TableNode({ data, selected }: { data: { label: string; columns: { name: string; type: string; isKey: boolean }[]; isCalculated: boolean; scale: number }; selected?: boolean }) {
  const displayCols = data.columns.slice(0, MAX_VISIBLE_COLS);
  const remaining = data.columns.length - MAX_VISIBLE_COLS;
  const s = data.scale || 1;

  return (
    <div
      className="rounded-lg overflow-hidden border shadow-lg relative"
      style={{
        borderColor: data.isCalculated ? "var(--color-accent-orange)" : "var(--color-primary)",
        width: "100%",
        height: "100%",
        minWidth: BASE_NODE_WIDTH * s,
      }}
    >
      <NodeResizer
        minWidth={250}
        minHeight={80}
        isVisible={!!selected}
        lineStyle={{ borderColor: "var(--color-primary)" }}
        handleStyle={{ backgroundColor: "var(--color-primary)", width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Top} style={{ background: "var(--color-primary)", width: 10, height: 10 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--color-primary)", width: 10, height: 10 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: "var(--color-primary)", width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: "var(--color-primary)", width: 10, height: 10 }} />
      <div
        className="font-bold truncate"
        style={{
          background: data.isCalculated ? "var(--color-accent-orange)" : "var(--color-primary)",
          color: "white",
          padding: `${14 * s}px ${22 * s}px`,
          fontSize: `${20 * s}px`,
        }}
      >
        {data.label}
      </div>
      <div style={{ background: "var(--color-surface)", overflow: "auto", flex: 1 }}>
        {displayCols.map((col, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b"
            style={{
              borderColor: "var(--color-border)",
              padding: `${8 * s}px ${22 * s}px`,
              fontSize: `${16 * s}px`,
            }}
          >
            <span className="truncate" style={{ color: col.isKey ? "var(--color-accent-orange)" : "var(--color-text)" }}>
              {col.isKey && "🔑 "}{col.name}
            </span>
            <span className="ml-3 shrink-0" style={{ color: "var(--color-primary-light)", fontSize: `${14 * s}px` }}>
              {col.type}
            </span>
          </div>
        ))}
        {remaining > 0 && (
          <div style={{ color: "var(--color-text-muted)", padding: `${10 * s}px ${22 * s}px`, fontSize: `${14 * s}px` }}>
            +{remaining} more...
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

function ErdDiagramInner({ nodes: initNodes, edges: initEdges, onNodeClick, selectedTable }: { nodes: Node[]; edges: Edge[]; onNodeClick?: (tableName: string) => void; selectedTable?: string | null }) {
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  // Highlight edges connected to the selected node
  const styledEdges = useMemo(() => {
    if (!selectedTable) return edges;
    return edges.map((edge) => {
      const isConnected = edge.source === selectedTable || edge.target === selectedTable;
      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: isConnected ? "#BF4646" : (edge.style?.stroke || "#7EACB5"),
          strokeWidth: isConnected ? 3 : (edge.style?.strokeWidth || 2),
          opacity: isConnected ? 1 : 0.25,
        },
        animated: isConnected ? true : edge.animated,
      };
    });
  }, [edges, selectedTable]);

  // Dim unrelated nodes
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
        nodeColor={(n) => n.data?.isCalculated ? "#D4874D" : "#7EACB5"}
        maskColor="rgba(247, 247, 244, 0.7)"
        pannable
        zoomable
      />
    </ReactFlow>
  );
}

export default function ErdDiagram({ onNodeClick, selectedTable, nodeScale = 1 }: { onNodeClick?: (tableName: string) => void; selectedTable?: string | null; nodeScale?: number }) {
  const { model, obfuscateName } = useModel();

  const { nodes, edges, key } = useMemo(() => {
    if (!model) return { nodes: [], edges: [], key: "empty" };

    const s = nodeScale;
    const nodeWidth = BASE_NODE_WIDTH * s;
    const headerHeight = BASE_HEADER_HEIGHT * s;
    const colHeight = BASE_COL_HEIGHT * s;

    const keyCols = new Set<string>();
    for (const rel of model.relationships) {
      keyCols.add(`${rel.fromTable}.${rel.fromColumn}`);
      keyCols.add(`${rel.toTable}.${rel.toColumn}`);
    }

    const layoutNodes = model.tables.map((table) => {
      const visibleCols = Math.min(table.columns.length, MAX_VISIBLE_COLS);
      return {
        id: table.name,
        width: nodeWidth,
        height: headerHeight + visibleCols * colHeight + (table.columns.length > MAX_VISIBLE_COLS ? 20 * s : 0),
      };
    });

    const layoutEdges = model.relationships.map((rel) => ({
      source: rel.fromTable,
      target: rel.toTable,
    }));

    const positions = layeredLayout(layoutNodes, layoutEdges, {
      horizontalSpacing: 200 * s,
      verticalSpacing: 160 * s,
      direction: "TB",
    });

    const n: Node[] = model.tables.map((table) => ({
      id: table.name,
      type: "tableNode",
      position: positions[table.name] || { x: 0, y: 0 },
      data: {
        label: obfuscateName(table.name, "Table"),
        columns: table.columns.map((col) => ({
          name: obfuscateName(col.name, "Column"),
          type: col.dataType,
          isKey: keyCols.has(`${table.name}.${col.name}`),
        })),
        isCalculated: table.type === "calculated",
        scale: s,
      },
    }));

    const e: Edge[] = model.relationships.map((rel, i) => {
      const fromCol = obfuscateName(rel.fromColumn, "Column");
      const toCol = obfuscateName(rel.toColumn, "Column");
      const colLabel = fromCol === toCol ? fromCol : `${fromCol} → ${toCol}`;
      const inactivePrefix = rel.isActive ? "" : "[inactive] ";
      return {
        id: `erd-rel-${i}`,
        source: rel.fromTable,
        target: rel.toTable,
        type: "default",
        animated: rel.crossFilteringBehavior === "bothDirections",
        style: {
          stroke: rel.crossFilteringBehavior === "bothDirections" ? "#D4874D" : "#7EACB5",
          strokeWidth: 2,
        },
        label: `${inactivePrefix}${colLabel}`,
        labelStyle: { fill: "rgba(38, 37, 30, 0.55)", fontSize: 14, fontWeight: 500 },
        labelBgStyle: { fill: "#f7f7f4", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
      };
    });

    return { nodes: n, edges: e, key: `erd-${model.name}-${nodeScale}-${Date.now()}` };
  }, [model, obfuscateName, nodeScale]);

  if (!model) return null;

  return (
    <div className="w-full h-full">
      <ErdDiagramInner key={key} nodes={nodes} edges={edges} onNodeClick={onNodeClick} selectedTable={selectedTable} />
      <div className="absolute top-4 left-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs space-y-1.5 z-10">
        <div className="font-semibold text-[var(--color-text)] mb-2">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[var(--color-primary)]" />
          <span className="text-[var(--color-text-muted)]">Entity / Direct Lake</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[var(--color-accent-orange)]" />
          <span className="text-[var(--color-text-muted)]">Calculated / Import</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-accent-orange)]">🔑</span>
          <span className="text-[var(--color-text-muted)]">Relationship key</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0 border-t-2 border-dashed border-[var(--color-accent-orange)]" />
          <span className="text-[var(--color-text-muted)]">Bidirectional filter</span>
        </div>
      </div>
    </div>
  );
}
