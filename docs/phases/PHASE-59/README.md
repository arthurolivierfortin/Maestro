# Phase 59 : Agent Isolation — Sessions enfants, I/O controle, permissions enforcement

**Statut** : A faire
**Prerequis** : Phase 59-PRE-2 COMPLETE (cost enforcement, graceful shutdown)
**Objectif** : Isoler chaque agent (blockRef) dans une session enfant avec I/O controle strict et permissions enforces, pour que les workflows multi-agents (block-forge, /adapt) fonctionnent de facon fiable.
**Duree estimee** : 3-5 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-59/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS casser les workflows existants** — les agents sans isolation doivent continuer a fonctionner (fallback)
5. **Ne PAS ajouter de logique dans AgentBlockExecutor** — l'isolation est dans l'infrastructure (NodeExecutionEngine / BlockRefHandler)

---

## Contexte

### Le probleme

Quand un workflow execute 2+ agents sequentiellement (ex: test-designer puis agent-creator dans block-forge), les agents partagent la meme session. Consequences :
- Les variables d'un agent polluent le suivant (`_workflowCheckpoint`, conversation history)
- Les permissions ne sont pas enforces (un agent peut lire/ecrire n'importe ou)
- `GetParentContext()` ne fonctionne pas E2E
- Le premier agent laisse des artefacts qui perturbent le second

### La solution

Chaque blockRef de type agent cree une **session enfant** temporaire :
- I/O defini : le workflow passe des inputs, l'agent retourne des outputs, rien d'autre ne traverse
- Permissions enforces : `FileAccessRule` et `BlockPermission` respectes
- Etat nettoye : `_workflowCheckpoint` et conversation remis a zero entre agents
- `GetParentContext()` retourne le contexte du workflow parent

### Sources

- `docs/phases/PHASE-59-PRE-2/cost-enforcement-analysis.md` — analyse des limites de couts (pattern similar d'interception dans BlockRefHandler)
- `docs/system/design-decisions/ADR-PROVIDER-ROUTING.md` — pattern de resolution dynamique

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 59-A | Sessions enfants pour chaque blockRef agent | 1-2 jours |
| 59-B | I/O controle + _workflowCheckpoint cleanup entre agents | 1 jour |
| 59-C | Enforcement FileAccessRule + BlockPermission + GetParentContext() | 1-2 jours |
| 59-D | TUI : visibilite complete de l'isolation (Spaces tree, /status, CLI --tree) | 1 jour |
| 59-T | Tests : 2+ agents sequentiels, isolation verifiee | 0.5 jour |

---

## 59-A : Sessions enfants pour blockRef agents

### Fichiers cibles

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Modifier — creer une session enfant quand le block est de type agent |
| `apps/backend/src/Maestro.Domain/Entities/Session.cs` | Modifier — ajouter `parentSessionId` + relation parent/enfant |
| `apps/backend/src/Maestro.Infrastructure/Sessions/SessionManager.cs` | Modifier — methode `CreateChildSession()` |
| `apps/backend/src/Maestro.Infrastructure/Sessions/SessionStateManager.cs` | Modifier — propager le cleanup de sessions enfants |

### Verification

```bash
# 1. Build backend
dotnet build apps/backend/src/Maestro.Api/Maestro.Api.csproj
# Resultat : 0 erreurs

# 2. Workflow avec 2 agents
# Invoquer block-forge → verifier que test-designer et agent-creator ont chacun une session enfant
curl http://localhost:5000/api/sessions/{parent-id}
# Resultat : variables contiennent les IDs des sessions enfants
```

---

## 59-B : I/O controle + cleanup

### Fichiers cibles

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Modifier — passer uniquement les inputs declares, recuperer uniquement les outputs |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` | Modifier — clear _workflowCheckpoint entre blockRef agents |

### Verification

```bash
# Verifier que les variables de l'agent 1 ne sont pas visibles par l'agent 2
# Agent 1 set _myVar = "test" → agent 2 ne doit pas avoir _myVar
curl http://localhost:5000/api/sessions/{child-2-id}/variables
# Resultat : pas de _myVar
```

---

## 59-C : Enforcement permissions + GetParentContext()

### Fichiers cibles

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — propager les permissions de la session enfant, pas du parent |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Modifier — GetParentContext() retourne le contexte du workflow parent |
| `apps/backend/src/Maestro.Domain/Entities/FileAccessRule.cs` | Verifier — enforcement dans le contexte session enfant |

### Verification

```bash
# GetParentContext() retourne le parent
curl http://localhost:5000/api/sessions/{child-id}/context
# Resultat : parentSessionId = ID du workflow

# Permissions enforces
# Agent enfant ne peut pas lire hors de son workingDir sans permission explicite
```

---

## 59-T : Tests

### Couches applicables

| Couche | Quand obligatoire |
|--------|-------------------|
| C1 — Type Check | Toujours |
| C2 — Tests unitaires | BlockRefHandler session enfant, I/O controle |
| C5 — Tests d'integration | Workflow 2+ agents sequentiels |
| C6 — E2E | Block-forge avec isolation |

### Scenarios de test

1. **2 agents sequentiels** : test-designer → agent-creator, chacun isole
2. **Variable isolation** : agent 1 set une variable, agent 2 ne la voit pas
3. **_workflowCheckpoint cleanup** : clear entre agents
4. **Permissions** : agent enfant respecte ses FileAccessRules
5. **GetParentContext()** : retourne le workflow parent
6. **Fallback** : blocks non-agents continuent a fonctionner normalement (pas de session enfant)

---

## Definition of Done

- [ ] Chaque blockRef agent cree une session enfant
- [ ] I/O controle : seuls les inputs/outputs declares traversent
- [ ] _workflowCheckpoint nettoye entre agents
- [ ] FileAccessRule + BlockPermission enforces dans la session enfant
- [ ] GetParentContext() retourne le contexte du workflow parent
- [ ] 2+ agents sequentiels fonctionnent correctement dans block-forge
- [ ] Tests passent (unit + integration)
- [ ] 0 regression sur workflows existants

### NOT in scope

- Refactoring de AgentBlockExecutor (Phase 53 l'a deja fait)
- Parallelisme inter-agents (un seul agent a la fois dans V1)
- Model Playground (Phase 60)
- Modification de block-forge (Phase 61)

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-59/checkpoint.md`

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 59 : Agent Isolation (sessions enfants, I/O controle, permissions enforcement)"
- Mettre a jour : "Current Project State"
