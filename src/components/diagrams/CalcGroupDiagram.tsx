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

function CalcGroupNode({ data, selected }: { data: { label: string; precedence: number; itemCount: number }; selected?: boolean }) {
  return (
    <div className="rounded-lg overflow-hidden border-2 border-[var(--color-accent-purple)] shadow-lg relative" style={{ width: "100%", height: "100%", minWidth: 220 }}>
      <NodeResizer
        minWidth={180}
        minHeight={70}
        isVisible={!!selected}
        lineStyle={{ borderColor: "#9B7AA0" }}
        handleStyle={{ backgroundColor: "#9B7AA0", width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Top} style={{ background: "#9B7AA0", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#9B7AA0", width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: "#9B7AA0", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: "#9B7AA0", width: 8, height: 8 }} />
      <div className="px-3 py-2" style={{ background: "rgba(155, 122, 160, 0.12)" }}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-bold text-[var(--color-accent-purple)]">{data.label}</span>
        </div>
      </div>
      <div className="px-3 py-2 space-y-1" style={{ background: "var(--color-surface)" }}>
        <div className="text-sm text-[var(--color-text-muted)]">PRECEDENCE: {data.precedence}</div>
        <div className="text-sm text-[var(--color-text-muted)]">{data.itemCount} calculation item{data.itemCount !== 1 ? "s" : ""}</div>
      </div>
    </div>
  );
}

function CalcItemNode({ data, selected }: { data: { label: string; expression: string; ordinal: number }; selected?: boolean }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--color-accent-purple)]/60 shadow-lg relative" style={{ width: "100%", height: "100%", minWidth: 200 }}>
      <NodeResizer
        minWidth={160}
        minHeight={60}
        isVisible={!!selected}
        lineStyle={{ borderColor: "#B090B8" }}
        handleStyle={{ backgroundColor: "#B090B8", width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Top} style={{ background: "#B090B8", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#B090B8", width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: "#B090B8", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: "#B090B8", width: 8, height: 8 }} />
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: "var(--color-surface-light)" }}>
        <span className="text-sm font-bold text-[var(--color-text)] truncate max-w-[200px]">{data.label}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium ml-1"
          style={{ background: "rgba(176, 144, 184, 0.2)", color: "#9B7AA0" }}>
          #{data.ordinal}
        </span>
      </div>
      <div className="px-3 py-2" style={{ background: "var(--color-surface)" }}>
        {data.expression && (
          <div className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-background)] px-2 py-1 rounded break-all" style={{ maxWidth: 300 }}>
            {data.expression}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  calcGroupNode: CalcGroupNode,
  calcItemNode: CalcItemNode,
};

function CalcGroupInner({ nodes: initNodes, edges: initEdges }: { nodes: Node[]; edges: Edge[] }) {
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

export default function CalcGroupDiagram() {
  const { model, obfuscateName, reduceToSemantics } = useModel();

  const { nodes, edges, key } = useMemo(() => {
    if (!model || model.calculationGroups.length === 0) return { nodes: [], edges: [], key: "empty" };

    const n: Node[] = [];
    const e: Edge[] = [];

    const GROUP_X_SPACING = 400;
    const ITEM_Y_OFFSET = 160;
    const ITEM_Y_SPACING = 120;

    for (let gi = 0; gi < model.calculationGroups.length; gi++) {
      const group = model.calculationGroups[gi];
      const groupId = `cg-${group.tableName}`;
      const groupX = gi * GROUP_X_SPACING;

      n.push({
        id: groupId,
        type: "calcGroupNode",
        position: { x: groupX, y: 0 },
        data: {
          label: obfuscateName(group.tableName, "Table"),
          precedence: group.precedence,
          itemCount: group.calculationItems.length,
        },
      });

      const sortedItems = [...group.calculationItems].sort((a, b) => a.ordinal - b.ordinal);

      for (let ii = 0; ii < sortedItems.length; ii++) {
        const item = sortedItems[ii];
        const itemId = `ci-${group.tableName}-${item.name}`;

        n.push({
          id: itemId,
          type: "calcItemNode",
          position: { x: groupX - 20, y: ITEM_Y_OFFSET + ii * ITEM_Y_SPACING },
          data: {
            label: obfuscateName(item.name, "Measure"),
            expression: reduceToSemantics ? "[hidden]" : (item.expression || "").slice(0, 120),
            ordinal: item.ordinal,
          },
        });

        e.push({
          id: `${groupId}->${itemId}`,
          source: groupId,
          target: itemId,
          style: { stroke: "#9B7AA0", strokeWidth: 2 },
          animated: true,
        });
      }
    }

    return { nodes: n, edges: e, key: `calcgroups-${model.name}-${Date.now()}` };
  }, [model, obfuscateName, reduceToSemantics]);

  if (!model || model.calculationGroups.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
        No calculation groups found in this model.
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <CalcGroupInner key={key} nodes={nodes} edges={edges} />
      <div className="absolute top-4 left-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-xs space-y-1.5">
        <div className="font-semibold text-[var(--color-text)] mb-2">Calculation Groups</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface-light)] border-2 border-[var(--color-accent-purple)]" />
          <span className="text-[var(--color-text-muted)]">Calculation Group</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-surface-light)] border border-[var(--color-accent-purple)]/60" />
          <span className="text-[var(--color-text-muted)]">Calculation Item</span>
        </div>
        <div className="border-t border-[var(--color-border)] pt-1.5 mt-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-[var(--color-accent-purple)]" />
            <span className="text-[var(--color-text-muted)]">Group to item</span>
          </div>
        </div>
      </div>
    </div>
  );
}
