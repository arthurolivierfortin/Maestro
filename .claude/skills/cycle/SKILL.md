---
name: cycle
description: Main Maestro dev loop — picks the next issue, runs spec-aware research → TDD build → 2-stage judge review → tui-verifier (if UI), merges if approved. Replaces /dev-cycle.
user-invocable: true
---

# Development Cycle — Maestro

Tu es l'orchestrateur de développement pour Maestro. **Tu ne construis PAS et tu ne reviewes PAS toi-même.** Tu spawn des subagents pour chaque phase.

**Référence philosophique** : `docs/system/CYCLE.md` (anti-patterns + verdicts JSON schemas).

**Companion command** : `/cycle-start` pour brainstormer + spec-writer une NEW feature en issue GitHub. `/cycle` (ce skill) prend les issues existantes et les shippe.

**Distinction critique** : `/cycle` sert à **développer Maestro**. Ne pas confondre avec les sessions Maestro qui orchestrent des agents sur des projets cibles. Voir CLAUDE.md "Developing Maestro vs Using Maestro".

## Step 0 — Pull latest

```bash
git checkout dev 2>/dev/null || git checkout -b dev
git pull origin dev 2>/dev/null || true
```

## Step 1 — Pick the next issue

### 1a. Ad-hoc priority work

```bash
gh issue list --repo arthurolivierfortin/Meastro --label "ad-hoc" --label "P:high" --state open --limit 1 --json number,title
```

Si présent → utilise cette issue.

### 1b. Sinon, current roadmap phase

Lire `docs/ROADMAP.md` pour trouver la phase active marquée `[EN COURS]`.

```bash
PHASE=$(grep -oP '\[EN COURS\].*Phase-\K\d+' docs/ROADMAP.md | head -1)
gh issue list --repo arthurolivierfortin/Meastro --label "R:phase-$PHASE" --label "todo" --state open --limit 1 --json number,title
```

Si aucune issue `todo` pour la phase :
- Toutes closed → "Phase <N> complete! Review and approve to advance." STOP.
- Certaines open (in-progress/in-review) → "Phase <N> has issues in progress. Wait." STOP.
- Aucune issue n'existe pour la phase → "No issues for Phase <N>. Run /cycle-start." STOP.

## Step 2 — Verify the issue has a checklist

L'issue body DOIT linker `docs/phases/PHASE-<N>/specs/<...>-checklist.md`. Si non :

- Old issues sans checklist = legacy — proposer de lancer `/cycle-start` pour le topic de l'issue afin de l'amener au nouveau format. Sinon STOP.

## Step 3 — Research — dispatch researcher

```
Agent(
  subagent_type="researcher",
  prompt="Research and plan implementation for issue #<NUMBER>: <TITLE>.
Spec: <spec path from issue body>
Checklist: <checklist path from issue body>
Component tags: <[sdk] | [code-app] | both>
Read CLAUDE.md and docs/guides/ai-agents/common-pitfalls.md FIRST.
Follow your agent instructions exactly. Write result to .maestro/cycle/plan_verdict.json."
)
```

Lire `.maestro/cycle/plan_verdict.json` :
- `approved` → Step 4
- `blocked` → label issue `blocked`, post raison en comment, STOP
- `needs_input` → dire ce qui manque, STOP

## Step 4 — Build — dispatch builder

```
Agent(
  subagent_type="builder",
  prompt="Implement issue #<NUMBER>: <TITLE>.
Plan: .maestro/cycle/plan_verdict.json
Spec: <spec path>
Checklist: <checklist path>
Follow your agent instructions exactly (TDD per [SPEC-N], tick checklist, run all 6 TESTING-PROTOCOL layers applicable, commit per SPEC, open PR).
Write result to .maestro/cycle/build_verdict.json. Do NOT merge."
)
```

Lire `.maestro/cycle/build_verdict.json` :
- `pr_created` avec `items_skipped: []` → Step 5
- `pr_created` avec `items_skipped` non vide → REJECT — builder ne peut pas shipper avec items skipped. Comment sur PR, set issue à `todo`. STOP.
- `failed` → comment raison sur issue, STOP.

## Step 5 — Judge — dispatch judge (2-stage review)

```bash
gh pr list --base dev --state open --json "number,title" --limit 10
```

```
Agent(
  subagent_type="judge",
  prompt="Review PR #<PR_NUMBER> for issue #<ISSUE_NUMBER>.
Linked checklist: <checklist path>
Plan: .maestro/cycle/plan_verdict.json
Run Stage 1 (spec compliance + Cardinal Rule + No Legacy Support) THEN Stage 2 (6-layer TESTING-PROTOCOL + quality).
Follow your agent instructions exactly (strict verdict schema, sandbox output mandatory).
Write result to .maestro/cycle/review_verdict_pr<PR_NUMBER>.json."
)
```

Lire `.maestro/cycle/review_verdict_pr<N>.json` :
- **Valider le schéma**. Si `stage2_quality.sandbox` est manquant ou vide → REJECT verdict, re-dispatch judge.
- `verdict: approved` → Step 5.5
- `verdict: request_changes` → Step 7
- `verdict: rejected` → close PR, re-open issue as `todo` avec raison

