// Simple grid/force-directed layout utility for positioning nodes
// Avoids needing dagre or elkjs as a dependency

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutResult {
  [nodeId: string]: { x: number; y: number };
}

// Simple layered layout: group nodes into layers based on dependency depth
export function layeredLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: { horizontalSpacing?: number; verticalSpacing?: number; direction?: "TB" | "LR" } = {}
): LayoutResult {
  const { horizontalSpacing = 60, verticalSpacing = 80, direction = "TB" } = options;

  if (nodes.length === 0) return {};

  // Build adjacency
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  for (const node of nodes) {
    outgoing.set(node.id, new Set());
    incoming.set(node.id, new Set());
  }
  for (const edge of edges) {
    outgoing.get(edge.source)?.add(edge.target);
    incoming.get(edge.target)?.add(edge.source);
  }

  // Assign layers via topological sort
  const layers = new Map<string, number>();
  const visited = new Set<string>();

  function assignLayer(nodeId: string): number {
    if (layers.has(nodeId)) return layers.get(nodeId)!;
    if (visited.has(nodeId)) return 0; // cycle
    visited.add(nodeId);

    const deps = incoming.get(nodeId) || new Set();
    let maxDepLayer = -1;
    for (const dep of deps) {
      maxDepLayer = Math.max(maxDepLayer, assignLayer(dep));
    }
    const layer = maxDepLayer + 1;
    layers.set(nodeId, layer);
    return layer;
  }

  // Start with nodes that have no outgoing edges, or process all
  for (const node of nodes) {
    assignLayer(node.id);
  }

  // If all layers are 0 (no edges), distribute in a grid
  const maxLayer = Math.max(...Array.from(layers.values()), 0);
  if (maxLayer === 0 && nodes.length > 1) {
    return gridLayout(nodes, { horizontalSpacing, verticalSpacing });
  }

  // Group nodes by layer
  const layerGroups = new Map<number, LayoutNode[]>();
  for (const node of nodes) {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(node);
  }

  // Position nodes
  const result: LayoutResult = {};
  let layerOffset = 0;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const group = layerGroups.get(layer) || [];
    let nodeOffset = 0;
    const maxNodeSize = direction === "TB"
      ? Math.max(...group.map((n) => n.height), 0)
      : Math.max(...group.map((n) => n.width), 0);

    for (const node of group) {
      if (direction === "TB") {
        result[node.id] = { x: nodeOffset, y: layerOffset };
        nodeOffset += node.width + horizontalSpacing;
      } else {
        result[node.id] = { x: layerOffset, y: nodeOffset };
        nodeOffset += node.height + verticalSpacing;
      }
    }

    layerOffset += maxNodeSize + (direction === "TB" ? verticalSpacing : horizontalSpacing);
  }

  return result;
}

export function gridLayout(
  nodes: LayoutNode[],
  options: { horizontalSpacing?: number; verticalSpacing?: number; columns?: number } = {}
): LayoutResult {
  const { horizontalSpacing = 60, verticalSpacing = 80 } = options;
  const columns = options.columns || Math.ceil(Math.sqrt(nodes.length));

  const result: LayoutResult = {};
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let col = 0;

  for (const node of nodes) {
    result[node.id] = { x, y };
    rowHeight = Math.max(rowHeight, node.height);
    col++;

    if (col >= columns) {
      col = 0;
      x = 0;
      y += rowHeight + verticalSpacing;
      rowHeight = 0;
    } else {
      x += node.width + horizontalSpacing;
    }
  }

  return result;
}
