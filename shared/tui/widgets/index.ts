/**
 * Phase 28-B: Generic Widget System
 *
 * Widgets are reusable TUI components that any agent can request.
 * The agent specifies the widget TYPE (e.g., "option-select", "progress"),
 * and the mode renders it. No widget is specific to any particular agent.
 *
 * Widget protocol:
 *   Agent → sets _widgetRequest session variable
 *   Mode  → reads _widgetRequest, renders widget, collects user input
 *   Mode  → sets _widgetResponse session variable
 *   Agent → reads _widgetResponse and continues
 */

export { OptionSelect } from './OptionSelect.ts';
export { TextInput } from './TextInput.ts';
export { Confirmation } from './Confirmation.ts';
export { ProgressWidget } from './ProgressWidget.ts';
export { FileTreeWidget } from './FileTreeWidget.ts';
export { DiffView } from './DiffView.ts';
export { TableWidget } from './TableWidget.ts';
export { LogStream } from './LogStream.ts';
export { PlanView } from './PlanView.ts';
export { TestResults } from './TestResults.ts';
export { MessageWidget } from './MessageWidget.ts';
export { WidgetDispatcher } from './WidgetDispatcher.ts';

export type WidgetType =
  | 'option-select'
  | 'text-input'
  | 'confirmation'
  | 'progress'
  | 'file-tree'
  | 'diff-view'
  | 'table'
  | 'log-stream'
  | 'plan-view'
  | 'test-results'
  | 'message';

export interface WidgetRequest {
  type: WidgetType;
  id?: string;
  question?: string;
  options?: string[];
  default?: string;
  placeholder?: string;
  multiline?: boolean;
  defaultYes?: boolean;
  label?: string;
  current?: number;
  total?: number;
  steps?: Array<{ id: string; name: string; status: string }>;
  rootPath?: string;
  highlighted?: string[];
  filePath?: string;
  before?: string;
  after?: string;
  columns?: string[];
  rows?: Array<Record<string, string>>;
  entries?: Array<{ time: string; level: string; msg: string }>;
  passed?: number;
  failed?: number;
  details?: Array<{ name: string; status: string; error?: string }>;
  content?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

export interface WidgetResponse {
  requestId?: string;
  type: WidgetType;
  value: any;
  timestamp: string;
}
