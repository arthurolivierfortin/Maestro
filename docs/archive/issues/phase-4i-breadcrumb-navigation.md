# Phase 4I: Breadcrumb Navigation & Route Synchronization

> **Issue Type**: Bug Fix + UX Improvement  
> **Priority**: 🟠 HIGH  
> **Estimated Duration**: 3-5 days  
> **Dependencies**: Phase 4g complete  
> **Status**: Not Started  
> **Branch**: `bugfix/MAESTRO-XXX-breadcrumb-navigation-sync`

---

## 🎯 Objective

Fix the breadcrumb navigation system so it:
1. **Always reflects the current page/route** accurately
2. **Updates immediately** when navigating between pages
3. **Is always visible** below the TopBar (outside of scrollable content)
4. **Works with browser back/forward** buttons
5. **Shows correct path** for all routes (Home, Foundry, Canvas, Block Edit, etc.)

---

## 📋 Current Problems

### Critical Issues

| ID | Problem | Current Behavior | Expected Behavior |
|----|---------|------------------|-------------------|
| **NAV-001** | Breadcrumb doesn't update on route change | Shows "Home" when in Foundry | Shows "Home > Foundry" |
| **NAV-002** | Breadcrumb shows stale state after navigation | Shows old block path after returning to Home | Shows "Home" |
| **NAV-003** | Breadcrumb is inside scrollable area | Scrolls with content on some pages | Always fixed below TopBar |
| **NAV-004** | Back/Forward buttons use internal history, not browser | Custom history is disconnected from URL | Synced with browser history |
| **NAV-005** | No route-aware breadcrumb segments | Only block hierarchy | Route + block hierarchy |

### Root Cause Analysis

The current implementation has **two separate navigation systems** that are not synchronized:

1. **React Router** (`react-router-dom`): Manages URL routes (`/foundry`, `/canvas/:id`, etc.)
2. **NavigationStore** (Zustand): Manages block drill-down path (`currentPath`, `history`)

These systems operate independently:
- Changing URL doesn't update `currentPath`
- Navigating in `NavigationStore` doesn't update URL
- Breadcrumb reads from `NavigationStore`, not from URL

---

## 🏗️ Architecture Solution

### Unified Navigation Model

```
┌─────────────────────────────────────────────────────────────┐
│                         URL (React Router)                   │
│   /foundry          /canvas/block-123        /foundry/edit  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ useRouteSync()
┌─────────────────────────────────────────────────────────────┐
│                    NavigationStore (Zustand)                 │
│   routeType: 'foundry'   blockPath: ['block-123']           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Breadcrumb Component                   │
│   Home > Foundry > [Block Name]                             │
└─────────────────────────────────────────────────────────────┘
```

### Breadcrumb Segment Types

```typescript
type BreadcrumbSegmentType = 
  | 'home'           // Always first: "Home" → /
  | 'route'          // Route-based: "Foundry" → /foundry, "Canvas" → /canvas
  | 'block'          // Block in path: "[Block Name]" → drill-down
  | 'action';        // Action: "Edit", "New"

interface BreadcrumbSegment {
  type: BreadcrumbSegmentType;
  label: string;
  path: string;           // URL path for this segment
  blockId?: string;       // If type === 'block'
  isClickable: boolean;
  isCurrent: boolean;
}
```

### Route-to-Breadcrumb Mapping

| Route | Breadcrumb |
|-------|------------|
| `/` | Home |
| `/foundry` | Home > Foundry |
| `/foundry/agent` | Home > Foundry > Agents |
| `/foundry/:blockId/edit` | Home > Foundry > [Block Name] > Edit |
| `/canvas` | Home > Canvas |
| `/canvas/:blockId` | Home > Canvas > [Block Name] |
| `/canvas/:blockId` (drilled into) | Home > Canvas > [Parent] > [Child] |
| `/workflows` | Home > Workflows |
| `/workflows/:id/edit` | Home > Workflows > [Workflow Name] > Edit |
| `/models` | Home > Models |
| `/history` | Home > History |

