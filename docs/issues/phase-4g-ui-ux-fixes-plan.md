# Phase 4G — UI/UX Fixes & Design Consistency — Agent Planning

> **Branch**: `copilot/implement-block-editing-features`
> **Status**: In Progress
> **Priority**: HIGH — Blocking Phase 4G closure

---

## ⚠️ CRITICAL INSTRUCTIONS

### Style Preservation Rule

**DO NOT** change any existing styles unless explicitly listed in this document.

The Foundry component styles were significantly altered in recent commits. **Revert any style changes** that are not directly related to the fixes below. Compare against `main` branch to identify unwanted changes.

### Before Making Any Change

1. Read the specific issue description carefully
2. Identify the exact file(s) and CSS class(es) involved
3. Make **minimal, targeted changes** — do not refactor or "improve" unrelated code
4. Test the change in isolation before moving to the next issue

---

## 📋 Issues Checklist

### Issue 1: Search bar icon overlap
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/Foundry/FoundrySearchBar.scss`
- **Problem**: Lucide search icon is visually glued to the search input, missing padding/spacing
- **Fix**: Add proper padding/margin between the search icon and the input field
- **Acceptance**: Icon has visible spacing consistent with other inputs in the app

---

### Issue 2: Block grid icon style mismatch
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/Foundry/BlockCard.tsx`, possibly icon imports
- **Problem**: Block grid icon resembles an emoji, not consistent with app design
- **Fix**: Replace with a Lucide icon that matches the design system
- **Acceptance**: Icon is a proper Lucide icon, not an emoji

---

### Issue 3: Favorite icon positioning
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/Foundry/BlockCard.tsx`, `frontend/src/components/Foundry/BlockCard.scss`
- **Problem**: Favorite (star) icon is in the middle of the block
- **Fix**: Move star icon to the right side of the block, left of the three-dot (⋯) menu
- **Acceptance**: Star icon is positioned next to the menu button, aligned with other block actions

---

### Issue 4: Foundry sidebar category hover state
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/Foundry/FoundrySidebar.scss`
- **Problem**: Categories have no visible hover state or hover color is identical to default
- **Fix**: Add distinct hover background/color that aligns with the theme
- **Acceptance**: Clear visual feedback on hover for all sidebar categories

---

### Issue 5: Breadcrumb navigation behavior
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/Breadcrumb/Breadcrumb.tsx`, `frontend/src/components/Breadcrumb/Breadcrumb.scss`
- **Problem**: Breadcrumbs don't reflect user navigation path, missing navigation controls
- **Fix**:
  1. Ensure breadcrumb reflects actual navigation flow
  2. Add Back/Forward navigation arrows on the left of the breadcrumb
  3. Implement browser-like navigation history behavior
- **Acceptance**: Breadcrumb shows correct path + back/forward arrows work like browser navigation

---

### Issue 6: Block Explorer panel behavior
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/BlockExplorer/BlockExplorer.tsx`, `frontend/src/layouts/IDELayout.tsx`
- **Problem**: Block Explorer doesn't behave like Properties Panel (not retractable/collapsible)
- **Fix**: Implement same collapse/expand interaction model as Properties Panel
- **Acceptance**: Block Explorer can be collapsed/expanded like Properties Panel

---

### Issue 7: Retractable panels width behavior ⚠️ CRITICAL
- **Status**: [ ] Not Started
- **Files**: `frontend/src/layouts/IDELayout.tsx`, `frontend/src/layouts/IDELayout.scss`
- **Problem**: 
  - Properties Panel is too wide when closed
  - Panel width changes dynamically when opening/closing
  - Opening/closing one panel affects other panels
- **Current Bug**: Closing one panel causes the other to open or expand
- **Fix**:
  1. Set **fixed width when closed** (e.g., 40-48px for collapsed state)
  2. Set **fixed default width when opened** (e.g., 280-320px)
  3. Panels should be user-resizable **only when open**
  4. Resizing/toggling one panel must **NOT** impact other panels
  5. Each panel's state must be **independent**
- **Implementation Notes**:
  ```
  - Use independent state for each panel (isOpen, width)
  - Do NOT use flex-grow that would redistribute space
  - Use fixed widths with CSS transitions
  - Main content area should use flex: 1 to fill remaining space
  ```
- **Acceptance**: 
  - Closing Block Explorer does NOT affect Properties Panel
  - Closing Properties Panel does NOT affect Block Explorer
  - Each panel maintains its own state independently

---

### Issue 8: Workflow node action buttons broken ⚠️ CRITICAL
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/BlockNodes/BaseBlockNode.tsx`
- **Problem**: The three small buttons on workflow nodes no longer function
- **Current Symptom**: Console shows "Menu clicked for block: block-xxx" but no action happens
- **Fix**:
  1. Investigate why click handlers are not working
  2. Check if event propagation is being stopped incorrectly
  3. Verify the menu/actions are properly wired up
  4. Restore correct click behavior for all three buttons
- **Acceptance**: All three node action buttons work and trigger their intended actions

---

### Issue 9: Properties panel mode button styling
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/panels/PropertiesPanel.tsx`, related SCSS
- **Problem**: `.properties-panel__mode-btn` uses emojis and incorrect colors
- **Fix**: Replace emojis with Lucide icons, use design-system-compliant colors
- **Acceptance**: Mode buttons use proper icons and theme-consistent colors

---

