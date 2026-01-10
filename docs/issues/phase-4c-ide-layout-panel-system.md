# Phase 4c: IDE Layout & Panel System

## 📋 Issue Summary

**Phase**: 4c  
**Title**: Implement IDE-Style Layout with Resizable Panels  
**Priority**: 🟡 High  
**Estimated Effort**: Medium (1 week)  
**Dependencies**: Phase 4b (Block Architecture) ✅  
**Blocks**: Phase 4d (Canvas Foundation), Phase 9 (Terminal Integration)

---

## 🎯 Objective

Transform the UI into an IDE-style interface with resizable panels, preparing space for:
- Block canvas (main editing area)
- Properties panel (block configuration)
- Bottom panel (terminal, output, problems)
- Theme support (light/dark)

---

## 📖 Context

### Current State (Phase 4b)
- Basic IDE layout exists with TopBar, BlockExplorer sidebar, Breadcrumb
- No resizable panels
- No properties panel for block editing
- No bottom panel for terminal/logs
- No theme toggle

### Target State (Phase 4c)
- **Resizable panel system** with named regions and persistent sizes
- **Properties panel** showing selected block configuration
- **Bottom panel** with tabs for Terminal, Output, Problems
- **Theme support** with light/dark toggle in TopBar
- **Keyboard shortcuts** for panel focus

---

## 🏗️ Architecture

### Panel Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                         TopBar                               │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│  Block   │         Main Canvas              │  Properties   │
│ Explorer │         (Outlet)                 │    Panel      │
│ Sidebar  │                                  │               │
│          │                                  │               │
│  240px   │           flex: 1                │    280px      │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│                      Bottom Panel                            │
│              [Terminal] [Output] [Problems]                  │
│                         200px                                │
└─────────────────────────────────────────────────────────────┘
```

### Panel System API

```typescript
interface PanelLayoutProps {
  /** Unique key for localStorage persistence */
  persistKey: string;
  /** Initial panel sizes (percentages or pixels) */
  initialSizes?: Record<string, number>;
  /** Callback when sizes change */
  onSizeChange?: (sizes: Record<string, number>) => void;
  children: React.ReactNode;
}

interface PanelProps {
  /** Unique panel identifier */
  id: string;
  /** Minimum size in pixels */
  minSize?: number;
  /** Maximum size in pixels */
  maxSize?: number;
  /** Default size in pixels or percentage */
  defaultSize?: number;
  /** Whether panel can be collapsed */
  collapsible?: boolean;
  /** Collapse direction */
  collapseDirection?: 'left' | 'right' | 'up' | 'down';
  children: React.ReactNode;
}

interface PanelDividerProps {
  /** Orientation of the divider */
  orientation: 'horizontal' | 'vertical';
}
```

### Theme Context

```typescript
interface ThemeContextValue {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resolvedTheme: 'light' | 'dark';
}

