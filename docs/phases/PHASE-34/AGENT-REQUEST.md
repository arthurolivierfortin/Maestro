# Phase 34 : Analyse de la requete et recherche

**Date** : 2026-02-19
**Auteur** : Claude Code (session d'analyse, corrige)
**But** : Ce document analyse la requete du createur de Maestro, synthetise la recherche web sur l'etat de l'art, et fournit des recommandations concretes. Il doit etre donne a un agent qui creera le plan de conception detaille.

---

## 1. Requete du createur (synthese)

### Ce qu'il veut

> "Je veux un dev fullstack qui sort de l'ordinaire. Je veux qu'il soit exceptionnelle."

Pas un simple wrapper autour d'un LLM. Un agent autonome capable de :

1. **Prendre un projet entier** et le finir — pas juste des micro-taches
2. **Etre interruptible** via le CLI sans perdre sa structure, sa memoire, son plan
3. **Avoir des reflexes de pro** — verifier le UI visuellement, ne pas coder aveuglement, tester, iterer
4. **Creer des animations poussees**, styliser, ameliorer le design
5. **Se voir** — l'agent doit pouvoir observer le resultat de son travail (screenshot, browser, etc.)
6. **Etre compose de sous-agents specialises** — frontend, backend, UI review, etc.
7. **S'auto-ameliorer a terme** — creer ses propres outils (d'ou Docker + permissions)
8. **Depasser considerablement Claude Code** — sinon pas de valeur ajoutee

### Ce qu'il ne veut PAS

- 5 tiers fixes et arbitraires — plutot une degradation progressive par paliers de ~5%
- Passer a Phase 35-36 avant d'avoir un agent exceptionnellement utile
- Un agent "correct" — le seuil est "meilleur que Claude Code utilise directement"
- **Utiliser directement des outils lies a un provider** (plugins Claude Code, etc.) — on s'en inspire, mais Maestro doit fonctionner avec n'importe quel modele
- **Reinventer la roue** — les outils open-source et generiques (Playwright, Docker, etc.) sont a reutiliser directement

### Changement de structure de Phase 34

