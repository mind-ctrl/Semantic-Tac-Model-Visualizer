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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useModel } from "@/lib/model-context";
import { analyzeMeasureDependencies } from "@/lib/analysis";
import { layeredLayout } from "./layout-utils";

function MeasureNode({ data }: { data: { label: string; tableName: string; depCount: number; expression: string } }) {
  const intensity = Math.min(data.depCount, 5);
  const borderColor = intensity >= 3 ? "#ef4444" : intensity >= 1 ? "#f59e0b" : "#3b82f6";

  return (
    <div className="rounded-lg overflow-hidden border shadow-lg relative" style={{ borderColor, minWidth: 180 }}>
      <Handle type="target" position={Position.Top} style={{ background: borderColor, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: borderColor, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: borderColor, width: 8, height: 8 }} />
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: "var(--color-surface-light)" }}>
        <span className="text-[11px] font-bold text-[var(--color-text)] truncate max-w-[140px]">{data.label}</span>
        {data.depCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium ml-1"
            style={{ background: `${borderColor}20`, color: borderColor }}>
            {data.depCount} deps
          </span>
        )}
      </div>
      <div className="px-3 py-1" style={{ background: "var(--color-surface)" }}>
        <div className="text-[9px] text-[var(--color-text-muted)]">{data.tableName}</div>
        {data.expression && (
          <div className="text-[9px] font-mono text-[var(--color-text-muted)] mt-1 truncate max-w-[170px]">
            {data.expression}
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnNode({ data }: { data: { label: string; tableName: string } }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] px-3 py-1.5 shadow relative" style={{ background: "var(--color-surface)" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#3b82f6", width: 6, height: 6 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: "#3b82f6", width: 6, height: 6 }} />
      <div className="text-[10px] text-[var(--color-primary-light)]">{data.tableName}</div>
      <div className="text-[11px] text-[var(--color-text)]">{data.label}</div>
    </div>
  );
}

const nodeTypes = {
  measureNode: MeasureNode,
  columnNode: ColumnNode,
};