// Hook usage
const { theme, setTheme, resolvedTheme } = useTheme();
```

---

## ✅ Acceptance Criteria

### 4c.1 Panel System
- [ ] Install/evaluate `react-resizable-panels` or similar lightweight library
- [ ] Create `PanelLayout` component with named regions
- [ ] Implement resizable dividers between panels
- [ ] Support both horizontal and vertical splits
- [ ] Persist panel sizes to localStorage with key `maestro.ui.panels`
- [ ] Add collapse/expand functionality per panel
- [ ] Animate collapse/expand transitions
- [ ] Handle edge cases (min/max sizes, overflow)
- [ ] Unit tests for resize and persistence logic

### 4c.2 IDE Layout Migration
- [ ] Refactor `IDELayout` to use `PanelLayout`
- [ ] Configure panel regions:
  - [ ] **Left**: BlockExplorer (default 240px, min 180px, max 400px, collapsible)
  - [ ] **Center**: Main workspace with Breadcrumb + Outlet (flex: 1)
  - [ ] **Right**: PropertiesPanel (default 280px, min 200px, max 500px, collapsible)
  - [ ] **Bottom**: BottomPanel (default 200px, min 100px, max 400px, collapsible)
- [ ] Ensure Outlet content renders correctly in center panel
- [ ] Handle responsive behavior (collapse panels on small screens)
- [ ] Unit tests

### 4c.3 Properties Panel
- [ ] Create `PropertiesPanel` component
- [ ] Display when a block is selected (via `useNavigationStore.selectedBlockId`)
- [ ] Show block metadata:
  - [ ] Block type icon and label
  - [ ] Block ID (copyable)
  - [ ] Created/updated timestamps
- [ ] Generate form fields based on block type:
  - [ ] Common fields: `name`, `description`
  - [ ] Type-specific fields from `BlockTypeRegistry.configSchema`
- [ ] Form validation using schema
- [ ] Live update block on field change (debounced 300ms)
- [ ] Show "No block selected" placeholder when empty
- [ ] Collapse button in header
- [ ] Unit tests

### 4c.4 Bottom Panel
- [ ] Create `BottomPanel` component with tabs
- [ ] Tab 1: **Terminal** - placeholder with message "Terminal coming in Phase 9"
- [ ] Tab 2: **Output** - execution output area (placeholder)
- [ ] Tab 3: **Problems** - validation errors list
  - [ ] Show block validation errors from `useBlockStore`
  - [ ] Click error → select and scroll to block
- [ ] Collapsible by default, collapsed on page load
- [ ] Auto-expand on:
  - [ ] Execution start (switch to Output tab)
  - [ ] New validation error (switch to Problems tab)
- [ ] Remember last active tab
- [ ] Persist collapsed state
- [ ] Unit tests

### 4c.5 Theme Support
- [ ] Create `ThemeProvider` context
- [ ] Create `useTheme` hook
- [ ] Support themes: `light`, `dark`, `system`
- [ ] Detect system preference with `matchMedia`
- [ ] Persist theme to localStorage with key `maestro.theme`
- [ ] Apply theme via CSS class on `<html>` element
- [ ] Update all CSS variables for dark theme
- [ ] Add theme toggle button in TopBar (sun/moon icon)
- [ ] Smooth transition when switching themes
- [ ] Unit tests

### 4c.6 Keyboard Shortcuts
- [ ] Implement focus management for panels
- [ ] Keyboard shortcuts:
  - [ ] `Ctrl+1` → Focus sidebar (BlockExplorer)
  - [ ] `Ctrl+2` → Focus main canvas
  - [ ] `Ctrl+3` → Focus properties panel
  - [ ] `Ctrl+\`` → Toggle bottom panel
  - [ ] `Ctrl+B` → Toggle sidebar
  - [ ] `Ctrl+J` → Toggle bottom panel
- [ ] Show shortcuts in tooltip on panel headers
- [ ] Keyboard shortcuts help modal (`Ctrl+?` or `F1`)
- [ ] Unit tests

---

## 📁 Files to Create/Modify

### New Files
```
frontend/src/components/
├── PanelLayout/
│   ├── PanelLayout.tsx           # Main layout orchestrator
│   ├── PanelLayout.scss
│   ├── PanelLayout.test.tsx
│   ├── Panel.tsx                 # Individual panel wrapper
│   ├── PanelDivider.tsx          # Resizable divider
│   ├── PanelHeader.tsx           # Collapsible panel header
│   ├── usePanelPersistence.ts    # LocalStorage hook
│   └── index.ts
├── PropertiesPanel/
│   ├── PropertiesPanel.tsx       # Block configuration panel
│   ├── PropertiesPanel.scss
│   ├── PropertiesPanel.test.tsx
│   ├── PropertyField.tsx         # Generic form field
│   ├── PropertyGroup.tsx         # Grouped fields
│   ├── BlockMetadata.tsx         # ID, timestamps display
│   └── index.ts
├── BottomPanel/
│   ├── BottomPanel.tsx           # Tabbed bottom panel
│   ├── BottomPanel.scss
│   ├── BottomPanel.test.tsx
│   ├── TerminalPlaceholder.tsx   # Phase 9 placeholder
│   ├── OutputView.tsx            # Execution output
│   ├── ProblemsView.tsx          # Validation errors
│   └── index.ts
└── ThemeToggle/
    ├── ThemeToggle.tsx           # Sun/moon toggle button
    ├── ThemeToggle.scss
    └── index.ts

frontend/src/contexts/
├── ThemeContext.tsx              # Theme provider and context
└── index.ts

frontend/src/hooks/
├── useTheme.ts                   # Theme hook
├── usePanelShortcuts.ts          # Panel keyboard shortcuts
└── useMediaQuery.ts              # System preference detection
```

### Modified Files
```
frontend/src/layouts/IDELayout.tsx           # Migrate to PanelLayout
frontend/src/layouts/IDELayout.scss          # Update for panel system
frontend/src/components/layout/TopBar.tsx    # Add theme toggle
frontend/src/components/layout/TopBar.scss   # Style theme toggle
frontend/src/styles/tokens.css               # Add dark theme variables
frontend/src/App.tsx                         # Wrap with ThemeProvider
frontend/package.json                        # Add react-resizable-panels
```

---

## 🎨 Design Specifications

### Panel Dimensions
| Panel | Default | Min | Max | Collapsible |
|-------|---------|-----|-----|-------------|
| Sidebar (left) | 240px | 180px | 400px | ✓ (to 0) |
| Properties (right) | 280px | 200px | 500px | ✓ (to 0) |
| Bottom | 200px | 100px | 400px | ✓ (to 0) |
| Main (center) | flex: 1 | 400px | - | ✗ |

