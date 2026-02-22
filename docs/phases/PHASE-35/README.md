# Phase 35 : Dogfooding — Maestro autonome sur Cantante

**Statut** : TERMINEE
**Prerequis** : Phase 35-PRE COMPLETE (dev-orchestrator, tool dispatch, metrics pipeline)
**Objectif** : Prouver que le pipeline Maestro fonctionne de bout en bout en utilisant `maestro code` pour developper Cantante. Ameliorer l'agent ET le tooling (maestro code, CLI) de maniere iterative basee sur l'usage reel.

---

## Philosophie de cette phase

**Tout passe par `maestro code`.** L'agent Claude Code (moi) n'est PAS le developpeur de Cantante — il est l'OPERATEUR de Maestro. Mon role :
1. Invoquer `maestro code --headless` avec des taches
2. Observer les resultats (succes, echecs, metriques)
3. Quand le tooling bloque → ameliorer maestro code / CLI
4. Quand l'agent echoue → ameliorer le prompt / config du dev-orchestrator
5. Documenter chaque iteration

**Pas de template pre-fabrique.** La structure session est construite via `maestro code` et le CLI. Si c'est difficile a faire sans template, c'est un signal que le CLI manque de fonctionnalites → on les ajoute.

**Deux axes d'amelioration paralleles :**
- **L'agent** (dev-orchestrator) : prompts, config, outils disponibles, strategie
- **Le tooling** (maestro code, headless, CLI) : UX, flags, widgets, reporting, session management

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Ecrire dans `PHASE-35/checkpoint.md`** apres chaque sous-phase
3. **TOUT passe par `maestro code`** — pas de commandes CLI manuelles pour le dev Cantante
4. **JAMAIS developper Cantante directement** — tout passe par le dev-orchestrator invoque via maestro code
5. **Quand maestro code ne peut pas faire quelque chose** → ameliorer maestro code AVANT de contourner
6. **Quand l'agent echoue** → diagnostiquer → ameliorer prompt/config → re-tester
7. **Documenter chaque iteration** avec metriques avant/apres
8. **Ne pas s'arreter** — chaque obstacle est soit un bug du tooling soit une lacune de l'agent

### Discipline de livraison (ajout post 35-B)

> Ces regles ont ete ajoutees apres que 35-B a ete termine sans commit, sans changelog, et sans amelioration du package maestro-code. Ne pas repeter.

9. **COMMITER apres chaque sous-phase** — ne JAMAIS laisser une sous-phase complete sans commit. `git add` + `git commit` avec message descriptif. Zero exception.
10. **CREER un CHANGELOG.md** dans le repertoire de la phase (`docs/phases/PHASE-35/CHANGELOG.md`) avec la liste des fixes, fichiers modifies, et metriques. Le checkpoint.md seul ne suffit PAS.
11. **VERIFIER : ai-je ameliore le bon package ?** — Si le but est d'ameliorer maestro-code (`packages/maestro-code/`), les fixes backend ne comptent pas comme amelioration du package. Poser la question explicitement : "Qu'est-ce qui a change dans `packages/maestro-code/` ?" — si la reponse est "rien", c'est un echec.
12. **Modifications de system-prompt** → passer par le workflow foundry sauf pendant une iteration active de dogfooding. Documenter explicitement le contournement dans le checkpoint.
13. **Avant de declarer DONE** — checklist :
    - [ ] Commit fait ?
    - [ ] CHANGELOG.md cree/mis a jour ?
    - [ ] Checkpoint.md mis a jour avec statut DONE ?
    - [ ] Memory mise a jour si nouvelles regles/patterns ?
    - [ ] Le(s) bon(s) package(s) ont ete ameliores (pas juste le backend) ?

---

## Sous-phases

| Phase | Titre | Statut |
|-------|-------|--------|
| 35-PRE | Agent composite + tool dispatch | DONE |
| 35-A | Pipeline setup + DI fixes (template none, dispatch, deadlock) | DONE |
| 35-B | Scaffold Cantante + corrections agent (nudge, countdown, multi-tool) | DONE |
| 35-C | Iterations amelioration (tab, search, theme, terminal, line numbers) + 13 infra fixes | DONE |
| 35-D | For-each pipeline + JsonElement fix (JToken.Parse, JObject unwrap) | DONE |
| 35-E | Stabilisation (16 fixes, 9 sessions, 100% post-fix 36-40 — while+validator pattern) | DONE |
| 35-F | Bilan et documentation (metriques finales, fitness report) | DONE |

