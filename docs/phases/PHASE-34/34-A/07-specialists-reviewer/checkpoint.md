## Plan G : Specialists REVIEWER
**Statut** : DONE (creation + discovery + publication; execution testing deferred — LLM-Provider not running)
**Date** : 2026-02-20
**Blocs crees** : 3 / 3
  - code-reviewer : REMPLACE v2->v4 / DECOUVERT / PUBLIE (ccd5ae36)
  - security-reviewer : CREE / DECOUVERT / PUBLIE (9991f9a7)
  - architecture-reviewer : CREE / DECOUVERT / PUBLIE (761eba25)
**P score** :
  - code-reviewer : N/A (LLM-Provider not running — cannot execute)
  - security-reviewer : N/A (LLM-Provider not running — cannot execute)
  - architecture-reviewer : N/A (LLM-Provider not running — cannot execute)
**W score** :
  - code-reviewer : N/A (LLM-Provider not running — cannot execute)
  - security-reviewer : N/A (LLM-Provider not running — cannot execute)
  - architecture-reviewer : N/A (LLM-Provider not running — cannot execute)
**Calibration** :
  - code-reviewer calibration (5 scenarios) : DEFERRED (no LLM)
  - security-reviewer false positive rate : DEFERRED (no LLM)
  - architecture-reviewer vs project patterns : DEFERRED (no LLM)
**Score combine formula verified** : OUI (formula documented in spec and system prompts)
**Veto rules tested** : NON (requires LLM execution)
**Problemes** : LLM-Provider not running — all execution-dependent verification deferred

## Verification performed
- Backend health: OK (http://localhost:5000/api/health returns healthy)
- Discovery: All 3 blocks discovered via `blocks --type inference` command
  - code-reviewer: v4.0.0, inference, development (v2 overwritten — no legacy)
  - security-reviewer: v4.0.0, inference, development (new)
  - architecture-reviewer: v4.0.0, inference, development (new)
- Publication: All 3 blocks submitted for approval via `block publish`
- Approval list: All 3 visible in `approval list` as pending
- JSON structure: All block definitions follow codebase format (inputs as array, systemPromptFile, no designation)
- System prompts: All 3 use external system-prompt.md files with complete prompts from spec

## Files created/modified
- `content/system/blocks/inference/code-reviewer/code-reviewer.inference.block.json` (REPLACED v2 with v4)
- `content/system/blocks/inference/code-reviewer/system-prompt.md` (NEW — external prompt file)
- `content/system/blocks/inference/security-reviewer/security-reviewer.inference.block.json` (NEW)
- `content/system/blocks/inference/security-reviewer/system-prompt.md` (NEW)
- `content/system/blocks/inference/architecture-reviewer/architecture-reviewer.inference.block.json` (NEW)
- `content/system/blocks/inference/architecture-reviewer/system-prompt.md` (NEW)

## Key decisions
- Used `systemPromptFile: "system-prompt.md"` for all 3 (prompts are 50-90 lines each)
- Removed `metadata.designation` from code-reviewer (v2 had `"designation": "autonomous"` which is incorrect for inference blocks)
- Removed `config.outputKey` from code-reviewer (v2 had it, not in v4 spec)
- Updated model from `claude-opus` to `claude-opus-4-6`
- Increased maxTokens from 2048 to 4000 (v4 produces richer output with 7 axes + detailed notes)