### Divider Styling
```scss
.panel-divider {
  --divider-size: 4px;
  --divider-color: var(--border);
  --divider-hover-color: var(--accent-primary);
  
  background: var(--divider-color);
  cursor: col-resize; // or row-resize for horizontal
  transition: background 150ms ease;
  
  &:hover, &:active {
    background: var(--divider-hover-color);
  }
}
```

### Theme Colors
| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#ffffff` | `#0f172a` |
| `--surface` | `#f8fafc` | `#1e293b` |
| `--surface-hover` | `#f1f5f9` | `#334155` |
| `--border` | `#e2e8f0` | `#334155` |
| `--text-primary` | `#0f172a` | `#f8fafc` |
| `--text-secondary` | `#475569` | `#94a3b8` |
| `--text-muted` | `#94a3b8` | `#64748b` |
| `--accent-primary` | `#3b82f6` | `#60a5fa` |

### Bottom Panel Tabs
```scss
.bottom-panel {
  &__tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
  }
  
  &__tab {
    padding: 8px 16px;
    font-size: 13px;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    cursor: pointer;
    
    &--active {
      color: var(--accent-primary);
      border-bottom-color: var(--accent-primary);
    }
    
    &__badge {
      margin-left: 6px;
      padding: 2px 6px;
      font-size: 11px;
      background: var(--accent-secondary);
      border-radius: 10px;
    }
  }
}
```

---

## 🧪 Testing Requirements

### Unit Tests
- PanelLayout resize functionality
- Panel collapse/expand behavior
- Size persistence to localStorage
- PropertiesPanel form generation
- PropertiesPanel validation
- BottomPanel tab switching
- Theme toggle and persistence
- Keyboard shortcut handlers

### Integration Tests
- Select block → PropertiesPanel shows config
- Edit property → Block updates in store
- Validation error → Problems tab shows error
- Theme change → All components update
- Resize panel → Size persisted on reload

---

## 📝 Implementation Notes

### Recommended Library
Use `react-resizable-panels` (https://github.com/bvaughn/react-resizable-panels):
- Lightweight (~3KB gzipped)
- Accessible (keyboard support)
- Supports persistence
- Flexible API

```bash
npm install react-resizable-panels
```

### LocalStorage Keys
```
maestro.ui.panels.sizes    # Panel sizes object
maestro.ui.panels.collapsed # Collapsed state object
maestro.ui.bottomPanel.tab # Active bottom panel tab
maestro.theme              # 'light' | 'dark' | 'system'
```

### Performance Considerations
- Debounce panel resize events (100ms) before persisting
- Debounce property changes (300ms) before updating store
- Use CSS transitions instead of JS animations
- Lazy render PropertiesPanel content

### Accessibility
- Panel dividers are keyboard accessible (arrow keys to resize)
- Focus trap within panels when focused
- ARIA labels for collapse buttons
- Theme respects `prefers-reduced-motion`

---

## 🔗 Related Documentation

- [ROADMAP.md](../../ROADMAP.md) - Phase 4c section
- [Phase 4b Issue](./phase-4b-block-architecture.md) - Block store for PropertiesPanel
- [Phase 4d Issue](./phase-4d-canvas-foundation.md) - Canvas in main panel
- [Phase 9](../../ROADMAP.md) - Terminal integration in BottomPanel

---

## 📎 Example Usage

### PanelLayout Usage
```tsx
import { PanelLayout, Panel, PanelDivider } from '@/components/PanelLayout';

function IDELayout() {
  return (
    <PanelLayout persistKey="ide-layout">
      <Panel id="sidebar" defaultSize={240} minSize={180} collapsible>
        <BlockExplorer />
      </Panel>
      
      <PanelDivider orientation="vertical" />
      
      <Panel id="main" minSize={400}>
        <div className="ide-layout__main">
          <Breadcrumb />
          <main className="ide-layout__workspace">
            <Outlet />
          </main>
        </div>
      </Panel>
      
      <PanelDivider orientation="vertical" />
      
      <Panel id="properties" defaultSize={280} minSize={200} collapsible>
        <PropertiesPanel />
      </Panel>
    </PanelLayout>
  );
}
```

### Theme Toggle Usage
```tsx
import { useTheme } from '@/hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
```

---

## 🏷️ Labels

- `frontend`
- `phase-4c`
- `priority: high`
- `layout`
- `panels`
- `theme`

---

**Created**: 2026-01-10  
**Assignee**: TBD  
**Milestone**: MVP - Frontend Core