### Issue 10: Wizard radio labels style inconsistency
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/Foundry/CreateBlockWizard/*.scss`
- **Problem**: Radio labels inside `wizard-content` don't match app style
- **Fix**: Update typography, spacing, and colors to match design system
- **Acceptance**: Radio labels are visually consistent with the rest of the app

---

### Issue 11: Base block editor select dropdown styling
- **Status**: [ ] Not Started
- **Files**: `frontend/src/components/BlockEditors/BaseBlockEditor.scss`
- **Problem**: `.base-block-editor__select` uses incorrect colors when opened
- **Fix**: Apply proper theme colors to dropdown options and selected state
- **Acceptance**: Select dropdown matches app theme when open

---

## 🔧 Style Reversion Checklist

### ⚠️ MANDATORY: Verify & Revert Unintended Style Changes

**Before fixing individual issues**, you MUST audit all style changes in this branch compared to `main`.

Some commits may have inadvertently changed styles that were NOT supposed to change. Your job is to:

1. **Identify all unintended style changes** by comparing files with `main`
2. **Revert them back** to their original state from `main` branch
3. **Keep ONLY** changes that are explicitly listed in the 11 issues above

### How to Identify Unintended Changes

Run these commands and **carefully review the output**:

```bash
# Show all style changes in Foundry components
git diff main -- frontend/src/components/Foundry/

# Show all style changes in panels/layouts
git diff main -- frontend/src/components/panels/
git diff main -- frontend/src/layouts/

# Show all style changes in block editors
git diff main -- frontend/src/components/BlockEditors/

# Show all style changes in block explorer/nodes
git diff main -- frontend/src/components/BlockExplorer/
git diff main -- frontend/src/components/BlockNodes/
```

### Specific Files to Audit

Compare these files line-by-line against `main`:

```bash
git diff main -- frontend/src/components/Foundry/BlockCard.scss
git diff main -- frontend/src/components/Foundry/BlockGrid.scss
git diff main -- frontend/src/components/Foundry/FoundrySidebar.scss
git diff main -- frontend/src/components/Foundry/FoundrySearchBar.scss
git diff main -- frontend/src/pages/FoundryPage.scss
git diff main -- frontend/src/layouts/IDELayout.scss
git diff main -- frontend/src/components/BlockEditors/BaseBlockEditor.scss
```

### Reversion Process

For each file with unintended changes:

1. **Restore the original version** from `main`:
   ```bash
   git checkout main -- <filepath>
   ```

2. **Then apply only the intentional fixes** from the 11 issues above

3. **Document the reversion** in your commit:
   ```
   fix: Revert unintended style changes to [component]
   
   Restored [component] styles to match main branch.
   Only keeping changes related to [specific issue number].
   ```

### Reversion Rules

1. **Keep** changes that explicitly fix one of the 11 issues above
2. **Revert** changes that alter layout, colors, spacing, or sizing not related to the fixes
3. **Revert** changes that broke existing functionality or introduced visual regressions
4. **Revert** changes to component structure not required by the fixes
5. **Document** each reversion with clear commit messages

---

## 🎯 Priority Order

Execute fixes in this order:

1. **Issue 7** — Panel width behavior (blocks user workflow)
2. **Issue 8** — Node action buttons (core functionality broken)
3. **Issue 6** — Block Explorer panel behavior
4. **Style Reversion** — Restore original Foundry styles
5. **Issue 1-4** — Foundry UI polish (search, icons, hover)
6. **Issue 5** — Breadcrumb navigation
7. **Issue 9-11** — Minor styling fixes

---

## ✅ Completion Criteria

- [ ] All 11 issues are resolved
- [ ] No regressions in existing functionality
- [ ] Panels work independently (no cross-panel effects)
- [ ] Node action buttons fully functional
- [ ] Foundry styles match original design (except for targeted fixes)
- [ ] All emojis replaced with Lucide icons where appropriate
- [ ] Manual testing passed on all fixed components

---

## 📝 Testing Commands

```bash
# Run frontend tests
cd frontend
npm test

# Start dev server for manual testing
npm run dev
```

### Manual Test Checklist

- [ ] Open/close Block Explorer — Properties Panel unaffected
- [ ] Open/close Properties Panel — Block Explorer unaffected
- [ ] Click all three workflow node buttons — actions work
- [ ] Hover over Foundry sidebar categories — visible feedback
- [ ] Check search bar icon spacing
- [ ] Verify favorite star position on block cards
- [ ] Test breadcrumb back/forward navigation

---

## 📁 Key Files Reference

| Component | Main File | Style File |
|-----------|-----------|------------|
| IDELayout | `layouts/IDELayout.tsx` | `layouts/IDELayout.scss` |
| BlockExplorer | `components/BlockExplorer/BlockExplorer.tsx` | — |
| PropertiesPanel | `components/panels/PropertiesPanel.tsx` | — |
| BaseBlockNode | `components/BlockNodes/BaseBlockNode.tsx` | — |
| BlockCard | `components/Foundry/BlockCard.tsx` | `BlockCard.scss` |
| FoundrySidebar | `components/Foundry/FoundrySidebar.tsx` | `FoundrySidebar.scss` |
| Breadcrumb | `components/Breadcrumb/Breadcrumb.tsx` | — |
| CreateBlockWizard | `components/Foundry/CreateBlockWizard/` | — |
| BaseBlockEditor | `components/BlockEditors/BaseBlockEditor.tsx` | `BaseBlockEditor.scss` |

---

*Last Updated: 2026-01-12*
