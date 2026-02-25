/**
 * Page Registry — Type definitions for the spatial navigation grid.
 *
 * The app is an infinite 2D grid of full-screen pages. Agent is always at (0,0).
 * Navigation is computed dynamically from page positions — no hardcoded compass.
 */

import type { ComponentType } from 'react';

// ── Direction & Position ──────────────────────────────────────

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

// ── Page Definition ───────────────────────────────────────────

export interface PageProps {
  apiClient: any;
  sessionId: string | null;
  onNavigate: (target: { type: string; id?: string }) => void;
  onBack: () => void;
  height: number;
  width: number;
}

export interface DetailScreenDef {
  id: string;
  label: string;
  component: ComponentType<any>;
}

export interface PageDefinition {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  position: Position;
  component: ComponentType<PageProps>;
  hotkey?: string;
  detailScreens?: DetailScreenDef[];
}

// ── Direction Hint (for StatusBar) ────────────────────────────

export interface DirectionHint {
  direction: Direction;
  page: PageDefinition;
}
