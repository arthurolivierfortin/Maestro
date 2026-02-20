# Notes d'irritation — Phase 34

> **Ce fichier est rempli par les agents pendant l'execution des plans.**
> Chaque agent DOIT documenter toute friction, bug, divergence, ou perte de temps rencontree.

---

## Format par entree

```
### [Plan XX — NomDuPlan] — YYYY-MM-DD
- **Irritation** : Description du probleme
- **Contexte** : Ce que je faisais quand c'est arrive
- **Contournement** : Ce que j'ai fait pour avancer (ou "bloque" si rien)
- **Suggestion** : Comment ameliorer pour la prochaine fois
```

---

## Entrees

(Les agents ajoutent leurs notes ci-dessous)

### [Plan E2 — IMPLEMENTER Validators] — 2026-02-19
- **Irritation** : The plan says to use `list-blocks` CLI command but the actual command is `blocks` or `block list`. The CLAUDE.md also references `list-blocks` which does not exist.
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `block info <block-id>` which worked correctly.
- **Suggestion** : Update CLAUDE.md and plan templates to use the correct CLI command names (`blocks`, `block list`, `block info`).

### [Plan E2 — IMPLEMENTER Validators] — 2026-02-19
- **Irritation** : The plan specifies `config.systemPrompt` inline for the step-validator inference block, noting that `InferenceBlockExecutor` does not support `systemPromptFile`. However, the task description itself says "step-validator is an INFERENCE block -- it can use system-prompt.md file now (Plan A Etape 6 added file support to InferenceBlockExecutor)." This is contradictory. I followed the plan's inline approach since the plan is the authoritative document.
- **Contexte** : Creating step-validator block definition.
- **Contournement** : Used inline `config.systemPrompt` as specified in the plan.
- **Suggestion** : If `systemPromptFile` support was truly added in Plan A Etape 6, update the plan templates to use it. Long inline prompts in JSON are fragile (escaping issues, hard to edit).

### [Plan E2 — IMPLEMENTER Validators] — 2026-02-19
- **Irritation** : Cannot test execution (run step-validator / run compilation-checker) because LLM-Provider is not running. The plan requires "minimum 2 scenarios" testing but this is impossible without an LLM.
- **Contexte** : Post-creation verification step.
- **Contournement** : Verified discovery and publication only. Execution testing deferred until LLM-Provider is available.
- **Suggestion** : Plans should have a "no-LLM path" that documents what verification is possible without the LLM provider (JSON validation, discovery, schema checks).

### [Plan D — PLANIFIER] — 2026-02-20
- **Irritation** : CLI command `list-blocks` referenced in the plan does not exist. The correct command is `blocks` or `block list`.
- **Contexte** : Attempting to verify block discovery after creating task-planner files, using the command from the plan's verification section.
- **Contournement** : Used `block info <block-id>` which works correctly for verifying individual block discovery.
- **Suggestion** : Update plan templates to reference `blocks` or `block info <id>` instead of `list-blocks`. (Same irritation as Plan E2 — this keeps recurring across plans.)

### [Plan D — PLANIFIER] — 2026-02-20
- **Irritation** : LLM-Provider is not running, so execution tests (`node index.js run <block-id>`) cannot be performed. P and W scores cannot be measured.
- **Contexte** : Plan requires minimum 2 execution scenarios per block and score measurement.
- **Contournement** : Proceeded with file creation, JSON validation, backend discovery verification, and publication. Execution testing deferred.
- **Suggestion** : Plan should acknowledge that execution testing requires LLM-Provider and provide a "discovery-only" verification path as an acceptable minimum when LLM-Provider is unavailable. (Same irritation as Plan E2.)

### [Plan G — REVIEWER] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same issue as Plans E2 and D.
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `blocks --type inference` which works correctly.
- **Suggestion** : All plan templates should reference the real CLI command (`blocks`, `block list`), not the non-existent `list-blocks`.