function DaxDependenciesInner({ nodes: initNodes, edges: initEdges }: { nodes: Node[]; edges: Edge[] }) {
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
      minZoom={0.1}
      maxZoom={2}
      defaultEdgeOptions={{ type: "default" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
      <Controls />
      <MiniMap maskColor="rgba(11, 17, 33, 0.8)" />
    </ReactFlow>
  );
}

export default function DaxDependenciesDiagram() {
  const { model, obfuscateName, reduceToSemantics } = useModel();

  const { nodes, edges, key } = useMemo(() => {
    if (!model) return { nodes: [], edges: [], key: "empty" };

    const deps = analyzeMeasureDependencies(model);
    const n: Node[] = [];
    const e: Edge[] = [];
    const addedNodes = new Set<string>();

    const involvedMeasures = new Set<string>();
    for (const dep of deps) {
      if (dep.dependsOnMeasures.length > 0 || dep.dependsOnColumns.length > 0) {
        involvedMeasures.add(`${dep.tableName}.${dep.measure.name}`);
        for (const m of dep.dependsOnMeasures) {
          involvedMeasures.add(`${m.tableName}.${m.measureName}`);
        }
      }
    }

    for (const dep of deps) {
      for (const m of dep.dependsOnMeasures) {
        involvedMeasures.add(`${m.tableName}.${m.measureName}`);
      }
    }

    if (involvedMeasures.size === 0) {
      return { nodes: [], edges: [], key: "empty" };
    }

    const layoutNodes: { id: string; width: number; height: number }[] = [];

    for (const dep of deps) {
      const nodeId = `m:${dep.tableName}.${dep.measure.name}`;
      if (!involvedMeasures.has(`${dep.tableName}.${dep.measure.name}`)) continue;
      if (addedNodes.has(nodeId)) continue;
      addedNodes.add(nodeId);

      layoutNodes.push({ id: nodeId, width: 180, height: 60 });
      n.push({
        id: nodeId,
        type: "measureNode",
        position: { x: 0, y: 0 },
        data: {
          label: obfuscateName(dep.measure.name, "Measure"),
          tableName: obfuscateName(dep.tableName, "Table"),
          depCount: dep.dependsOnMeasures.length + dep.dependsOnColumns.length,
          expression: reduceToSemantics ? "" : (dep.measure.expression || "").slice(0, 60),
        },
      });

      for (const m of dep.dependsOnMeasures) {
        const targetId = `m:${m.tableName}.${m.measureName}`;
        e.push({
          id: `dax-${nodeId}->${targetId}`,
          source: nodeId,
          target: targetId,
          style: { stroke: "#f59e0b", strokeWidth: 1.5 },
          animated: true,
        });

        if (!addedNodes.has(targetId)) {
          addedNodes.add(targetId);
          layoutNodes.push({ id: targetId, width: 180, height: 60 });
          const targetDep = deps.find((d) => d.tableName === m.tableName && d.measure.name === m.measureName);
          n.push({
            id: targetId,
            type: "measureNode",
            position: { x: 0, y: 0 },
            data: {
              label: obfuscateName(m.measureName, "Measure"),
              tableName: obfuscateName(m.tableName, "Table"),
              depCount: targetDep ? targetDep.dependsOnMeasures.length + targetDep.dependsOnColumns.length : 0,
              expression: "",
            },
          });
        }
      }

      const colDeps = dep.dependsOnColumns.slice(0, 5);
      for (const c of colDeps) {
        const colId = `c:${c.tableName}.${c.columnName}`;
        if (!addedNodes.has(colId)) {
          addedNodes.add(colId);
          layoutNodes.push({ id: colId, width: 140, height: 40 });
          n.push({
            id: colId,
            type: "columnNode",
            position: { x: 0, y: 0 },
            data: {
              label: obfuscateName(c.columnName, "Column"),
              tableName: obfuscateName(c.tableName, "Table"),
            },
          });
        }

        e.push({
          id: `dax-${nodeId}->${colId}`,
          source: nodeId,
          target: colId,
          style: { stroke: "#3b82f680", strokeWidth: 1 },
        });
      }
    }

    const layoutEdges = e.map((edge) => ({ source: edge.source, target: edge.target }));
    const positions = layeredLayout(layoutNodes, layoutEdges, {
      horizontalSpacing: 60,
      verticalSpacing: 80,
    });

    for (const node of n) {
      const pos = positions[node.id];
      if (pos) {
        node.position = pos;
      }
    }

    return { nodes: n, edges: e, key: `dax-${model.name}-${Date.now()}` };
  }, [model, obfuscateName, reduceToSemantics]);

  if (!model) return null;

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
        No measure dependencies found (measures may not reference other measures).
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <DaxDependenciesInner key={key} nodes={nodes} edges={edges} />
      <div className="absolute top-4 left-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs space-y-1.5">
        <div className="font-semibold text-[var(--color-text)] mb-2">DAX Dependencies</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface-light)] border border-[#3b82f6]" />
          <span className="text-[var(--color-text-muted)]">Measure (0 deps)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface-light)] border border-[#f59e0b]" />
          <span className="text-[var(--color-text-muted)]">Measure (1-2 deps)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface-light)] border border-[#ef4444]" />
          <span className="text-[var(--color-text-muted)]">Measure (3+ deps)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface)] border border-[var(--color-border)]" />
          <span className="text-[var(--color-text-muted)]">Column reference</span>
        </div>
        <div className="border-t border-[var(--color-border)] pt-1.5 mt-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-[#f59e0b]" />
            <span className="text-[var(--color-text-muted)]">Measure dependency</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-0 border-t border-[#3b82f6]" />
            <span className="text-[var(--color-text-muted)]">Column dependency</span>
          </div>
        </div>
      </div>
    </div>
  );
}
