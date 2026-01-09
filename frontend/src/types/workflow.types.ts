/**
 * Workflow type definitions.
 * Matches backend domain model structure.
 */

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  connections: Connection[];
}

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export type NodeType = 'Agent' | 'Tool' | 'Decision' | 'Validator' | 'Trigger';

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromOutput?: string;
  toInput?: string;
}
