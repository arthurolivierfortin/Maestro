# Notes de travail — Phase 34-A

**Date** : 2026-02-19
**Agent** : Claude Opus 4.6
**But** : Capturer les insights cles de la lecture des documents de reference et de la recherche web pour informer la redaction de AGENT-V4-SPEC.md

---

## 1. Analyse de la requete du createur

**Points non-negociables** :
- Agent EXCEPTIONNELLEMENT meilleur que Claude Code brut — pas juste "correct"
- Interruptible sans perte de memoire/plan/structure
- Verification visuelle — l'agent DOIT voir le UI qu'il cree
- Compose de sous-agents specialises (frontend, backend, styling, review, E2E)
- Capable de prendre un projet entier et le finir
- Animations poussees, stylisation, amelioration du design
- Degradation progressive par paliers de ~5% (pas 5 tiers fixes)
- Outils open-source/generiques uniquement (Playwright, Docker — pas de plugins provider-specific)

**Ce qui manque dans v3.1** (9 blocs actuels) :
- Pas de verification visuelle
- Pas de specialisation frontend/backend/styling
- Pas d'interaction handler (pause/resume/rewind)
- Pas de memoire inter-sessions
- Pas de recherche web
- Pas de testing E2E
- Pas de review securite/architecture
- Un seul passage (pas de boucle while pour iterer)
- Pas de design/animations

---

## 2. Etat de l'art — Insights cles (fevrier 2026)

### Multi-agent
- **Leader Pattern** (Devin, Claude Code Swarms) : un lead decompose, des workers executent, des judges evaluent
- **File ownership isolation** : chaque agent travaille sur des fichiers differents pour eviter les conflits — c'est la coordination la plus pragmatique
- **Fresh context per sub-task** (Ralph Loop) : un agent frais par tache evite la derive d'hallucination. Tests = criteres de completion obligatoires
- **Three-tier model routing** : Opus pour planning/architecture, Sonnet pour implementation, Haiku pour validation/CI — "l'unlock c'est le routing, pas les capabilities"

### Verification visuelle
- **Accessibility tree FIRST, screenshots SECOND** — c'est le consensus 2026
  - Accessibility tree = 2-5KB de donnees structurees vs image
  - 10-100x plus rapide que screenshots
  - Stable a travers les refactoring (noms semantiques persistent, classes CSS changent)
- **Hybrid mode** : accessibility tree pour 90% des interactions, vision/screenshots pour canvas, WebGL, bugs visuels CSS
- **Self-correcting loop** : modifier composant → lancer browser headless → screenshot → analyser → corriger → repeter
- **Shadow DOM warning** : les design systems modernes cachent des elements dans des shadow roots — l'accessibility tree ne les voit pas

### Interaction human-agent
- **Checkpoint-based persistence** (LangGraph) : etat sauvegarde a chaque super-step, resume exact meme apres des heures
- **Confidence-based routing** : l'agent evalue sa confiance et escalade au humain automatiquement si en dessous du seuil
- **Human-as-a-tool** : plutot que des gates fixes, l'agent traite le jugement humain comme un outil callable
- **Explore → Plan → Code → Commit** pattern : empeche le "YOLO coding"