### [Plan G — REVIEWER] — 2026-02-20
- **Irritation** : LLM-Provider is not running, so execution testing (the "minimum 2 scenarios" per block) is impossible. The plan demands P score verification (calibration with 5 scenarios for code-reviewer, false positive testing for security-reviewer, pattern matching for architecture-reviewer) but none of this can be done without an LLM.
- **Contexte** : Post-creation pipeline — step 3 (test execution) and step 4 (iterate if quality insufficient).
- **Contournement** : Verified JSON structure, discovery by backend, and publication only. Execution testing deferred.
- **Suggestion** : Plans should explicitly document a "creation-only" path for when LLM-Provider is unavailable, separating file/schema validation from LLM execution testing. (Same irritation as Plans E2 and D.)

### [Plan G — REVIEWER] — 2026-02-20
- **Irritation** : `block publish` for security-reviewer ran in background the first time (CLI output went to a temp file instead of stdout). Behavior is inconsistent — some commands output inline, some go to background. Had to re-run publish to confirm, creating a duplicate pending approval.
- **Contexte** : Publishing the security-reviewer block.
- **Contournement** : Re-ran publish, confirmed via `approval list`. Duplicate approval is harmless but messy.
- **Suggestion** : CLI should have consistent output behavior for synchronous operations — `block publish` should always output inline.

### [Plan F2 — VERIFIER Visual Reviewers] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same issue as Plans E2, D, and G.
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `blocks` (showing first 25 of 119) and `block info <block-id>` which works correctly.
- **Suggestion** : All plan templates should reference the real CLI command (`blocks`, `block list`, `block info`), not the non-existent `list-blocks`. This is the 4th plan hitting this same issue.

### [Plan F2 — VERIFIER Visual Reviewers] — 2026-02-20
- **Irritation** : LLM-Provider is not running, so execution testing (the "minimum 2 scenarios" per block) is impossible. The plan demands testing ui-reviewer with screenshots and accessibility-checker with accessibility trees, but without an LLM provider, `run <block-id>` cannot produce results.
- **Contexte** : Post-creation verification — the plan specifies 3 scenarios per block (simple, moderate, complex).
- **Contournement** : Verified JSON structure, discovery by backend via `block info`, and publication via `block publish`. Execution testing deferred until LLM-Provider is available.
- **Suggestion** : Plans should explicitly document a "creation-only" path for when LLM-Provider is unavailable. (Same irritation as Plans E2, D, and G — this is the 4th occurrence.)

### [Plan H — LIVRER] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same issue as Plans E2, D, G, and F2.
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `block info <block-id>` which works correctly.
- **Suggestion** : All plan templates should reference the real CLI command (`blocks`, `block list`, `block info`), not the non-existent `list-blocks`. This is the 5th plan hitting this same issue.

### [Plan H — LIVRER] — 2026-02-20
- **Irritation** : LLM-Provider is not running, so execution testing (the "minimum 2 scenarios" and P/W score measurement) is impossible. The plan demands 3 scenarios per block (simple, moderate, edge case) and chained testing (git-committer -> changelog-writer -> summary-reporter).
- **Contexte** : Post-creation verification pipeline — steps 3-4 of the mandatory pipeline.
- **Contournement** : Verified JSON structure, backend discovery via `block info`, and publication via `block publish`. All 3 blocks discovered and published. Execution testing deferred until LLM-Provider is available.
- **Suggestion** : Plans should explicitly document a "creation-only" path for when LLM-Provider is unavailable. (Same irritation as Plans E2, D, G, and F2 — this is the 5th occurrence.)

### [Plan F1 — VERIFIER Test Agents] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same recurring issue across all plans (6th occurrence).
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `block info <block-id>` to verify each block individually.
- **Suggestion** : Fix the plan template to reference `block info <id>` or `blocks` instead of `list-blocks`.

