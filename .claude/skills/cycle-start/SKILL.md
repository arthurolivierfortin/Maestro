---
name: cycle-start
description: Start a new Maestro feature — brainstorm with the user in main thread, write spec + checklist via spec-writer subagent, then create a GitHub issue. Use when you have an idea you want to ship through /cycle.
user-invocable: true
---

# Cycle Start — Maestro

Goal : from "j'ai une idée" → "issue GitHub avec spec + checklist machine-readable, prête pour /cycle".

**Brainstorming reste dans le thread principal** (avec l'utilisateur). Spec writing est délégué à `spec-writer` subagent.

**Référence philosophique** : `docs/system/CYCLE.md`

## Phase 1 — Brainstorm (thread principal, avec l'utilisateur)

NE PAS dispatcher un subagent pour brainstormer. Les subagents travaillent en isolation.

### 1a. Explorer le contexte du projet

```bash
cat docs/ROADMAP.md
cat C:/Users/arthu/.claude/projects/C--Meastro/memory/MEMORY.md
gh issue list --label "ad-hoc" --state open --limit 5
git log --oneline -10
```

Lire 2-3 fichiers source liés à ce que l'utilisateur décrit. Vérifier la phase active dans la ROADMAP.

### 1b. Questions de clarification (une à la fois)

Focus sur :
- **Purpose** — quel problème on résout
- **Scope (in)** — qu'est-ce qui est inclus
- **Scope (out)** — qu'est-ce qui est explicitement YAGNI
- **Composant impacté** : `[sdk]` ou `[code-app]` ? (Voir `CYCLE.md` règle 14)
- **Phase roadmap** — dans quelle phase V1/V2 ça s'inscrit
- **Couches TESTING-PROTOCOL** applicables (1-6)
- **Critères de succès** — comment on saura que c'est fait

### 1c. Proposer 2-3 approches

Chacune avec tradeoffs. Mener avec la recommandation. Si l'utilisateur propose une 4e, l'évaluer aussi.

### 1d. Présenter le design (par sections, approbation par section)

Couvrir :
- **Architecture** — où ça vit dans `apps/backend/` ou `packages/maestro-code/`, quel block, quel contract
- **Composants / data flow** — qui appelle qui
- **Cardinal Rule check** — est-ce que ça respecte "Generic Infrastructure, Specific Content" ? Une nouvelle session type doit pouvoir être créée par JSON only.
- **No Legacy Support check** — qu'est-ce qu'on supprime ?
- **Error handling** — référence `docs/system/conventions/error-handling.md`
- **Test strategy** — quelles couches du TESTING-PROTOCOL s'appliquent

Échelle chaque section à sa complexité. Quelques phrases si simple, 200-300 mots si nuancé.

### 1e. HARD GATE — Approbation utilisateur

NE PAS passer à Phase 2 sans approbation explicite. "Ça me va", "oui", "go" comptent. Ambigu → poser une question de plus.

## Phase 2 — Écrire le brainstorm summary

Écrire `.maestro/cycle/brainstorm.md` (créer le dossier si nécessaire) :

```markdown
# Brainstorm — <topic>
**Date:** YYYY-MM-DD
**Roadmap phase:** Phase-<N>
**Tags:** [sdk] | [code-app] | both

## Problem
<1 paragraphe — pourquoi on fait ça>

## Decisions
- <bullets — ce qui a été choisi et pourquoi>

## Scope (in)
- <bullets>

## Scope (out — YAGNI explicite)
- <bullets>

## Architecture
<2-3 paragraphes approuvés>

## Cardinal Rule check
<comment ce changement respecte ou nécessite d'amender la Cardinal Rule>

## Affected systems
- Backend C#: <fichiers/services>
- LLM-Provider: <si applicable>
- TUI: <packages/maestro-code, si applicable>
- CLI: <packages/maestro-cli, si applicable>
- Blocks: <content/system/blocks, si applicable>
- Contracts: <content/system/contracts, si applicable>

## TESTING-PROTOCOL layers applicable
- [ ] Layer 1: Type Check
- [ ] Layer 2: Unit Tests
- [ ] Layer 3: Visual Gate
- [ ] Layer 4: Real Demo Check (mandatory si TUI)
- [ ] Layer 5: Integration
- [ ] Layer 6: E2E Dogfooding (tui-verifier)

## Open questions
- <bullets — flagger pour spec-writer>
```

## Phase 3 — Dispatch spec-writer

```
Agent(
  subagent_type="spec-writer",
  prompt="Convert the brainstorm at .maestro/cycle/brainstorm.md into a spec + checklist.
Roadmap phase: Phase-<N>.
Tags: [sdk] | [code-app] | both.
Issue context: <if existing issue, give number and title>.
Follow your agent instructions exactly. Write outputs and emit .maestro/cycle/spec_verdict.json."
)
```

Lire `.maestro/cycle/spec_verdict.json` :
- `ready` → Phase 4
- `needs_decomposition` → présenter le split à l'utilisateur. Il choisit lequel attaquer en premier ; les autres deviennent des issues futures. Re-dispatcher spec-writer pour le sub-feature choisi.

## Phase 4 — L'utilisateur review la spec

```
Spec écrite à <spec_path>.
Checklist à <checklist_path>.

Stp review les deux fichiers et dis-moi si tu veux des changements avant que je crée l'issue GitHub.
```

Attendre la réponse. Si changements demandés, éditer spec/checklist et reboucler. Ne passer à Phase 5 qu'après approbation.

## Phase 5 — Créer l'issue GitHub

```bash
PHASE=$(grep -oP '\[EN COURS\].*Phase-\K\d+' docs/ROADMAP.md | head -1)
[ -z "$PHASE" ] && PHASE="65"

gh issue create \
  --repo arthurolivierfortin/Meastro \
  --title "<feature title>" \
  --body "$(cat <<'EOF'
## Goal
<one sentence from spec>

## Tags
- Component: [sdk] | [code-app] | both
- Phase: Phase-<N>

## Linked spec
docs/phases/PHASE-<N>/specs/YYYY-MM-DD-<topic>-design.md

## Checklist
docs/phases/PHASE-<N>/specs/YYYY-MM-DD-<topic>-checklist.md

## TESTING-PROTOCOL layers
- Layer 1: Type Check
- Layer 2: Unit Tests
- Layer 4: Real Demo Check (si TUI)
- (autres selon brainstorm)
EOF
)" \
  --label "R:phase-$PHASE,feature,todo,P:normal"
```

Pour ad-hoc work hors roadmap : `--label "ad-hoc,todo,P:<priority>"`.

## Phase 6 — Hand off

```
Issue #<NUMBER> créée.

Lance /cycle pour la prendre en charge — researcher → builder → judge → (tui-verifier si UI).
Ou si tu veux shipper plusieurs features aujourd'hui, lance /cycle-start à nouveau pour la suivante.
```

## Rules

- Brainstorming JAMAIS dans un subagent
- NE PAS skipper Phase 1d (présentation design) même pour features "simples"
- NE PAS skipper Phase 4 (user review spec) — la spec écrite est ce qui lie /cycle
- Spec vit dans `docs/phases/PHASE-<N>/specs/` (phase-aware Maestro)
- Verdict files vivent dans `.maestro/cycle/` (scoped to cycle infrastructure, gitignored optionnel)
- Une feature par invocation de /cycle-start. Si le brainstorm révèle 3 features, créer 3 issues séquentiellement.
- TOUJOURS tagger `[sdk]` vs `[code-app]` (préparation soft split V2)