---

## ✅ Acceptance Criteria

### 4i.1 Route Synchronization Hook ✅

**Goal**: Create hook that syncs React Router with NavigationStore

**Tasks**:
- [ ] Create `useRouteSync.ts` hook
- [ ] Parse current URL to extract route type and parameters
- [ ] Update `NavigationStore` when URL changes
- [ ] Update URL when `NavigationStore` changes programmatically
- [ ] Handle browser back/forward button events

**Implementation**:
```typescript
// hooks/useRouteSync.ts
import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useNavigationStore } from '../store/navigationStore';

export function useRouteSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { 
    setCurrentRoute, 
    setBlockPath, 
    currentRoute, 
    blockPath 
  } = useNavigationStore();

  // Sync URL → Store
  useEffect(() => {
    const route = parseRoute(location.pathname, params);
    setCurrentRoute(route);
  }, [location.pathname, params]);

  // Sync Store → URL (for programmatic navigation)
  useEffect(() => {
    const expectedUrl = buildUrl(currentRoute, blockPath);
    if (location.pathname !== expectedUrl) {
      navigate(expectedUrl, { replace: true });
    }
  }, [currentRoute, blockPath]);
}

function parseRoute(pathname: string, params: Record<string, string>): RouteInfo {
  if (pathname === '/') return { type: 'home' };
  if (pathname.startsWith('/foundry')) {
    if (params.blockId) return { type: 'foundry-edit', blockId: params.blockId };
    if (params.blockType) return { type: 'foundry-filter', filter: params.blockType };
    return { type: 'foundry' };
  }
  if (pathname.startsWith('/canvas')) {
    return { type: 'canvas', blockId: params.blockId || null };
  }
  // ... other routes
}
```

**Validation Tests**:
- [ ] Navigate to `/foundry` → store shows `{ type: 'foundry' }`
- [ ] Navigate to `/canvas/block-123` → store shows block path
- [ ] Use browser back button → store updates correctly
- [ ] Programmatic `navigateTo()` → URL updates

---

### 4i.2 Updated NavigationStore ✅

**Goal**: Extend NavigationStore to handle route-based navigation

**Tasks**:
- [ ] Add `currentRoute: RouteInfo` to state
- [ ] Add `setCurrentRoute(route: RouteInfo)` action
- [ ] Modify `navigateInto` / `navigateUp` to update URL
- [ ] Remove duplicate history (use browser history instead)
- [ ] Keep `blockPath` for within-canvas drill-down only

**New State Shape**:
```typescript
interface NavigationState {
  // Route-level navigation (synced with URL)
  currentRoute: RouteInfo;
  
  // Block-level navigation (drill-down within canvas)
  blockPath: string[];  // Array of block IDs for drill-down
  selectedBlockId: string | null;
  
  // UI state
  propertiesPanelMode: 'view' | 'edit';
  
  // Actions
  setCurrentRoute: (route: RouteInfo) => void;
  navigateInto: (blockId: string) => void;
  navigateUp: () => void;
  selectBlock: (id: string | null, mode?: 'view' | 'edit') => void;
  
  // Computed
  getBreadcrumbSegments: () => BreadcrumbSegment[];
}

interface RouteInfo {
  type: 'home' | 'foundry' | 'foundry-filter' | 'foundry-edit' | 'canvas' | 'workflows' | 'models' | 'history';
  blockId?: string;
  filter?: string;
}
```

**Validation Tests**:
- [ ] `setCurrentRoute({ type: 'foundry' })` → state updates
- [ ] `navigateInto(blockId)` on canvas → blockPath includes block
- [ ] `getBreadcrumbSegments()` returns correct segments for current state

---

### 4i.3 Breadcrumb Component Refactor ✅

**Goal**: Refactor Breadcrumb to use route-aware segments