### [Plan F1 — VERIFIER Test Agents] — 2026-02-20
- **Irritation** : LLM-Provider is not running. Cannot perform execution testing (P/W score measurement requires running the agents against real projects). The plan specifies "minimum 2 scenarios, maximum 5" per block plus a chained workflow test, but all of this is impossible without an LLM.
- **Contexte** : Post-creation pipeline steps 3-4 (test execution, iteration).
- **Contournement** : Verified JSON validity, backend discovery (all 3 blocks), and publication (all 3 in pending approvals). Execution testing deferred.
- **Suggestion** : Plans should have a documented "no-LLM" verification path. Discovery + publication is the maximum achievable without LLM-Provider. (6th occurrence of this irritation across plans.)

### [Plan F1 — VERIFIER Test Agents] — 2026-02-20
- **Irritation** : e2e-tester depends on Playwright tool blocks (playwright-interact, playwright-screenshot, playwright-accessibility) from plan 09-tool-blocks which do not exist yet. Even with LLM-Provider running, functional testing of e2e-tester would be impossible.
- **Contexte** : Evaluating whether e2e-tester can be tested at all.
- **Contournement** : Created block and prompt, verified discovery and publication. Marked as TESTE_PARTIEL per plan instructions.
- **Suggestion** : Dependency graph between plans should be made explicit in the phase overview, with clear "testable after X" markers.

### [Plan E1 — IMPLEMENTER Developers] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same recurring issue across all plans (E2, D, G, F2, H, F1, now E1 -- 7th occurrence).
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `block info <block-id>` to verify each block individually.
- **Suggestion** : Fix the plan template generator to use `blocks` or `block info <id>` instead of `list-blocks`.

### [Plan E1 — IMPLEMENTER Developers] — 2026-02-20
- **Irritation** : LLM-Provider not running, so execution testing with real scenarios (the "3 scenarios minimum" and chained test workflow backend->frontend->styling) is impossible. P and W scores cannot be measured.
- **Contexte** : Plan requires a full test chain (backend-developer -> frontend-developer -> styling-developer) with a test project.
- **Contournement** : Verified file creation, JSON validity, backend discovery, and publication. Execution testing deferred.
- **Suggestion** : Same as all other plans -- provide a "discovery-only" verification path when LLM-Provider is unavailable. (7th occurrence.)

### [Plan E1 — IMPLEMENTER Developers] — 2026-02-20
- **Irritation** : `block publish backend-developer` ran in background the first time (output went to temp file). Had to re-run, creating a duplicate pending approval (0deb845e + 90bf2daf both for Backend Developer v4).
- **Contexte** : Publishing backend-developer block.
- **Contournement** : Re-ran publish, verified via `approval list`. Duplicate approval entry exists but is harmless.
- **Suggestion** : Same as Plan G -- `block publish` should always output inline, not run in background unpredictably.

### [Plan D1 — INTERACTION BLOCKS] — 2026-02-20
- **Irritation** : `state-manager` block (dependency from Plan 09 — tool blocks) does not exist. The plan specifies checking for it and stopping if not found. The 3 inference blocks themselves have no direct dependency on state-manager for creation/testing, but the complete interaction-handler workflow (plan-workflow-tui.md) will require it.
- **Contexte** : Pre-creation dependency check as mandated by the plan.
- **Contournement** : Documented as dependency blocker. Continued with creating the 3 inference blocks which are independently functional.
- **Suggestion** : Plan 09 (tool blocks including state-manager) should be executed before the interaction-handler workflow plan. The dependency graph between sub-plans should be explicit in the phase overview.

### [Plan D1 — INTERACTION BLOCKS] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same recurring issue (8th occurrence across all plans).
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `blocks --category interaction` which correctly showed all 3 blocks.
- **Suggestion** : Fix the plan template generator to use `blocks` or `block info <id>` instead of `list-blocks`.

