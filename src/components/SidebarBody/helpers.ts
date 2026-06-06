import type { DataNode } from "antd/es/tree";

/** Replace children of a tree node identified by key, recursively. */
export function updateTreeData(
  list: DataNode[],
  key: React.Key,
  children: DataNode[],
): DataNode[] {
  return list.map((node) => {
    if (node.key === key) return { ...node, children };
    if (node.children)
      return { ...node, children: updateTreeData(node.children, key, children) };
    return node;
  });
}

/** Context menu position and target node. */
export interface ContextState {
  x: number;
  y: number;
  node: DataNode;
}

/** True if the tree key represents a MySQL database node (2 segments). */
export function isMysqlDbNode(key: string): boolean {
  return key.startsWith("mysql:") && key.split(":").length === 2;
}

/** True if the tree key represents a MySQL table node (3 segments). */
export function isMysqlTableNode(key: string): boolean {
  return key.startsWith("mysql:") && key.split(":").length === 3;
}