---

## 35-A : Maestro code sans template

### Lecture obligatoire
- `packages/maestro-code/headless.ts` — flux headless actuel
- `packages/maestro-cli/cli.ts` — arguments `code`, flags disponibles (lignes 5920-5960)
- `content/system/blocks/agents/dev-orchestrator/dev-orchestrator.agent.block.json` — l'agent a invoquer

### Ce que cette sous-phase fait

**Tentative 1** : Essayer `maestro code --headless --task "..." --repo C:\Cantante` SANS template.

Observer :
- Est-ce que `--template` est obligatoire ? Si oui → ajouter support `--no-template`
- Est-ce que l'entry point peut etre `dev-orchestrator` directement ? Si non → ajouter support `--entry dev-orchestrator` sans template
- Est-ce que la session se cree correctement sans template ?
- Est-ce que les metriques (tokens, cout) remontent dans l'output headless ?

**Pour chaque blocage** : corriger le code de maestro code / CLI, puis re-tester.

**Resultat attendu** : Pouvoir lancer `maestro code --headless --task "Create a hello world" --repo C:\Cantante` et que l'agent s'execute avec output visible.

### Fichiers potentiellement modifies
| Fichier | Raison |
|---------|--------|
| `packages/maestro-code/headless.ts` | Support sans template, metriques dans output |
| `packages/maestro-cli/cli.ts` | Nouveaux flags (`--no-template`, `--block`, etc.) |

### Verification
```bash
# La commande headless fonctionne sans template
cd C:\Meastro\packages\maestro-cli
node index.js code --headless --task "List the project structure" --repo "C:\Cantante"
# Resultat attendu : output structure avec le contenu du repertoire
```

### Anti-patterns
- Ne PAS contourner maestro code en utilisant `node index.js run` directement — le but est de tester maestro code
- Ne PAS creer un template custom juste pour eviter de corriger le code — corriger le code
- Ne PAS ajouter des flags sans les tester

### Checkpoint
```markdown
## 35-A : Maestro code sans template
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Tentatives** : [nombre]
**Blocages trouves** : [liste]
**Corrections faites** : [liste fichiers + description]
**Commande finale qui fonctionne** : [commande exacte]
**Output** : [copier-coller]
```

---

## 35-B : Premier cycle — Scaffold Cantante

### Lecture obligatoire
- `docs/phases/PHASE-35/checkpoint.md` — commande qui fonctionne de 35-A
- `C:\Cantante\README.md` — vision du projet
- `C:\Cantante\package.json` — etat actuel
- `content/system/blocks/agents/dev-orchestrator/system-prompt.md` — prompt agent

### Ce que cette sous-phase fait

Invoquer maestro code avec une tache de scaffold :
```
maestro code --headless --task "Set up this Electron project with React 18, Vite, and TypeScript. Create: vite.config.ts for Electron+React, a renderer entry point with React.createRoot, an App.tsx component, update package.json with react/vite deps, and configure the Electron main process to load the Vite dev server." --repo C:\Cantante
```

Observer :
- L'agent a-t-il cree les bons fichiers ?
- Le build fonctionne-t-il ? (`npm install && npm run build`)
- Combien d'iterations, tokens, cout ?
- Ou l'agent a-t-il echoue / perdu du temps ?

### Verification
```bash
# 1. Fichiers crees
powershell.exe -Command "Get-ChildItem C:\Cantante\src -Recurse | Select-Object FullName"

# 2. Build
cd C:\Cantante && npm install && npm run build

# 3. Metriques dans l'output headless
# tokens > 0, cout > 0
```

### Anti-patterns
- Ne PAS coder le scaffold a la main — l'agent le fait via maestro code
- Ne PAS corriger le code genere manuellement — si c'est mauvais, ameliorer l'agent en 35-C
- Ne PAS ignorer les echecs partiels — tout documenter

### Checkpoint
```markdown
## 35-B : Scaffold Cantante
**Statut** : DONE / BLOQUE
**Commande** : [commande exacte]
**Tokens** : [total]
**Cout** : $[montant]
**Duree** : [secondes]
**Fichiers crees** : [liste]
**Build** : PASS / FAIL
**Problemes agent** : [liste]
**Problemes tooling** : [liste]
```

---

## 35-C : Amelioration iteration 1