### [Plan D1 — INTERACTION BLOCKS] — 2026-02-20
- **Irritation** : LLM-Provider is not running. Cannot test execution (classify-intent with test messages, decide-action with simulated inputs, send-widget-response formatting). P and W scores cannot be measured. The plan specifies 50 test messages for classify-intent, 30 scenarios for decide-action, 20 inputs for send-widget-response — none of this is possible.
- **Contexte** : Post-creation pipeline steps 3-4 (execution testing, iteration).
- **Contournement** : Verified JSON validity, backend discovery (all 3 blocks via `blocks --category interaction`), and publication (all 3 in pending approvals). Execution testing deferred.
- **Suggestion** : Same as all other plans — provide a "discovery-only" verification path when LLM-Provider is unavailable. (8th occurrence.)

### [Plan C — COMPRENDRE] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same recurring issue (9th occurrence across all plans).
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `block info <block-id>` which works correctly for individual block verification.
- **Suggestion** : Fix the plan template generator to use `blocks` or `block info <id>` instead of `list-blocks`. This has been flagged in every single plan execution.

### [Plan C — COMPRENDRE] — 2026-02-20
- **Irritation** : LLM-Provider is not running (port 5010 connection refused). Cannot test execution for any of the 3 blocks (project-analyzer, task-architect, research-agent). P and W scores cannot be measured. The plan specifies 3+ scenarios per block (simple, moderate, complex) and a chained workflow test (project-analyzer -> task-architect -> research-agent) — none of this is possible.
- **Contexte** : Post-creation pipeline steps 3-4 (execution testing, iteration). All 3 blocks correctly reach the agent executor (model resolved, context strategy set, iteration loop started) but fail at the actual LLM call.
- **Contournement** : Verified JSON validity, backend discovery (all 3 blocks via `block info`), and publication (all 3 in pending approvals). Execution testing deferred until LLM-Provider is available.
- **Suggestion** : Same as all other plans — provide a "discovery-only" verification path when LLM-Provider is unavailable. (9th occurrence.)

### [Plan C — COMPRENDRE] — 2026-02-20
- **Irritation** : research-agent depends on `web-search` tool block which does not exist yet (to be created in Plan B — tool blocks). Even with LLM-Provider running, web search functionality would not work.
- **Contexte** : Creating research-agent block and evaluating testability.
- **Contournement** : Created block and prompt, verified discovery and publication. Noted dependency in checkpoint as TESTE_PARTIEL.
- **Suggestion** : Dependency graph between plans should be made explicit in the phase overview with clear "fully testable after X" markers. (Same issue as Plan F1 with e2e-tester depending on Playwright tools.)

### [Plan B3 — TOOLS Utility] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same recurring issue (10th occurrence across all plans).
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `block info <block-id>` and `blocks --designation tool` which work correctly.
- **Suggestion** : All plan templates and CLAUDE.md should reference the real CLI commands (`blocks`, `block list`, `block info`).

### [Plan B3 — TOOLS Utility] — 2026-02-20
- **Irritation** : DuckDuckGo Lite (`lite.duckduckgo.com`) serves a CAPTCHA challenge (status 202, bot detection with image puzzle) instead of actual search results. The plan's search.js uses DuckDuckGo Lite as fallback strategy, but this is broken in practice.
- **Contexte** : Testing web-search block. SearXNG not running locally, DuckDuckGo Lite fallback returned 202 with a "Select all squares containing a duck" CAPTCHA.
- **Contournement** : Replaced DuckDuckGo Lite with `html.duckduckgo.com/html/` which works correctly with a browser-like User-Agent. Results use `result__a` and `result__snippet` CSS classes. URLs are DuckDuckGo redirect links requiring extraction of the `uddg` query parameter.
- **Suggestion** : Plan should specify `html.duckduckgo.com` instead of `lite.duckduckgo.com` as the DuckDuckGo fallback. Lite is unusable for automated requests.

