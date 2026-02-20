# Phase 35-PRE : Agent Composite + Tool Call JSON Direct

**Statut** : A faire
**Prerequis** : Phase 34-E (21 fixes appliques, blocs testes individuellement)
**Objectif** : Corriger l'architecture de l'agent pour respecter "le type definit son interface, pas son implementation" et debloquer l'execution fiable du workflow.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-35/PRE/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS prescrire ce qu'un agent doit contenir** — l'interieur est une boite noire
5. **Ne PAS ajouter de logique specifique a un provider** dans l'executor
6. **Le build DOIT passer** apres chaque sous-phase : `dotnet build` sans erreurs
7. **Les tests existants DOIVENT passer** — ne pas introduire de regressions

---

## Contexte du probleme

### 1. Agent composite mais implementation hardcodee

L'agent est declare composite (`isAtomic: false`) mais l'`AgentBlockExecutor` :
- Herite de `LLMBlockExecutorBase` et appelle `_llmGateway.SendAsync()` directement
- Hardcode la boucle agentique (while loop, tool call parsing, conversation management) en C#
- Ignore `config.nodes` — les enfants du bloc ne sont jamais executes

L'implementation interne de l'agent devrait etre definie par ses `config.nodes` (blocs enfants), pas par du code C#. Un agent pourrait contenir 0, 1, ou N blocs inference, des tools, des validators — n'importe quoi. L'interieur est une boite noire.

### 2. Tool calls via CLI string parsing

Les agents appellent les blocs via `{"tool":"maestro_cli","args":{"command":"run file-write --input-json {...}"}}`. Le contenu du fichier est serialise en string CLI puis re-parse par `CliParser` qui le detruit (espaces, guillemets, newlines).

### 3. Tool de terminaison

Les agents essaient naturellement `step-complete` mais l'executor attend `done`. Renommer pour travailler avec le modele.

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 35-PRE-A | Tool call JSON direct + `step-complete` | 2-4h |
| 35-PRE-B | Prompts agents (nouveau format tools + exemples negatifs) | 1-2h |
| 35-PRE-C | AgentBlockExecutor → orchestrateur de noeuds enfants | 4-8h |
| 35-PRE-D | Dev orchestrator (nouveau bloc agent) | 2-4h |
| 35-PRE-E | Test & validation | 2-4h |

---

## 35-PRE-A : Tool call JSON direct + `step-complete`

### Lecture obligatoire
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — comprendre le flow ExecuteToolCall()
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` — comprendre ExtractJson() et les methodes partagees
- `docs/phases/PHASE-35/PRE/ANALYSE-ARCHITECTURE-AGENT.md` — contexte et decisions architecturales

### Ce que cette sous-phase fait

1. Dans `AgentBlockExecutor.ExecuteToolCall()`, ajouter un chemin de dispatch generique : si le tool name n'est ni `step-complete` ni `maestro_cli`, traiter comme un block-id et passer les `args` comme inputs JSON au bloc via `IBlockExecutorRegistry`
2. Renommer `done` en `step-complete` dans le handler de terminaison de la boucle agentique
3. Ajouter un message d'erreur informatif quand un bloc n'existe pas dans le registry (pas un fallback — un `command not found`)
4. Garder le chemin `maestro_cli` existant pour la compatibilite

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — renommer `done` → `step-complete`, ajouter dispatch generique dans `ExecuteToolCall()`, ajouter error message pour bloc inexistant |

### Verification

```bash
# Commande 1 : Build backend
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : 0 errors, 0 warnings

# Commande 2 : Test isole file-write avec nouveau format
# (depuis packages/maestro-cli, avec services demarres)
# Creer une session, invoquer un agent avec le nouveau format tool call
# Verifier que le fichier est cree correctement
```

### Anti-patterns
- Ne PAS supprimer le chemin `maestro_cli` — il est encore necessaire pour les blocs existants qui n'ont pas ete mis a jour
- Ne PAS ajouter de logique specifique dans le dispatch generique (pas de if/else sur le nom du bloc)
- Ne PAS creer de fallback `step-complete` → `done` — le renommage est un changement, pas un alias

### Checkpoint
```markdown
## 35-PRE-A : Tool call JSON direct + step-complete
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 errors / N errors
**step-complete reconnu** : oui / non
**Dispatch generique** : oui / non (tool name → block-id → inputs JSON)
**Error message bloc inexistant** : oui / non
**Verification** : Copier le output du build + test isole
```

---

## 35-PRE-B : Prompts agents (nouveau format tools)

### Lecture obligatoire
- `content/system/blocks/agents/implement-single-step/system-prompt.md` — prompt actuel
- `content/system/blocks/agents/task-planner/system-prompt.md` — prompt actuel du planner
- Tous les system prompts dans `content/system/blocks/agents/*/system-prompt.md`

### Ce que cette sous-phase fait

1. Mettre a jour tous les system prompts des blocs agents pour utiliser le nouveau format tool call (JSON direct au lieu de `maestro_cli` string)
2. Ajouter les exemples negatifs pour `step-complete` (lister les noms qui N'EXISTENT PAS)
3. Simplifier le format `step-complete` : args JSON directes au lieu de JSON-dans-JSON
4. Documenter les outils disponibles avec le nouveau format

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `content/system/blocks/agents/implement-single-step/system-prompt.md` | Modifier — nouveau format tools + step-complete + exemples negatifs |
| `content/system/blocks/agents/task-planner/system-prompt.md` | Modifier — meme pattern |
| `content/system/blocks/agents/test-executor/system-prompt.md` | Modifier — meme pattern |
| `content/system/blocks/agents/git-committer/system-prompt.md` | Modifier — meme pattern |
| Tout autre `content/system/blocks/agents/*/system-prompt.md` | Modifier — meme pattern |

### Verification

```bash
# Commande 1 : Lister tous les system prompts et verifier qu'aucun ne reference "done"
# grep -r '"done"' content/system/blocks/agents/*/system-prompt.md
# Resultat attendu : 0 matches (seulement dans les exemples negatifs "done — DOES NOT EXIST")