## Step 5.5 — TUI Verifier (TUI-touching PRs only)

```bash
gh pr diff <PR_NUMBER> --name-only
```

Si la sortie contient `packages/maestro-code/.*\.ts` OU le SPEC mentionne UI/UX/TUI :

```
Agent(
  subagent_type="tui-verifier",
  prompt="Run TUI verification for PR #<PR_NUMBER>.
PR number: <PR_NUMBER>
Use tui-dogfood MCP tools (tui_spawn, tui_frame, tui_press, etc.).
Write result to .maestro/cycle/tui_verdict_pr<PR_NUMBER>.json."
)
```

Sinon : log `tui-verifier skipped (no TUI changes)` et passer à Step 6.

Lire `.maestro/cycle/tui_verdict_pr<PR_NUMBER>.json` :
- `verdict: approved` → Step 6
- `verdict: request_changes` → Step 7 (builder retry, **cap 2x SHARED avec judge**)
- `verdict: needs_manual` → output `manual_followups` list, **HALT et attendre confirmation utilisateur**
- `verdict: skipped` → Step 6
- `verdict: error` → log error field avec contexte diag, proceed Step 6 (ne pas bloquer cycle sur infra failure mais surface)

## Step 6 — Merge

```bash
PR_TITLE=$(gh pr view <PR_NUMBER> --json title --jq .title)
gh pr merge <PR_NUMBER> --rebase --delete-branch --subject "$PR_TITLE"
gh issue close <ISSUE_NUMBER>
```

(Memory: `feedback_commit_conventions` — **rebase merge**, NEVER squash. Préserve un commit par [SPEC-N].)

**Mettre à jour MEMORY.md** si la phase active progresse ou si une décision architecturale importante a été prise.

## Step 7 — Re-build on changes_requested (max 2 retries SHARED entre judge et tui-verifier)

```
Agent(
  subagent_type="builder",
  prompt="Address judge/tui-verifier feedback on PR #<PR_NUMBER>.
Judge verdict: .maestro/cycle/review_verdict_pr<N>.json
TUI verdict (if applicable): .maestro/cycle/tui_verdict_pr<N>.json
For each blocking_item and important issue, fix it.
Re-run ALL gates that previously passed (the 6 TESTING-PROTOCOL layers applicable).
Push to the same branch. Do NOT merge.
Write updated .maestro/cycle/build_verdict.json."
)
```

Puis loop back à Step 5 (re-dispatch judge).

Après 2 retries `request_changes` (total cap shared entre judge et tui-verifier) :
- REJECT le PR — close, re-open issue `todo` avec dernier verdict pasted en comment, STOP.

## Step 8 — Return to dev

```bash
git checkout dev
git pull origin dev
```

## Summary

```
/cycle
  ├─ Step 0: git pull dev
  ├─ Step 1: ad-hoc P:high? → use that issue
  │           else → next R:phase-<N>/todo issue
  ├─ Step 2: verify issue has linked checklist (else /cycle-start)
  ├─ Step 3: Agent(researcher) → plan_verdict.json
  ├─ Step 4: Agent(builder)    → TDD per [SPEC-N], tick checklist, 6-layer gates, PR
  ├─ Step 5: Agent(judge)      → Stage 1 spec+Cardinal Rule+No Legacy → Stage 2 sandbox+quality
  │     ├─ approved          → Step 5.5
  │     ├─ request_changes   → builder fix + re-judge (max 2x)
  │     └─ rejected          → close PR, re-open issue
  ├─ Step 5.5: Agent(tui-verifier) si TUI touchée → tui-dogfood MCP heuristics
  │     ├─ approved          → Step 6
  │     ├─ request_changes   → builder fix + re-verify (shares 2x retry cap)
  │     ├─ needs_manual      → output manual_followups, HALT for user confirm
  │     └─ skipped/error     → log + Step 6
  ├─ Step 6: rebase merge, close issue, update MEMORY.md
  └─ Step 8: git checkout dev
```

## Rules

- **NEVER do the work yourself** — spawn `Agent()` pour chaque phase
- **Une issue par invocation** de /cycle
- **Max 2 builder→judge retries** SHARED avec tui-verifier (total cap 2x)
- **Phase transitions** require human approval (issue close ≠ phase advance)
- **Judge verdict MUST include sandbox output** — REJECT le verdict si missing
- **ALL changes via PR** vers `dev` (jamais push direct dev/main)
- **tui-verifier dispatched only when** PR diff touche `packages/maestro-code/**/*.ts` OU spec mentionne UI/UX/TUI
- **tui-verifier `needs_manual`** → halt cycle, output manual_followups, attendre confirmation utilisateur
- **Cardinal Rule litmus test** dans Stage 1 du judge : "Can a new session type be created with ONLY JSON changes?"
- **No Legacy Support enforcement** dans Stage 1 du judge
- **6-layer TESTING-PROTOCOL** dans Stage 2 du judge (intersect avec ce qui est touché)
- **Tags `[sdk]` vs `[code-app]`** vérifiés par judge (préparation soft split)
- **Memory `Infrastructure Before Models`** : provider verification AVANT toute exécution agent