**Tasks**:
- [ ] Replace current implementation with route-aware logic
- [ ] Render segments based on `getBreadcrumbSegments()`
- [ ] Use React Router's `Link` for navigation
- [ ] Keep back/forward buttons but sync with browser history
- [ ] Ensure proper styling and accessibility

**Updated Component**:
```tsx
// components/Breadcrumb/Breadcrumb.tsx
export function Breadcrumb() {
  const navigate = useNavigate();
  const { getBreadcrumbSegments, canGoBack, canGoForward } = useNavigation();
  const segments = getBreadcrumbSegments();

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb navigation">
      <div className="breadcrumb__nav-controls">
        <button
          className="breadcrumb__nav-btn"
          onClick={() => navigate(-1)}
          disabled={!canGoBack()}
          aria-label="Go back"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="breadcrumb__nav-btn"
          onClick={() => navigate(1)}
          disabled={!canGoForward()}
          aria-label="Go forward"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <ol className="breadcrumb__list">
        {segments.map((segment, index) => (
          <li key={segment.path} className="breadcrumb__item">
            {index > 0 && <span className="breadcrumb__separator">/</span>}
            <BreadcrumbSegment segment={segment} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

**Validation Tests**:
- [ ] On `/` → shows "Home"
- [ ] On `/foundry` → shows "Home > Foundry"
- [ ] On `/canvas/block-123` → shows "Home > Canvas > [Block Name]"
- [ ] On drill-down → shows full path
- [ ] Clicking segment navigates to correct URL

---

### 4i.4 Breadcrumb Layout Position ✅

**Goal**: Ensure breadcrumb is always fixed below TopBar

**Current Problem**:
```tsx
// IDELayout.tsx - Breadcrumb is inside __main-area which scrolls
<PanelItem id="main" defaultSize={...}>
  <div className="ide-layout__main-area">
    <Breadcrumb />  {/* ❌ Inside scrollable area */}
    <main className="ide-layout__workspace">
      <Outlet />
    </main>
  </div>
</PanelItem>
```

**Solution**:
```tsx
// IDELayout.tsx - Breadcrumb outside panels, below TopBar
<div className="ide-layout">
  <TopBar />
  <Breadcrumb />  {/* ✅ Fixed below TopBar, above panels */}
  <div className="ide-layout__body">
    <PanelLayout ...>
      {/* Panels without breadcrumb */}
    </PanelLayout>
  </div>
</div>
```

**CSS Update**:
```scss
.ide-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.ide-layout .breadcrumb {
  flex-shrink: 0;  // Never shrink
  z-index: 10;     // Above panel content
  // Border, background already defined
}

.ide-layout__body {
  flex: 1;
  overflow: hidden;  // Panels handle their own scrolling
}
```

**Validation Tests**:
- [ ] Breadcrumb visible on all pages
- [ ] Breadcrumb doesn't scroll with page content
- [ ] Breadcrumb stays below TopBar on window resize
- [ ] Breadcrumb works with collapsed/expanded panels

---

### 4i.5 Browser History Integration ✅

**Goal**: Back/forward buttons use browser history

**Tasks**:
- [ ] Remove custom `history` array from NavigationStore
- [ ] Use `navigate(-1)` and `navigate(1)` for back/forward
- [ ] `canGoBack()` checks `window.history.length > 1`
- [ ] `canGoForward()` uses sessionStorage flag or history API

**Implementation Note**: Browser doesn't expose forward history length, so we track it:
```typescript
// Track if we can go forward
let canGoForwardFlag = false;

window.addEventListener('popstate', () => {
  canGoForwardFlag = true;
});

export function canGoForward(): boolean {
  return canGoForwardFlag;
}
```

Or use a more robust approach with `sessionStorage`:
```typescript
const HISTORY_KEY = 'maestro-nav-history';