# Commande 2 : Verifier que tous les prompts referent step-complete
# grep -r 'step-complete' content/system/blocks/agents/*/system-prompt.md
# Resultat attendu : 1+ match par fichier
```

### Anti-patterns
- Ne PAS garder l'ancien format `maestro_cli` dans les nouveaux prompts — c'est le nouveau format ou rien
- Ne PAS prescrire quels blocs l'agent doit utiliser — lister les outils disponibles, l'agent decide
- Ne PAS ajouter d'exemples trop specifiques qui ancrent le modele sur un seul pattern

### Checkpoint
```markdown
## 35-PRE-B : Prompts agents
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Prompts mis a jour** : N / N total
**Nouveau format tools** : oui / non dans tous les prompts
**step-complete** : oui / non dans tous les prompts
**Exemples negatifs** : oui / non dans tous les prompts
```

---

## 35-PRE-C : AgentBlockExecutor → orchestrateur de noeuds enfants

### Lecture obligatoire
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — code actuel complet
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` — base class actuelle
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — comment le workflow orchestre ses noeuds (pattern a suivre)
- `docs/system/architecture/blocks.md` — architecture cible

### Ce que cette sous-phase fait

C'est la sous-phase la plus complexe. L'objectif est de transformer `AgentBlockExecutor` d'un executor qui appelle le LLM directement en un orchestrateur qui execute ses blocs enfants definis dans `config.nodes`.

1. **Decoupler `AgentBlockExecutor` de `LLMBlockExecutorBase`** — l'agent n'est pas atomique, il ne devrait pas heriter d'un executor LLM. Les methodes partagees utiles (ExtractJson, ParseOutputs, etc.) peuvent rester accessibles autrement (static utils, composition, ou interface).

2. **Lire `config.nodes`** dans l'executor — comme `EntryPointExecutor` lit les noeuds d'un workflow, l'agent executor doit lire ses enfants.

3. **Boucle agentique via enfants** — au lieu de `_llmGateway.SendAsync()`, l'executor execute le bloc inference enfant pour obtenir la reponse LLM. Le tool call dispatch passe par les blocs enfants aussi.

4. **Garder la retro-compatibilite** — les blocs agents existants qui n'ont pas de `config.nodes` doivent continuer a fonctionner (avec l'ancien chemin LLM direct, marque deprecated).

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — decoupler de LLMBlockExecutorBase, lire config.nodes, orchestrer enfants |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/LLMBlockExecutorBase.cs` | Modifier — extraire les methodes utilitaires (ExtractJson, etc.) en methodes statiques ou classe util |
| `apps/backend/src/Maestro.Api/Program.cs` | Modifier — ajuster DI si necessaire |

### Verification

```bash
# Commande 1 : Build backend
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : 0 errors

# Commande 2 : Test isole — agent avec config.nodes
# Creer un bloc agent avec un noeud inference enfant, verifier que le LLM est appele via le noeud enfant

