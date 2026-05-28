# Block Detail View — Design

**Goal:** Let the user click a block in the Catalog and inspect its metadata plus its raw `block.json` / `system-prompt.md` content — materializing "open the box" of "everything is a block".
**Roadmap phase:** Phase-66 (sub-phase 66-J)
**Tags:** [code-app]

**Scope (in):**
- `blockService`: `getBlock(id)` (GET /api/blocks/{id}) + `getBlockContent(id, filePath)` (GET /api/blocks/{id}/content/{*filePath}, returns raw text, throws/null on 404).
- Extend the TS `BlockDto` with the optional fields the detail view shows (`version`, `capabilities`, `author`, `contract`, `isSystem`).
- `useBlockDetail(blockId)` hook: fetches metadata + attempts to load block.json content (trying candidate filenames) and `system-prompt.md`, gracefully tolerating 404.
- `BlockDetail` component: `.box` panel — metadata header (id, name, type badge, designation/category/contract, tags, isAtomic) + content sections (block.json formatted, system-prompt raw) shown only when present; Close button.
- `CatalogPage`: clicking a `BlockCard` selects it and renders `BlockDetail`; clicking Close clears selection.
- `BlockCard`: becomes clickable (onClick prop) without breaking existing read-only rendering/tests.

**Scope (out):**
- Rich contract widget (typed Inputs/Outputs, fitness, test counts) — cycle 66-K.
- Block editing (PUT content) — later.
- Internal composition viewer (sub-block tree via /children) — later.
- Iterations / variants history — later.
- Block execution from the detail — not relevant.

**Constraints:**
- No backend changes. Consume existing endpoints only.
- The block.json filename is NOT derivable from id+type (naming convention is inconsistent — see research). The hook MUST try candidates in order: `<id>.<blockType>.block.json`, then `<id>.block.json`, and use the first that returns content.
- Content fetch is best-effort: a 404 hides the corresponding section; it is NEVER surfaced as a page-level error. Metadata (from GET /api/blocks/{id}) is the source of truth and always renders when the id resolves.
- All existing 179 tests stay green. No `@ts-nocheck`. `npx tsc --noEmit` clean.
- Theme: reuse existing classes (`.box`, `.box-title`, `.box-meta`, `.box-body`, `.b` badges + variants, `.c0`-`.c3`, monospace via existing `pre`/code styling). Mirror `SessionDetail.tsx` + `ConsolePage.tsx`.

## Cardinal Rule check
PASS. Pure TUI consumer of an existing generic API. A new session type still needs only JSON; no session-specific C# is added. Block detail is content-driven (reads whatever the API returns).

## No Legacy Support check
Nothing removed — additive. `BlockDto` gains optional fields (no breaking change to `getBlocks`). `BlockCard` gains an optional `onClick` (default no-op) so existing usage and tests are unaffected.

## Architecture
`CatalogPage` holds `selectedBlockId` state. Clicking a `BlockCard` calls `onClick(block.id)` which sets it. When set, `useBlockDetail(selectedBlockId)` runs: (1) `getBlock(id)` for metadata; (2) tries `getBlockContent(id, "<id>.<blockType>.block.json")` then `"<id>.block.json"` for the config, stopping at the first that resolves; (3) tries `getBlockContent(id, "system-prompt.md")`. Steps 2-3 swallow 404 into `null`. The hook exposes `{ block, configContent, promptContent, isLoading, error }` where `error` is only set if the metadata fetch itself fails.

`BlockDetail` renders a `.box` panel: a header section (block id as `.box-title`, a type `.b` badge, `.box-meta` count or version, then a small key/value list for name/designation/category/contract/isAtomic/tags), followed by a `block.json` section (monospace `<pre>` of the formatted JSON) shown only if `configContent` is non-null, and a `system-prompt.md` section (monospace `<pre>`) shown only if `promptContent` is non-null. A Close button calls `onClose`.

Data flow lives entirely in `apps/code/src/` (service → hook → component → page). No backend, CLI, blocks, or contracts touched.

## Affected systems
- Backend C#: none
- LLM-Provider: none
- TUI: `apps/code/src/services/blockService.ts`, `apps/code/src/hooks/useBlockDetail.ts` (new), `apps/code/src/components/BlockDetail.tsx` (new), `apps/code/src/components/BlockCard.tsx`, `apps/code/src/pages/CatalogPage.tsx`
- CLI: none
- Blocks: none
- Contracts: none
- DI: none

## Risks
- **Content endpoint 404s for system/flat blocks** (research `critical_constraint`): the content endpoint resolves against `ProjectBlocksPath/<id>` only. Most listed blocks will 404. Mitigation baked into spec: graceful sections, never a hard error. The detail view is still useful (metadata always renders).
- **Filename derivation** — handled by candidate-trying, not guessing a single name.
- **BlockCard test breakage** — keep `onClick` optional with a default; existing standalone render tests must pass unchanged.
- **CatalogPage test breakage** — existing tests assert list strings/handlers; adding selection must not change those strings. New behavior covered by new assertions.
- **JSON formatting** — `getBlockContent` returns raw text; re-serialize via `JSON.parse`+`JSON.stringify(_, null, 2)` for display, but fall back to the raw text if parse fails (do not throw).