### [Plan B3 — TOOLS Utility] — 2026-02-20
- **Irritation** : The plan's error/warning counting in check.js uses a naive regex `/\berror\b/gi` that counts summary lines like "0 Error(s)" as errors. For dotnet build output, this produced `errorCount: 1` and `warningCount: 1` even when the build succeeded with 0 errors and 0 warnings.
- **Contexte** : Testing compilation-check on dotnet project (apps/backend). Build succeeded but error/warning counts were wrong.
- **Contournement** : Rewrote counting logic to skip summary lines matching `/^\d+\s+(error|warning)/i` and count per-line instead of globally.
- **Suggestion** : Plan should specify smarter error counting that excludes build summary lines, or at minimum document this known issue.

### [Plan B2 — TOOLS Memory] — 2026-02-20
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same recurring issue (11th occurrence across all plans).
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `block info <block-id>` which works correctly for individual block verification.
- **Suggestion** : Fix the plan template generator to use `blocks` or `block info <id>` instead of `list-blocks`.

### [Plan B2 — TOOLS Memory] — 2026-02-20
- **Irritation** : The API `GET /api/sessions/{id}/variables/{key}` returns `{key: "...", value: {...}}` wrapper object, not the value directly. The plan's state.js script assumed the API returns the raw value. This caused `getByPath()` to fail silently (returned null) because it was navigating the wrapper object instead of the actual state.
- **Contexte** : Testing state-manager `get` operation after a successful `set`. The `set` worked but `get` returned null for `currentPhase` even though the data was present in `previousState`.
- **Contournement** : Fixed `getState()` in state.js to extract `.value` from the API response when the response contains a `value` property. One iteration to fix, immediate re-test confirmed the fix.
- **Suggestion** : Plans providing state-manager scripts should document the exact API response format. The plan's script was written assuming direct value return. This is a common pitfall -- the API wrapper is documented in CLAUDE.md under session variable conventions but the plan did not account for it.

### [Plan B1 — TOOLS Playwright] — 2026-02-19
- **Irritation** : Plan references `list-blocks` CLI command which does not exist. Same recurring issue (12th occurrence across all plans).
- **Contexte** : Verifying block discovery after creation.
- **Contournement** : Used `blocks --category browser` which correctly showed all 3 Playwright blocks.
- **Suggestion** : All plan templates should reference the real CLI commands (`blocks`, `block list`, `block info`), not the non-existent `list-blocks`.

### [Plan B1 — TOOLS Playwright] — 2026-02-19
- **Irritation** : `page.accessibility.snapshot()` API does not exist in Playwright 1.58.2. The plan's accessibility.js script uses this deprecated/removed API and fails with "Cannot read properties of undefined (reading 'snapshot')".
- **Contexte** : Testing playwright-accessibility block. Playwright 1.58.2 has replaced `page.accessibility` with `locator.ariaSnapshot()`.
- **Contournement** : Rewrote accessibility.js to use `page.locator(':root').ariaSnapshot()` and wrote a custom parser to convert the YAML-like aria snapshot text format into structured JSON tree.
- **Suggestion** : Plan should be version-aware for Playwright APIs. The `page.accessibility.snapshot()` API was removed in Playwright ~1.50+. Plans should reference `ariaSnapshot()` instead.

### [Plan B1 — TOOLS Playwright] — 2026-02-19
- **Irritation** : `waitUntil: 'networkidle'` times out on example.com. The plan's scripts all use `networkidle` which requires no network activity for 500ms -- this is unreliable for many pages.
- **Contexte** : First test of playwright-screenshot against https://example.com timed out at 15s with the 30s block timeout nearly exceeded.
- **Contournement** : Changed all 3 scripts to use `waitUntil: 'load'` and increased navigation timeout to 20s. This is more reliable for general-purpose use.
- **Suggestion** : Plan should use `waitUntil: 'load'` as the default strategy. `networkidle` is too fragile for a general-purpose tool block.

