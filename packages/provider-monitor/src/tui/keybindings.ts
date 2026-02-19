/** Action identifiers for keyboard shortcuts */
export type Action =
  | 'tab.logs'
  | 'tab.metrics'
  | 'tab.queue'
  | 'tab.models'
  | 'tab.next'
  | 'quit'
  | 'scroll.up'
  | 'scroll.down'
  | 'refresh';

export interface KeyBinding {
  key: string;
  action: Action;
  description: string;
}

/** Default keybinding map */
export const keybindings: KeyBinding[] = [
  { key: '1', action: 'tab.metrics', description: 'Metrics' },
  { key: '2', action: 'tab.logs', description: 'Logs' },
  { key: '3', action: 'tab.queue', description: 'Queue' },
  { key: '4', action: 'tab.models', description: 'Models' },
  { key: 'tab', action: 'tab.next', description: 'Next tab' },
  { key: 'q', action: 'quit', description: 'Quit' },
  { key: 'up', action: 'scroll.up', description: 'Scroll up' },
  { key: 'down', action: 'scroll.down', description: 'Scroll down' },
  { key: 'r', action: 'refresh', description: 'Refresh' },
];
