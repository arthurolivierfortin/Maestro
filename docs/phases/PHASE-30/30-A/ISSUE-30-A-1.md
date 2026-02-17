# Issue 30-A-1 : Supprimer les fichiers agents legacy

**Statut** : A faire
**Estimation** : 30 minutes
**Bloquant** : Non
**Prerequis** : Aucun

---

## Description

Nettoyer `content/system/blocks/agents/` et `content/system/blocks/` des fichiers et dossiers qui ne font pas partie du Tier 1 composite. Ces fichiers sont des vestiges de tentatives precedentes (Phase 28 originale) et creent de la confusion.

---

## Tache detaillee

### 1. Supprimer les fichiers agents "loose" (13 fichiers)

Fichiers JSON directement dans `content/system/blocks/agents/` sans dossier propre :

```
autonomous-programmer.agent.block.json
autonomous-programmer.agent.json
cantante-audio-developer.agent.block.json
cantante-developer.agent.block.json
cantante-simple-dev.agent.block.json
cantante-smollm.agent.block.json
cantante-ui-developer.agent.block.json
code-developer.agent.block.json
result-validator.agent.block.json
simple-task-executor.agent.block.json
task-decomposer.agent.block.json
test-pipeline-agent.agent.block.json
ui-feature-developer.agent.block.json
```

### 2. Supprimer les dossiers vestiges (7 dossiers)

Dossiers d'agents qui ne font pas partie du Tier 1 :

```
coder-agent/
git-agent/
planner-agent/
reviewer-agent/
tester-agent/
fix-bug/
implement-feature/
```

### 3. Supprimer les blocs prematures (Phase 33, pas Phase 30)

Blocs crees pour l'Agent Creator ou les phases futures :

```
agent-creator/
agent-assembler/
understand-request/
design-architecture/
block-generator/
training-orchestrator/
code-implementer/
workflow-state-manager/
```

### 4. Verifier les blocs a GARDER

S'assurer que ces dossiers existent toujours apres nettoyage :

**Agents (pour le Tier 1)** :
- `autonomous-dev/` — orchestrateur (sera reecrit en 30-C)
- `project-preparer/` — prepare
- `context-analyzer/` — garde pour Phase 32 (ou fusionne avec prepare)
- `task-planner/` — plan
- `implement-single-step/` — implement-step
- `test-executor/` — test
- `git-committer/` — commit
- `interaction-handler/` — garde pour Phase 31

**Inference** :
- `content/system/blocks/inference/code-reviewer/` — review

---

## Instructions de test

```bash
# Avant nettoyage : noter le contenu actuel
ls content/system/blocks/agents/
ls content/system/blocks/inference/

# Apres nettoyage : verifier que SEULS les dossiers necessaires restent
ls content/system/blocks/agents/
# Attendu : autonomous-dev/ context-analyzer/ git-committer/ implement-single-step/
#           interaction-handler/ project-preparer/ task-planner/ test-executor/

ls content/system/blocks/inference/
# Attendu : code-reviewer/ (et les autres blocs inference existants)

# Verifier qu'aucun fichier loose ne reste
ls content/system/blocks/agents/*.json
# Attendu : aucun fichier (tous dans des sous-dossiers)

# Verifier que le backend compile toujours
cd backend && dotnet build

# Verifier que list-blocks ne liste pas les blocs supprimes
cd maestro-cli && node index.js list-blocks
```

---

## Critere de completion

- [ ] Les 13 fichiers loose sont supprimes
- [ ] Les 7 dossiers vestiges sont supprimes
- [ ] Les 8 dossiers prematures sont supprimes
- [ ] Les 8 dossiers agents du Tier 1 sont intacts
- [ ] Le dossier `inference/code-reviewer/` est intact
- [ ] `dotnet build` compile sans erreur
- [ ] `list-blocks` ne montre que les blocs necessaires

---

## Risques

- **Risque** : Un bloc supprime est reference par un autre fichier
- **Mitigation** : Grep `content/system/` pour les IDs des blocs supprimes avant suppression
- **Si le risque se materialise** : Restaurer via `git checkout` le fichier concerne