function pushToHistory(url: string) {
  const history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
  const index = parseInt(sessionStorage.getItem(`${HISTORY_KEY}-index`) || '0');
  
  // Truncate forward history
  history.splice(index + 1);
  history.push(url);
  
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  sessionStorage.setItem(`${HISTORY_KEY}-index`, String(history.length - 1));
}
```

**Validation Tests**:
- [ ] Navigate Home → Foundry → Canvas → click Back → at Foundry
- [ ] Click Back again → at Home
- [ ] Click Forward → at Foundry
- [ ] Open new tab → back button disabled (no history)

---

## 📁 Files to Create/Modify

### New Files

```
frontend/src/hooks/
└── useRouteSync.ts              # Route ↔ Store synchronization

frontend/src/types/
└── navigation.types.ts          # RouteInfo, BreadcrumbSegment types
```

### Modified Files

```
frontend/src/store/navigationStore.ts
  - Add currentRoute state
  - Add setCurrentRoute action
  - Add getBreadcrumbSegments method
  - Remove custom history (use browser)

frontend/src/hooks/useNavigation.ts
  - Update to use new store shape
  - Add getBreadcrumbSegments wrapper

frontend/src/components/Breadcrumb/Breadcrumb.tsx
  - Refactor to use route-aware segments
  - Use navigate(-1) for back button
  - Use React Router Link for segments

frontend/src/components/Breadcrumb/Breadcrumb.scss
  - Ensure fixed positioning styles

frontend/src/layouts/IDELayout.tsx
  - Move Breadcrumb outside PanelLayout
  - Place directly below TopBar

frontend/src/layouts/IDELayout.scss
  - Update flexbox layout for breadcrumb
  - Ensure breadcrumb doesn't scroll
```

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] `useRouteSync` correctly parses all route patterns
- [ ] `getBreadcrumbSegments()` returns correct segments
- [ ] `NavigationStore` state updates correctly
- [ ] `Breadcrumb` renders correct segments

### Integration Tests
- [ ] Navigate via sidebar → breadcrumb updates
- [ ] Navigate via breadcrumb click → URL and page update
- [ ] Browser back/forward → breadcrumb updates
- [ ] Deep link (paste URL) → breadcrumb shows correct path

### Manual Test Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| Basic navigation | Click Foundry in sidebar | Breadcrumb: "Home > Foundry" |
| Block navigation | Click workflow in Foundry | Breadcrumb: "Home > Canvas > [Workflow]" |
| Drill-down | Double-click composite block | Breadcrumb: "Home > Canvas > [Parent] > [Child]" |
| Browser back | Click browser back button | Previous page, breadcrumb updates |
| Deep link | Paste `/canvas/block-123` in URL bar | Page loads, breadcrumb: "Home > Canvas > [Block]" |
| Home click | Click "Home" in breadcrumb | Navigate to /, breadcrumb: "Home" |
| Segment click | Click middle segment in breadcrumb | Navigate to that level |
| Scroll test | Scroll long page content | Breadcrumb stays fixed |

---

## 📏 Definition of Done

- [ ] Breadcrumb shows correct path for all routes
- [ ] Breadcrumb updates immediately on navigation
- [ ] Breadcrumb is always visible below TopBar (doesn't scroll)
- [ ] Back/forward buttons use browser history
- [ ] Clicking breadcrumb segment navigates correctly
- [ ] Deep links work (paste URL → correct breadcrumb)
- [ ] All unit tests pass
- [ ] No console errors during navigation
- [ ] Smooth transitions (no flicker)

---

## 📅 Implementation Order

1. **Day 1**: Create `navigation.types.ts` with new types
2. **Day 1**: Update `navigationStore.ts` with route-aware state
3. **Day 2**: Create `useRouteSync.ts` hook
4. **Day 2**: Update `useNavigation.ts` hook
5. **Day 3**: Refactor `Breadcrumb.tsx` component
6. **Day 3**: Move breadcrumb in `IDELayout.tsx`
7. **Day 4**: Update `IDELayout.scss` for fixed positioning
8. **Day 4**: Test all navigation scenarios
9. **Day 5**: Fix edge cases and add unit tests

---

*Last Updated: 2026-01-12*
