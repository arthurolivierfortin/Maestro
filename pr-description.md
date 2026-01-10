🎨 Feature : MAESTRO-004 – Frontend Foundation (Vite + React + TypeScript, Routing, Stores, Base UI)

# 🎯 Purpose
This PR delivers the Phase 4a frontend foundation: a Vite + React + TypeScript setup with routing, base components, state management and the initial UX scaffolding required for the visual editor and monitoring UX. It establishes conventions (tokens, design system), developer tooling (ESLint, Prettier, Vitest), and a minimal component and page set so frontend work can proceed in parallel with backend efforts.

# 📋 Changes Summary
- Project scaffolding and dev tooling
  - Vite + React + TypeScript project configuration
  - ESLint and Prettier configuration, `vitest` for unit testing

- Routing & Layout
  - React Router configured with lazy-loaded routes
  - `RootLayout` implemented with header, main content area and footer
  - `Sidebar` and `TopBar` base components created

- Base components and styles
  - Design tokens (`frontend/src/styles/tokens.css`) for colors, spacing, typography
  - Base components: `Button`, `Input`, `Modal`, `LoadingSpinner`
  - `RootLayout.scss` and `Sidebar.scss` for base layout

- State & Services
  - Zustand stores: `workflowStore` (CRUD + persistence) and execution store scaffold
  - `frontend/src/services` initial API client and `signalRService` for real-time updates

- Pages
  - `HomePage`, `WorkflowsPage`, `WorkflowEditorPage` (placeholder), `HistoryPage`, `ExecutionMonitorPage`

# 🏗️ Technical Details
Key decisions
- Use Vite for a fast dev experience and modern build pipeline.
- TypeScript-first approach; types defined under `frontend/src/types` to match backend DTOs where applicable.
- Zustand chosen for simple, focused stores with `devtools` and `persist` middleware.
- React Router for navigation and lazy loading to keep initial bundle small.

Files touched (high level):
- Added/modified: `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, ESLint/Prettier config
- Added: `frontend/src/layouts/RootLayout.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/common/*`, `frontend/src/pages/*`, `frontend/src/store/*`, `frontend/src/services/*`, `frontend/src/styles/tokens.css`

Compatibility
- No backend API contract changes required. Frontend types will be mapped to backend DTOs in later phases.

# 🧪 Testing
Unit tests are set up with `vitest`. Suggested checks:
- Run unit tests for components and stores:
```bash
cd frontend
npm run test
```
- Lint and format checks:
```bash
cd frontend
npm run lint
npm run format:check
```

# 📖 Documentation
- `README.md` updated with frontend development instructions and local dev steps.
- `docs/frontend-guide.md` (overview) added/updated to document conventions and how to extend base components and stores.

# 🚀 Deployment Notes
- No CI/CD config changes are required for runtime. Ensure CI runs `npm ci` and `npm run build` for frontend checks.

# 🔗 Related Items
- ROADMAP.md (Phase 4a listed as completed)
- docs/frontend-guide.md (dev conventions)

# 👥 Review Notes
Please focus review on:
- Project config: `vite.config.ts`, `tsconfig.json`, and package versions
- Base components and styles: naming, tokens, and accessibility basics
- Store API surface in `workflowStore` and error handling patterns
- Route definitions and lazy loading strategy

# ✅ Checklist (for PR merge)
- [ ] All added frontend files are linted and formatted
- [ ] `npm run test` passes for frontend (unit tests)
- [ ] `README.md` local dev steps are accurate
- [ ] Visual smoke test: run `npm run dev` and verify pages load

---