### Memoire
- 4 types formalises : Working (contexte actuel), Semantic (faits/patterns), Episodic (historique), Procedural (skills)
- **Mem0** : 26% d'amelioration sur LLM-as-a-Judge, 91% reduction latence p95
- **Event-sourced state** (OpenHands) : tous les events sont immutables, replay deterministe possible
- **.maestro/memory/** aligne avec les patterns du marche (fichiers markdown organises par topic)

---

## 3. Architecture Maestro existante — Contraintes

### Ce qui EXISTE et qu'on utilise :
- Workflow engine avec `while`, `for-each`, `conditional` — IMPLEMENTES dans EntryPointExecutor.cs
- Block hierarchy (workflow > agent > tool)
- CLI generique (session, invoke, monitor)
- TUI monitor + maestro code
- LLM-Provider gateway (multi-provider)
- 9 blocs v3.1 avec system prompts
- Session templates avec variables, entry points, monitor descriptor

### Ce qui N'EXISTE PAS :
- **`parallel` block** : concu dans DESIGN-CONTROL-FLOW-BLOCKS.md mais PAS implemente dans EntryPointExecutor.cs — CRITIQUE pour l'interaction-handler qui tourne en parallele du workflow
- State manager (tool block partage)
- Widget protocol dans maestro code
- Checkpointing dans EntryPointExecutor (pour pause/resume)
- Blocs Playwright (screenshot, accessibility, interact)
- Bloc web-search
- Bloc memory-read/write
- Vision model support dans les blocs inference

### Format des blocs existants :
- `.block.json` avec `config.systemPromptFile: "system-prompt.md"` pour les agents
- Agents utilisent `maestro_cli` comme unique tool
- Commandes disponibles : `run file-read`, `run file-write`, `run directory-list`, `run shell-execute`
- Pattern : "ONE tool call per response" — response = un JSON object
- Output via `{"tool":"done","args":{"summary":"..."}}`

### Conventions system prompts v3.1 :
- CRITICAL RULES en haut
- Workflow obligatoire (sequence d'etapes)
- Tool = `maestro_cli` avec commandes specifiques
- Format de sortie `done` avec summary JSON
- Limites explicites (max tool calls, timeouts)
- Anti-hallucination (NEVER claim without tool call, NEVER invent numbers)

---

## 4. Design decisions pour v4

### Interaction-handler (Phase 28 design) :
- Agent composite (`isAtomic: false`) en PARALLELE du workflow
- 4 noeuds internes : classify-intent → decide-action → execute-action → send-response
- State manager comme unique source de verite
- Operations : get, set, transition, pause, resume, rewind, inject
- Widget protocol : message, option-select, text-input, confirmation, progress, plan-view, diff-view, test-results
- Scenarios : question simple, feedback urgent, changement de direction, override

### Modeles Tier 1 :
- Opus 4.6 : task-architect, code-reviewer, security-reviewer, architecture-reviewer, interaction-handler
- Sonnet 4.6 : tous les autres (implementation, testing, styling, etc.)

### Nombre de blocs a concevoir :
- ~19 blocs specialistes (agents/inference)
- ~7 blocs tool nouveaux (Playwright, web-search, compilation-check, memory, state-manager)
- 1 workflow orchestrateur
- = ~27 blocs total

### Fitness V2 appliquee :
```
ModelFitness = (P x S x W) / (C_norm x C_compute x C_hw)^lambda
```
- P = Performance (tests passes, format respecte)
- S = Specialisation (P / entropie des taches)
- W = Composabilite (1 - taux hallucination)
- Couts normalises
- lambda = 1.5

---

## 5. Points d'attention pour la redaction

1. **L'interaction-handler est LE differenciateur** — chapitre substantiel, pas 5 lignes
2. **System prompts REELS** — pas de placeholders, pas de TODO
3. **Anti-patterns par bloc** — minimum 3 par specialiste
4. **Parallel block non implemente** — documenter comme dependance technique CRITIQUE
5. **Accessibility tree first** — le ui-reviewer doit privilegier l'arbre d'accessibilite aux screenshots
6. **Fresh context pattern** — chaque specialiste recoit un contexte minimal et focus
7. **Checkpointing** — chaque noeud du workflow doit sauvegarder son etat
8. **Pas de copie v3.1** — les prompts doivent etre significativement ameliores

---

## 6. Sources web consultees

- Anthropic 2026 Agentic Coding Trends Report
- Claude Code Agent Teams / Swarms (Addy Osmani)
- OpenHands SDK Architecture (arXiv 2511.03690)
- Playwright MCP (Microsoft GitHub)
- Stagehand v3 (Browserbase)
- Browser Use framework
- Mem0 research paper (arXiv 2504.19413)
- LangGraph persistence docs
- Ralph Loop pattern (snarktank/ralph)
- Mike Mason: AI Coding Agents Coherence Through Orchestration
- Devin AI architecture analysis
- METR research on developer productivity perception gap