- **34-A** : Construire le Tier 1 exceptionnel (l'agent ultime, multi-specialiste)
- **34-B+** : Degradation progressive des modeles par paliers de 5%, jusqu'a ce que le fitness soit inacceptable
- Chaque tier est mesure, publie avec manifeste

---

## 2. Etat de l'art — Agents de dev autonomes (fevrier 2026)

### 2.1 Les leaders du marche

| Agent | Type | Forces | Faiblesses | Prix |
|-------|------|--------|------------|------|
| **Devin** (Cognition) | SaaS ferme | End-to-end autonome, planifie/code/teste/itere | $500/mois, opaque, pas customisable | $$$ |
| **OpenHands** | Open-source | Multi-agent, web UI, VS Code, Jupyter, browser integre | Complexe a deployer, resource-heavy | Gratuit |
| **SWE-Agent** (Princeton) | Research | Agent-Computer Interface innovant, excellent sur SWE-bench | Oriente bug fixes, pas creation | Gratuit |
| **Claude Code** (Anthropic) | CLI/IDE | Subagents, hooks, MCP, excellent contexte | Single agent, pas de verification visuelle native | Abonnement |
| **Cursor/Windsurf** | IDE | UX fluide, inline diffs | Pas vraiment autonome, surtout assistance | $$ |
| **MetaGPT** | Framework | Simule une equipe (PM, dev, QA), workflow structure | Lourd, abstraction elevee | Gratuit |

### 2.2 Ce que Devin fait que les autres ne font pas

Devin est le benchmark a battre. Ce qui le distingue :
- **Environnement complet** : terminal, editeur, navigateur dans un sandbox
- **Planification visible** : l'utilisateur voit le plan avant execution
- **Iteration autonome** : si les tests echouent, il corrige et re-essaye
- **Navigation web** : recherche de documentation, StackOverflow, etc.
- **Commit quand c'est pret** : pas de commit premature

### 2.3 Ce qu'OpenHands fait de bien

- **Multi-agent reel** : agents specialises qui collaborent
- **Browser integre** : l'agent peut voir et interagir avec le UI
- **Jupyter** : pour l'analyse de donnees et la visualisation
- **VS Code workspace** : l'agent travaille dans un vrai IDE
- **Sandbox Docker** : execution securisee

### 2.4 Tendances 2026 (Rapport Anthropic)

Le rapport Anthropic "2026 Agentic Coding Trends" identifie 8 tendances :

1. **Les ingenieurs deviennent des orchestrateurs** — ils coordonnent des agents, pas du code
2. **Multi-agent > single agent** — agents specialises en parallele > un gros agent generaliste
3. **60% du travail avec AI, mais seulement 0-20% delegable entierement** — l'humain reste dans la boucle
4. **Securite des le debut** — sandboxing, permissions, audit
5. **Scaling au-dela de l'engineering** — domain experts utilisent aussi les agents
6. **Human-agent oversight** — review automatise par AI d'autres AI
7. **Controllable reasoning depth** — Claude 4.5 permet de controler profondeur vs vitesse
8. **Context windows = parallel reasoning** — multi-agent = multi-context

**Implication pour Maestro** : Notre architecture multi-agent avec orchestrateur est exactement ce vers quoi l'industrie converge.

---

## 3. Outils exploitables

### 3.1 Outils open-source / generiques — utilisables directement

Ces outils ne dependent d'aucun provider LLM. Ils sont open-source ou standards ouverts et peuvent etre integres dans Maestro comme des blocks tool generiques, invocables par n'importe quel modele via le CLI.

| Outil | Ce qu'il fait | Integration dans Maestro |
|-------|--------------|--------------------------|
| **Playwright** | Screenshots, interaction DOM, tests E2E, browser headless | Block tool : l'agent invoque via CLI `maestro run screenshot --input url=...` |
| **Docker** | Isolation par conteneur, sandboxing | Deja dans notre architecture — execution isolee des agents |
| **GitHub CLI (gh)** | Repos, PRs, CI/CD, issues | Block tool : l'agent invoque `maestro run git-ops --input action=create-pr` |
| **Accessibility Tree** | Lecture semantique du DOM (10x plus stable que CSS selectors) | Block tool : l'agent "voit" le UI via l'arbre d'accessibilite |

MCP est un protocole ouvert (pas Claude Code-specific). Ces outils sont disponibles comme MCP servers mais aussi comme librairies directes. L'integration dans Maestro doit se faire comme des **blocks tool** invocables via le CLI, pour que n'importe quel agent (quel que soit le modele) puisse les utiliser.

### 3.2 Patterns issus de l'ecosysteme — sources d'inspiration

Ces outils/plugins sont lies a des providers specifiques (Claude Code, etc.). On ne les utilise **PAS directement** — on s'inspire de leurs patterns pour les reproduire de facon generique dans Maestro.

| Source | Pattern a reproduire | Implementation Maestro |
|--------|---------------------|------------------------|
| **TSK (Task Sandbox Kit)** | Deleguer des taches a des agents dans des Docker sandbox | Notre architecture de blocks + sessions fait deja cela |
| **Claude Squad** | Gerer plusieurs instances d'agents en parallele | Block `parallel` dans le workflow (deja concu dans DESIGN-CONTROL-FLOW-BLOCKS.md) |
| **Claude Swarm** | Coordination multi-agent via swarm | Orchestration par le workflow orchestrateur + state manager |
| **Fullstack Dev Skills** (65 skills) | Catalogue de competences specialisees | Nos blocks specialistes (backend-dev, frontend-dev, etc.) |
| **Compound Engineering** | Apprendre de ses erreurs | Memoire persistante `.maestro/memory/` + fitness tracking |
| **Design Review Workflow** | Review UI/UX automatise | Notre agent ui-reviewer avec Playwright + LLM vision |
| **ContextKit** | Gerer le contexte entre conversations | State manager + session variables persistantes |

**Regle** : si un pattern est utile, on le reimplemente comme un block Maestro generique. On ne depend jamais d'un plugin d'un provider specifique.

### 3.3 Outils de verification visuelle

| Outil | Ce qu'il fait | Integration possible |
|-------|--------------|---------------------|
| **Playwright** | Screenshots, interaction DOM, tests E2E | Block tool — l'agent prend des screenshots et reagit |
| **Percy (BrowserStack)** | Visual regression testing | Comparer avant/apres chaque changement |
| **Applitools** | AI visual testing | Detection intelligente des differences visuelles |
| **Momentic** | Test creation via langage naturel | L'agent decrit un test, Momentic l'execute |
| **Accessibility Tree** | Lecture semantique du DOM | L'agent "voit" le UI via l'arbre d'accessibilite |

### 3.4 Sandboxing et execution securisee

| Solution | Ce qu'il fait | Pertinence |
|----------|--------------|-----------|
| **Docker** | Isolation par conteneur | Deja dans notre architecture |
| **E2B** | Sandboxes cloud rapides (<90ms cold start) | Alternative pour le futur cloud |
| **Daytona** | Infrastructure d'execution pour agents | Alternative a Docker pour CI/CD |

---

## 4. Lacunes de l'agent actuel (autonomous-dev v3.1)

### Ce qui existe (9 blocs)

```
autonomous-development (workflow orchestrateur)
├── project-preparer (agent) — analyse le repo
├── task-planner (agent) — decompose en etapes
├── json-validator (tool) — valide le plan
├── implement-single-step (agent, for-each) — execute chaque etape
├── step-validator (tool) — verifie que les fichiers existent
├── test-executor (agent) — detecte et execute les tests
├── code-reviewer (inference) — score qualite (5 axes)
└── git-committer (agent, conditionnel) — commit si score >= 0.8
```

### Ce qui manque cruellement

| Lacune | Impact | Solution |
|--------|--------|----------|
| **Pas de verification visuelle** | L'agent code du frontend sans jamais voir le resultat | Agent UI avec Playwright/screenshots |
| **Pas de specialisation frontend** | Un seul agent fait tout (back + front + CSS + animations) | Agents specialises : React, CSS/animations, accessibility |
| **Pas d'interaction agent** | Impossible de pauser intelligemment, questionner, reprendre, changer de direction | **Interaction-handler** dedie (design Phase 28, voir section 5.4) |
| **Pas de memoire inter-sessions** | Chaque run recommence a zero | Memoire persistante dans `.maestro/memory/` |
| **Pas de recherche web** | L'agent ne peut pas chercher de la doc ou des solutions | Block tool web-search (Playwright ou API) |
| **Pas de self-improvement** | L'agent ne peut pas creer ses propres outils | Framework de creation de blocs par l'agent lui-meme |
| **Un seul passage** | Si le review echoue, le workflow s'arrete | Boucle `while` (DEJA IMPLEMENTEE dans le backend) |
| **Pas de design/styling** | L'agent ne fait que du "code qui marche" | Agent design avec connaissance de Tailwind, animations CSS/Framer Motion |
| **Pas de testing E2E** | Seulement tests unitaires | Agent E2E avec Playwright qui teste le vrai browser |
| **Pas de planification high-level** | Saute directement dans le code | Agent architecte qui fait le design system d'abord |

---

## 5. Architecture proposee : Agent Maestro v4

### 5.1 Philosophie : Equipe virtuelle, pas agent unique

L'agent v4 est une **equipe** de specialistes, pas un generaliste. Chaque specialiste :
- A son propre system prompt optimise
- Recoit son modele par configuration (Tier 1 : Opus/Sonnet via Claude Code Max)
- A acces uniquement aux outils dont il a besoin (via blocks tool)
- Peut etre substitue independamment lors de la degradation en tiers

**Modeles Tier 1** : Le createur a Claude Code Max — Opus 4.6 et Sonnet 4.6 sont les modeles de reference pour le Tier 1. La degradation progressive (34-B+) substituera bloc par bloc vers des modeles inferieurs.

### 5.2 Les specialistes proposes

```
maestro-agent-v4 (workflow orchestrateur)
│
├─── COMPOSANT PARALLELE: INTERACTION-HANDLER (voir section 5.4)
│    Agent dedie qui tourne en parallele du workflow.
│    Recoit les messages utilisateur, classifie l'intent,
│    peut pauser/resume/rewind le workflow via le state-manager.
│
├─── PHASE: COMPRENDRE
│    ├── project-analyzer      — Analyse stack, conventions, architecture (v2 de project-preparer)
│    ├── task-architect         — Design high-level, decoupe en modules (NOUVEAU)
│    └── research-agent         — Cherche docs, exemples, meilleures pratiques sur le web (NOUVEAU)
│
├─── PHASE: PLANIFIER
│    ├── task-planner           — Plan d'implementation etape par etape (v3, ameliore)
│    └── plan-validator         — Valide le plan vs architecture + conventions (v2 de json-validator)
│
├─── PHASE: IMPLEMENTER (pour chaque module)
│    ├── backend-developer      — C#, API, DB, business logic (NOUVEAU — split de implement-single-step)
│    ├── frontend-developer     — React, TypeScript, components, state (NOUVEAU — split)
│    ├── styling-developer      — CSS, Tailwind, animations, Framer Motion, transitions (NOUVEAU)
│    ├── step-validator         — Verifie que les fichiers existent (v2)
│    └── compilation-checker    — Build le projet, reporte les erreurs (NOUVEAU)
│
├─── PHASE: VERIFIER
│    ├── test-writer            — Ecrit les tests unitaires (NOUVEAU — split de test-executor)
│    ├── test-runner            — Execute les tests, parse les resultats (v2 de test-executor)
│    ├── e2e-tester             — Lance Playwright, teste les flows utilisateur (NOUVEAU)
│    ├── ui-reviewer            — Prend des screenshots, compare avec le design attendu (NOUVEAU)
│    └── accessibility-checker  — Verifie WCAG, arbre d'accessibilite (NOUVEAU)
│
├─── PHASE: REVIEWER
│    ├── code-reviewer          — Score qualite code (v3, plus strict)
│    ├── security-reviewer      — Audit securite (OWASP top 10, injection, XSS) (NOUVEAU)
│    └── architecture-reviewer  — Verifie coherence avec l'architecture du projet (NOUVEAU)
│
├─── PHASE: ITERER (boucle while — DEJA SUPPORTE par le backend)
│    └── Si review < 0.8 : retour a IMPLEMENTER avec le feedback
│         Utilise le block type `while` avec condition: "{{reviewScore}} < 0.8 && {{iteration}} < {{maxIterations}}"
│         Max 3 iterations. Si toujours < 0.8 apres 3 iterations : signaler et attendre input humain.
│
└─── PHASE: LIVRER
     ├── git-committer          — Commit conventionnel (v3)
     ├── changelog-writer       — Met a jour le changelog (NOUVEAU)
     └── summary-reporter       — Rapport final de ce qui a ete fait (NOUVEAU)
```

### 5.3 Capacites differenciantes (vs Claude Code brut)

| Capacite | Claude Code brut | Maestro Agent v4 |
|----------|------------------|-------------------|
| Verification visuelle | Non | Oui — Playwright screenshots, comparaison LLM vision |
| Agents specialises | Non (1 agent generaliste) | Oui — backend, frontend, styling, E2E |
| Iteration automatique | Non (1 passage) | Oui — boucle `while` review -> fix, max 3 tours |
| **Interaction intelligente** | **Limitee (context perdu)** | **Oui — interaction-handler dedie avec classify-intent, pause/resume/rewind, widgets** |
| Recherche web | Non native | Oui — block tool web-search |
| Memoire inter-sessions | Non (CLAUDE.md statique) | Oui — `.maestro/memory/` avec learnings |
| Design/animations | Non specialise | Oui — agent styling avec Tailwind/Framer Motion |
| Testing E2E | Non | Oui — Playwright headless |
| Review securite | Non | Oui — agent security dedie |
| Self-improvement | Non | Futur — creation de blocs par l'agent |

### 5.4 L'interaction-handler — agent dedie (design issu de Phase 28)

> **C'est LA feature differenciante de Maestro.** L'utilisateur peut interagir avec l'agent pendant qu'il travaille, sans perdre le contexte, et meme changer de direction.

#### Architecture

L'interaction-handler est un **agent composite** (`blockType: "agent"`, `isAtomic: false`) qui tourne **en parallele** du workflow principal. Il partage un **state-manager** comme single source of truth.

```
┌─ Session ──────────────────────────────────────────────────┐
│                                                            │
│  ┌─ Workflow autonome (deterministe) ──────────────────┐  │
│  │  comprendre -> planifier -> implementer -> ...      │  │
│  │  Lit/ecrit le state-manager a chaque noeud          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Interaction Handler (parallele, intelligent) ──────┐  │
│  │  Recoit les messages utilisateur                    │  │
│  │  Classifie l'intent (question, feedback, override)  │  │
│  │  Decide l'action (repondre, pauser, rewind, inject) │  │
│  │  Controle le workflow via le state-manager           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ State Manager (tool, single source of truth) ──────┐  │
│  │  status: running|paused|completed                   │  │
│  │  currentPhase, currentNode, plan, results, history  │  │
│  │  Operations: get, set, pause, resume, rewind, inject│  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Workflow interne de l'interaction-handler

```
interaction-handler (agent composite)
├── classify-intent (inference)
│   Input: message utilisateur + etat courant + historique conversation
│   Output: {intent, urgency, requiresPause, affectedPhases, details}
│   Intents: question | feedback | change-request | override | acknowledgment
│
├── decide-action (inference)
│   Input: intent classifie + etat complet
│   Output: {action, params, response}
│   Actions: respond | pause-and-modify | rewind | inject | override
│
├── execute-action (conditionnel)
│   ├── respond → generer une reponse contextuelle
│   ├── pause-and-modify → stateManager.pause() + modification + resume()
│   ├── rewind → stateManager.rewind(toPhase) — reset les resultats en aval
│   ├── inject → stateManager.inject(path, value) — modifier sans pauser
│   └── override → bypass une decision du workflow (ex: commit malgre score bas)
│
└── send-response (widget)
    Rend la reponse via le protocole de widgets (message, option-select, confirmation, etc.)
```

#### Scenarios concrets

**Question simple** : "T'en es ou ?"
```
classify: intent=question, urgency=none, requiresPause=false
decide: action=respond
execute: lit le state -> "J'implemente le step 3/5, le module file-tree..."
send: widget=message
```

**Feedback urgent** : "Stop, utilise des tabs pas des espaces"
```
classify: intent=change-request, urgency=immediate, requiresPause=true
decide: action=pause-and-modify
execute:
  1. stateManager.pause()
  2. stateManager.inject("projectContext.conventions.indentation", "tabs")
  3. Si le step en cours a deja ecrit avec des espaces -> rewind ce step
  4. stateManager.resume()
send: "OK, je passe aux tabs et je reprends le step en cours."
```

**Changement de direction** : "Finalement, utilise une classe au lieu de fonctions pures"
```
classify: intent=change-request, affectedPhases=["plan", "implement"]
decide: action=rewind, params={toPhase: "plan"}
execute:
  1. stateManager.pause()
  2. stateManager.rewind("plan") — reset results.plan, results.implement, etc.
  3. stateManager.inject("plan.userOverride", "Use class pattern")
  4. stateManager.resume()
send: "Je reviens a la planification avec ta nouvelle direction."
```

**Override** : "Commit ca, le score m'importe pas"
```
classify: intent=override, urgency=immediate
decide: action=override, params={skipPhase: "review", goTo: "commit"}
execute:
  1. stateManager.pause()
  2. Afficher confirmation widget: "Le review score est 0.6. Tu es sur?"
  3. Si confirme: stateManager.transition("commit")
  4. stateManager.resume()
```

#### State Manager — operations

| Operation | Appelant | Effet |
|-----------|----------|-------|
| `get(path)` | Workflow + Interaction | Lire un champ d'etat |
| `set(path, value)` | Workflow + Interaction | Ecrire un champ d'etat |
| `transition(phase)` | Workflow | Marquer une phase comme terminee/demarree |
| `pause()` | Interaction | Pauser le workflow |
| `resume()` | Interaction | Reprendre le workflow |
| `rewind(toPhase)` | Interaction | Revenir a une phase anterieure, reset les resultats en aval |
| `inject(path, value)` | Interaction | Modifier l'etat sans pauser (ex: conventions) |

#### Widget Protocol

L'agent communique avec l'utilisateur via des widgets dans le TUI :

| Type | Interactif | Usage |
|------|------------|-------|
| `message` | Non | Reponse textuelle de l'agent |
| `option-select` | Oui | Choix parmi des options |
| `text-input` | Oui | Saisie libre |
| `confirmation` | Oui | Oui/Non |
| `progress` | Non | Barre de progression |
| `plan-view` | Non | Steps avec statuts |
| `diff-view` | Non | Affichage de diff code |
| `test-results` | Non | Resultats pass/fail |

### 5.5 La verification visuelle — comment ca marche

```
1. L'agent frontend cree/modifie des composants
2. compilation-checker build le projet
3. e2e-tester lance le serveur de dev + Playwright
4. Playwright navigue vers la page modifiee
5. Screenshot capture
6. ui-reviewer (LLM vision) analyse le screenshot :
   - Layout correct?
   - Elements alignes?
   - Responsive?
   - Animations fluides? (sequence de screenshots)
   - Texte lisible?
   - Contraste suffisant?
7. Si problemes detectes -> retour au styling-developer avec le feedback visuel
```

---

## 6. Tiers — degradation progressive (connecte au fitness engine)

### Approche

Pas de tiers fixes. A la place, degradation progressive mesuree par la **formule fitness de Philosophy V2** :

```
                    P x S x W
ModelFitness = ─────────────────────────
               (C_norm x C_compute x C_hw)^lambda
```

| Dimension | Ce qu'on mesure pour chaque bloc |
|-----------|----------------------------------|
| **P** (Performance) | Tests passes, format respecte, qualite du code produit [0-1] |
| **S** (Specialisation) | Performance / entropie des taches (un bloc specialise score mieux) |
| **W** (Composabilite) | 1 - taux d'hallucination, respect du format de sortie |
| **C_norm** | Cout economique normalise par rapport a un baseline |
| **C_compute** | log(params) x FLOPs/token du modele |
| **C_hw** | VRAM + RAM + GPU requirement |
| **lambda** | Penalisation non-lineaire (recommande: 1.5) |

### Processus de degradation

1. **Tier 1** : Opus (architecte, reviewer, interaction-handler) + Sonnet (tout le reste) — qualite maximale
2. Mesurer le **fitness de chaque bloc individuellement** avec la formule ci-dessus
3. Pour chaque bloc, tester le modele immediatement inferieur
4. Si le fitness du bloc ne baisse pas de plus de 5% → substituer
5. Repeter jusqu'a ce que la baisse depasse 5%
6. Publier le tier resultant avec son **manifeste** (modeles par bloc, fitness mesure, substituts testes)

```
Tier 1: Opus (architecte, reviewer) + Sonnet (tout le reste)   -> Baseline fitness
Tier 2: Opus (architecte) + Sonnet (code) + Haiku (validator)  -> fitness -3%
Tier 3: Sonnet (architecte) + Sonnet (code) + Haiku (reste)    -> fitness -7%
Tier 4: Sonnet (architecte) + Haiku (code) + Haiku (reste)     -> fitness -12%
...continue jusqu'a ce que fitness < seuil minimal (ex: 0.70)
```

Chaque tier est automatiquement genere par test de substitution, pas hardcode.

### Manifeste par tier

Chaque tier publie DOIT contenir :
- Modele utilise par bloc
- Fitness score mesure par bloc
- Fitness score global du workflow
- Substituts testes avec leur fitness (pour `maestro adapt`)
- Criteres d'evaluation utilises

---

## 7. Dependances techniques

### Ce qui existe deja dans Maestro

- [x] Architecture de blocs (workflow > agent > tool)
- [x] Execution de workflows avec for-each, conditions
- [x] **Boucle `while` dans le workflow engine** (EntryPointExecutor — condition, maxIterations, plateau detection)
- [x] CLI avec commandes generiques (session, invoke, monitor)
- [x] TUI monitor pour observer l'execution
- [x] 9 blocs de l'agent v3.1
- [x] Backend API + LLM-Provider gateway
- [x] Docker-compose pour l'execution
- [x] `maestro code` — mode interactif TUI (Ink)

### Ce qu'il faut ajouter/modifier

| Element | Difficulte | Description |
|---------|-----------|-------------|
| Blocks tool Playwright (screenshot, navigation, accessibility tree) | Moyenne | Creer des blocks tool qui wrappent Playwright — invocables par n'importe quel agent via CLI |
| Interaction-handler (agent composite) | Haute | Agent parallele avec classify-intent, decide-action, state-manager (voir section 5.4) |
| State Manager (tool block) | Moyenne | Block tool partage entre workflow et interaction-handler — pause/resume/rewind/inject |
| Widget Protocol dans `maestro code` | Moyenne | Le mode interactif doit rendre les widgets (option-select, confirmation, progress, etc.) |
| Checkpointing dans EntryPointExecutor | Moyenne | Sauvegarder/restaurer l'etat a chaque noeud pour permettre resume apres pause |
| Vision model support | Faible | LLM-Provider gere deja les images via l'API — s'assurer que les blocks inference peuvent envoyer des images |
| Web search block tool | Faible | Block tool qui effectue une recherche web (Playwright ou API) |
| Memory persistence | Faible | Lire/ecrire des fichiers dans `.maestro/memory/` — block tool simple |

**Note** : La boucle `while` existe deja dans le backend (`ExecuteWhileNodeAsync` dans `EntryPointExecutor.cs`). Pas de modification necessaire pour la boucle d'iteration.

---

## 8. Instructions pour l'agent qui cree le plan detaille

### Contexte

Tu recois ce document d'analyse. Ta tache est de creer le document de conception detaille de l'agent Maestro v4 — du bloc parent (workflow orchestrateur) jusqu'au bloc atomique le plus petit.

### Documents de reference obligatoires

| Document | Pourquoi le lire |
|----------|-----------------|
| `CLAUDE.md` | Regles architecturales (tout est un bloc, generique vs specifique, agent = inference block) |
| `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` | Formule fitness, architecture hybride, principes de design |
| `docs/system/architecture/DESIGN-CONTROL-FLOW-BLOCKS.md` | Blocks while, for-each, decision, parallel — ce qui est deja supporte |
| `docs/phases/PHASE-28/PLAN-PHASE-28A.md` | **Design complet de l'interaction-handler** — classify-intent, state-manager, pause/resume/rewind |
| `docs/phases/PHASE-28/PLAN-PHASE-28B.md` | **Widget protocol** — types de widgets, communication TUI |
| `content/system/blocks/` | Blocs existants — comprendre le format actuel |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Comment while, for-each, conditions sont executes |

### Ce que tu DOIS faire

1. **Lire tous les documents de reference ci-dessus** avant de commencer
2. **Concevoir l'interaction-handler** en detail (c'est le composant le plus critique) :
   - Block structure avec ses 4 noeuds internes
   - Le state-manager tool avec ses operations
   - Le widget protocol
   - Comment il se connecte au workflow principal en parallele
3. **Concevoir chaque bloc specialiste** avec :
   - Son ID, type, version
   - Son system prompt complet (pas un placeholder)
   - Son modele recommande Tier 1 (Opus ou Sonnet)
   - Ses inputs/outputs
   - Ses outils disponibles (quels blocks tool il invoque via CLI)
   - Ses **criteres fitness** : comment P, S, W sont mesures concretement pour ce bloc
   - Ses anti-patterns (ce qu'il ne doit PAS faire)
4. **Concevoir le workflow** :
   - L'ordre d'execution exact
   - Les conditions de branchement (`decision` blocks)
   - La boucle d'iteration (`while` block — deja supporte)
   - Le for-each pour les steps d'implementation
   - Le checkpointing a chaque noeud
5. **Documenter les blocks tool a creer** :
   - `playwright-screenshot` : prend un screenshot d'une URL
   - `playwright-accessibility` : lit l'arbre d'accessibilite
   - `web-search` : recherche web
   - `compilation-check` : build le projet, reporte les erreurs
   - Chaque tool doit etre un block generique, invocable par n'importe quel agent via CLI
6. **Documenter les criteres fitness** par bloc en utilisant la formule Philosophy V2
7. **Documenter les dependances** :
   - Quels outils doivent etre installes (Playwright, etc.)
   - Quelles modifications au backend/CLI sont necessaires
   - Ce qui est deja supporte vs ce qui doit etre ajoute

### Ce que tu NE DOIS PAS faire

- Ne pas ecrire de code C# ou TypeScript — seulement le design (les block.json + system prompts)
- Ne pas creer les blocs toi-meme — juste concevoir le document
- Ne pas supposer que Playwright est installe — le documenter comme prerequis
- Ne pas faire un agent "correct" — le seuil est "exceptionnellement meilleur que Claude Code brut"
- Ne pas utiliser d'outils lies a un provider specifique (plugins Claude Code, etc.) — seulement des outils open-source/generiques
- Ne pas oublier l'interaction-handler — c'est la feature differenciante principale

### Format du document de sortie

```
docs/phases/PHASE-34/AGENT-V4-SPEC.md
```

Structure :
1. Vue d'ensemble de l'architecture (incluant interaction-handler + state-manager)
2. L'interaction-handler (chapitre complet — c'est le coeur)
3. Chaque specialiste (un chapitre complet par bloc)
4. Les blocks tool a creer (Playwright, web-search, etc.)
5. Le workflow complet (JSON conceptuel avec while, for-each, decision)
6. Les criteres de fitness par bloc (formule V2 appliquee)
7. La strategie de memoire persistante
8. Les dependances techniques (ce qui existe vs ce qu'il faut ajouter)
9. Plan de tests pour valider que l'agent v4 > Claude Code

---

## 9. Sources

### Agents et frameworks
- [OpenHands vs SWE-Agent comparison](https://localaimaster.com/blog/openhands-vs-swe-agent)
- [Best AI Coding Agents 2026](https://playcode.io/blog/best-ai-coding-agents-2026)
- [Best Open-Source AI Coding Agents 2026](https://www.theunwindai.com/p/best-open-source-ai-coding-agents-what-teams-can-actually-ship-with-in-2026)
- [Devin vs OpenHands](https://www.amplifilabs.com/post/devin-ai-vs-openhands-open-source-vs-proprietary-agentic-development)

### MCP et outils generiques
- [50+ Best MCP Servers](https://claudefa.st/blog/tools/mcp-extensions/best-addons)
- [MCP Protocol documentation](https://code.claude.com/docs/en/mcp)
- [Awesome Claude Code (patterns et inspirations)](https://github.com/hesreallyhim/awesome-claude-code)

### Multi-agent et tendances
- [Anthropic 2026 Agentic Coding Trends Report](https://resources.anthropic.com/2026-agentic-coding-trends-report)
- [Multi-Agent System Architecture Guide 2026](https://www.clickittech.com/ai/multi-agent-system-architecture/)
- [How to Build Multi-Agent Systems 2026](https://differ.blog/p/how-to-build-multi-agent-systems-complete-2026-guide-f50e02)
- [AI Coding Agents: Coherence Through Orchestration](https://mikemason.ca/writing/ai-coding-agents-jan-2026/)

### Verification visuelle et UI testing
- [AI Agent Rethinking UI Test Automation](https://medium.com/@partarstu/meet-the-ai-agent-thats-rethinking-ui-test-automation-d8ef9742c6d5)
- [Momentic — AI-Powered Testing](https://momentic.ai/)
- [Visual Testing with AI](https://www.askui.com/blog-posts/visual-testing-with-ai)
- [Browser Use — AI Browser Agent](https://dzone.com/articles/build-ai-browser-agent-llms-playwright-browser-use)
- [Best AI Browser Agents 2026](https://www.firecrawl.dev/blog/best-browser-agents)

### Sandboxing et securite
- [Best Code Execution Sandbox for AI Agents](https://northflank.com/blog/best-code-execution-sandbox-for-ai-agents)
- [Docker + E2B: Building Trusted AI](https://www.docker.com/blog/docker-e2b-building-the-future-of-trusted-ai/)
- [Docker MCP for AI Agents](https://www.docker.com/blog/docker-mcp-ai-agent-developer-setup/)

### Design Maestro interne (references obligatoires)
- `docs/phases/PHASE-28/PLAN-PHASE-28A.md` — Interaction-handler, state-manager, pause/resume/rewind
- `docs/phases/PHASE-28/PLAN-PHASE-28B.md` — Widget protocol, maestro code integration
- `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` — Formule fitness, architecture hybride
- `docs/system/architecture/DESIGN-CONTROL-FLOW-BLOCKS.md` — While, for-each, decision, parallel
