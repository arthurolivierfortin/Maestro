import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import type { WidgetRequest } from './index.ts';
import { OptionSelect } from './OptionSelect.ts';
import { TextInput } from './TextInput.ts';
import { Confirmation } from './Confirmation.ts';
import { ProgressWidget } from './ProgressWidget.ts';
import { FileTreeWidget } from './FileTreeWidget.ts';
import { DiffView } from './DiffView.ts';
import { TableWidget } from './TableWidget.ts';
import { LogStream } from './LogStream.ts';
import { PlanView } from './PlanView.ts';
import { TestResults } from './TestResults.ts';
import { MessageWidget } from './MessageWidget.ts';

interface WidgetDispatcherProps {
  request: WidgetRequest;
  onResponse: (value: any) => void;
}

/**
 * Renders the appropriate widget based on the request type.
 * Interactive widgets (option-select, text-input, confirmation) call onResponse when the user responds.
 * Display widgets (progress, plan-view, etc.) are rendered passively.
 */
export const WidgetDispatcher = ({ request, onResponse }: WidgetDispatcherProps) => {
  switch (request.type) {
    case 'option-select':
      return h(OptionSelect, {
        question: request.question || 'Choose an option:',
        options: request.options || [],
        defaultOption: request.default,
        onSelect: onResponse,
      });

    case 'text-input':
      return h(TextInput, {
        question: request.question || 'Enter your response:',
        placeholder: request.placeholder,
        multiline: request.multiline,
        onSubmit: onResponse,
      });

    case 'confirmation':
      return h(Confirmation, {
        question: request.question || 'Confirm?',
        defaultYes: request.defaultYes,
        onConfirm: onResponse,
      });

    case 'progress':
      return h(ProgressWidget, {
        label: request.label,
        current: request.current,
        total: request.total,
        steps: request.steps,
      });

    case 'file-tree':
      return h(FileTreeWidget, {
        rootPath: request.rootPath,
        highlighted: request.highlighted,
      });

    case 'diff-view':
      return h(DiffView, {
        filePath: request.filePath,
        before: request.before,
        after: request.after,
      });

    case 'table':
      return h(TableWidget, {
        columns: request.columns || [],
        rows: request.rows || [],
      });

    case 'log-stream':
      return h(LogStream, {
        entries: request.entries || [],
      });

    case 'plan-view':
      return h(PlanView, {
        steps: (request.steps || []).map(s => ({ ...s, id: s.id || s.name, action: '', target: s.name })) as any,
        currentStep: undefined,
      });

    case 'test-results':
      return h(TestResults, {
        passed: request.passed,
        failed: request.failed,
        details: request.details,
      });

    case 'message':
      return h(MessageWidget, {
        content: request.content || '',
        severity: request.severity,
      });

    default:
      return h(Box, { borderStyle: 'round', borderColor: 'gray', paddingX: 1 },
        h(Text, { color: 'yellow' }, `Unknown widget type: ${request.type}`)
      );
  }
};