# Commande 3 : Test retro-compat — agent SANS config.nodes
# Les blocs agents existants (implement-single-step, etc.) doivent toujours fonctionner
```

### Anti-patterns
- Ne PAS supprimer LLMBlockExecutorBase — il reste valide pour InferenceBlockExecutor (qui EST atomique)
- Ne PAS prescrire quels types de noeuds un agent doit avoir — l'interieur est une boite noire
- Ne PAS casser les agents existants qui n'ont pas encore de config.nodes
- Ne PAS dupliquer la logique de walk de noeuds qui existe deja dans EntryPointExecutor — la reutiliser ou l'extraire

### Checkpoint
```markdown
## 35-PRE-C : AgentBlockExecutor composite
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 errors / N errors
**Decouplage LLMBlockExecutorBase** : oui / non
**config.nodes lu** : oui / non
**Enfants executes** : oui / non (inference enfant appele au lieu de _llmGateway direct)
**Retro-compat** : oui / non (agents sans config.nodes fonctionnent encore)
**Verification** : Copier output test isole
```

---

## 35-PRE-D : Dev orchestrator (nouveau bloc agent)

### Lecture obligatoire
- `content/system/blocks/agents/` — structure des blocs agents existants
- `docs/phases/PHASE-35/PRE/ANALYSE-ARCHITECTURE-AGENT.md` section 3 — architecture de l'orchestrateur
- `docs/guides/ai-agents/creating-blocks.md` — comment creer un bloc

### Ce que cette sous-phase fait

1. Creer le bloc `dev-orchestrator` — un agent composite avec un noeud inference enfant
2. Ecrire le system prompt de l'orchestrateur — outils disponibles, strategies par complexite, regles de delegation
3. Definir les outils disponibles : file-read, file-write, directory-list, shell-execute, task-planner, code-reviewer, test-executor, git-committer, step-complete

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `content/system/blocks/agents/dev-orchestrator/dev-orchestrator.block.json` | Creer — config bloc agent avec config.nodes |
| `content/system/blocks/agents/dev-orchestrator/system-prompt.md` | Creer — prompt orchestrateur intelligent |

### Verification

```bash
# Commande 1 : Verifier que le bloc est decouvert
# node index.js list-blocks | grep dev-orchestrator
# Resultat attendu : 1 match

# Commande 2 : Test isole — tache simple
# node index.js run dev-orchestrator --input task="Create a formatDate function" --input workingDir="C:\Meastro\test-repos\crud-claude"
# Resultat attendu : fichier cree, step-complete appele, cout < $0.50
```

### Anti-patterns
- Ne PAS hardcoder la liste des outils dans le bloc JSON — les mettre dans le system prompt
- Ne PAS creer un workflow rigide — l'orchestrateur decide de l'approche
- Ne PAS oublier de tester avec une tache simple ET une tache complexe

### Checkpoint
```markdown
## 35-PRE-D : Dev orchestrator
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Bloc cree** : oui / non
**Bloc decouvert** : oui / non (list-blocks)
**Test simple** : PASS / FAIL (tache < 3 fichiers)
**Test complexe** : PASS / FAIL (tache > 5 fichiers)
**Cout test simple** : $X.XX
```

---

## 35-PRE-E : Test & validation comparative

### Lecture obligatoire
- `docs/phases/PHASE-34/34-E/COMPARAISON-MAESTRO-VS-CLAUDE.md` — baseline Claude CLI
- `docs/phases/PHASE-34/34-E/NOTES-ANALYSE.md` — analyse detaillee des repos

### Ce que cette sous-phase fait

1. Reset les 5 repos de test (crud-claude, auth-claude, etc.) a leur etat initial
2. Executer le `dev-orchestrator` sur les 5 taches
3. Comparer les resultats avec la baseline Claude CLI (COMPARAISON-MAESTRO-VS-CLAUDE.md)
4. Documenter les metriques : fichiers crees, cout, temps, qualite

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-35/PRE/RESULTATS-COMPARAISON.md` | Creer — resultats de la comparaison |
| `docs/phases/PHASE-35/PRE/checkpoint.md` | Modifier — resultats finaux |

### Verification

```bash
# Pour chaque repo :
# 1. git reset --hard HEAD~1 (ou checkout initial commit)
# 2. node index.js run dev-orchestrator --input task="..." --input workingDir="..."
# 3. Verifier les fichiers crees, le build, la qualite

# Metriques a collecter :
# - Nombre de fichiers crees
# - npm run build passe ?
# - Cout total ($)
# - Temps total (s)
# - Score qualite (/10)
```

### Anti-patterns
- Ne PAS comparer uniquement sur le nombre de fichiers — la qualite compte
- Ne PAS lancer les 5 tests en meme temps — un par un pour diagnostiquer les problemes
- Ne PAS ignorer les echecs — documenter pourquoi et corriger avant de continuer

### Checkpoint
```markdown
## 35-PRE-E : Test & validation
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Repos testes** : N / 5
**Taux de reussite** : N / 5 fonctionnels
**Cout total** : $X.XX
**Score moyen** : X/10
**Comparaison Claude CLI** : meilleur / equivalent / pire
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-35/PRE/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 35-PRE : AgentBlockExecutor refactore en orchestrateur de noeuds enfants. Tool calls en JSON direct (pas de CLI string). Terminaison = `step-complete`. Dev-orchestrator = agent intelligent adaptatif."
- Ajouter : "Agent = composite (isAtomic: false), meme interface qu'inference, implementation = boite noire"
- Retirer : "Agent = Inference Block" et toute reference a l'heritage LLMBlockExecutorBase pour l'agent