### Lecture obligatoire
- `docs/phases/PHASE-35/checkpoint.md` — resultats de 35-B
- `content/system/blocks/agents/dev-orchestrator/system-prompt.md` — prompt actuel
- `content/system/blocks/agents/dev-orchestrator/dev-orchestrator.agent.block.json` — config
- Logs de l'execution 35-B

### Ce que cette sous-phase fait

1. **Diagnostic** : Classer les problemes de 35-B en :
   - Problemes agent (prompt, strategie, outils) → ameliorer l'agent
   - Problemes tooling (headless, CLI, session) → ameliorer maestro code
   - Problemes infra (backend, LLM-Provider) → corriger l'infra

2. **Corrections** : Pour chaque probleme, appliquer le fix minimal

3. **Re-test** : Relancer maestro code avec une tache similaire, mesurer l'amelioration

4. **Si le scaffold de 35-B a echoue** : re-lancer apres corrections

### Verification
```bash
# Backend build OK apres corrections
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"

# Tache de test re-executee avec metriques ameliorees
# (commande exacte depend des corrections)
```

### Anti-patterns
- Ne PAS ameliorer sans mesurer — metriques avant ET apres
- Ne PAS ajouter de logique specifique a Cantante dans l'infra
- Ne PAS ignorer les problemes de tooling pour se concentrer uniquement sur l'agent (ou vice versa)

### Checkpoint
```markdown
## 35-C : Amelioration v1
**Statut** : DONE / BLOQUE
**Problemes agent** : [N trouves, M corriges]
**Problemes tooling** : [N trouves, M corriges]
**Changements** : [liste fichiers + description]
**Metriques avant** : tokens=[X], cout=$[X], success=[Y/N]
**Metriques apres** : tokens=[X], cout=$[X], success=[Y/N]
```

---

## 35-E : Stabilisation finale

### Lecture obligatoire
- `docs/phases/PHASE-35/checkpoint.md` — metriques actuelles
- `docs/phases/PHASE-35/CHANGELOG.md` — 29 bugs corriges
- `docs/phases/PHASE-35/ANALYSIS-deep-review-phase35.md` — analyse approfondie

### Ce que cette sous-phase fait

1. **Taux de succes > 75%** : identifier les patterns d'echec restants, corriger
2. **Tests automatises** : creer des tests pour le pipeline agent (pas juste manuels)
3. **Degradation multi-tiers** (34-F jamais fait) : Sonnet pour le code-reviewer au lieu d'Opus sur les taches simples
4. **Cout par task simple < $0.10** : optimiser les iterations gaspillees
5. **Cantante v0.1** : atteindre 30+ composants fonctionnels avec build OK

### Anti-patterns
- Ne PAS ajouter de features a Cantante — stabiliser ce qui existe
- Ne PAS optimiser prematurement le cout — d'abord le taux de succes
- Ne PAS declarer "stable" sans metriques de confirmation
- Ne PAS hardcoder de logique specifique au contenu dans les executeurs C# — utiliser des blocks (while + json-validator + conditional) dans le workflow JSON pour la validation de format. L'executeur est du plumbing mecanique, JAMAIS du contenu.

### Checkpoint
```markdown
## 35-E : Stabilisation
**Statut** : DONE / BLOQUE
**Taux de succes** : [X]% (avant: 59%)
**Cout moyen task simple** : $[X] (avant: $0.13)
**Tests agent ajoutes** : [nombre]
**Cantante composants** : [nombre]
```

---

## 35-F : Bilan et Documentation

### Ce que cette sous-phase fait
1. Compiler toutes les metriques de la phase
2. Ecrire un rapport de fitness de l'agent (success rate par type de tache)
3. Documenter les ameliorations tooling faites et leur impact
4. Mettre a jour MEMORY.md
5. Mettre a jour ROADMAP.md

### Checkpoint
```markdown
## 35-F : Bilan
**Cycles completes** : [nombre]
**Taches reussies** : [N/M] ([X]%)
**Cout total** : $[montant]
**Ameliorations agent** : [nombre + description]
**Ameliorations tooling** : [nombre + description]
**Etat Cantante** : [description avec liste de features]
**Etat maestro code** : [description des ameliorations]
```

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-35/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : Topic file `memory/phase35-dogfooding.md` avec metriques, patterns d'amelioration
- Mettre a jour : "Active phase" → Phase 35 dogfooding
- Retirer : References obsoletes a "Phase 35 = Context & Conversation blocks" (maintenant Phase 36)
