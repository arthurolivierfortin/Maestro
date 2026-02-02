# Maestro Pipeline Test Runs Summary

## Documentation de Référence

Avant d'exécuter des tests, consulter :
- **[MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md)** - Vision et idéologie du système
- **[AGENT-TOOL-CREATION-GUIDE.md](../guides/AGENT-TOOL-CREATION-GUIDE.md)** - Guide pratique de création

## Overview

Ce document résume toutes les runs de test effectuées pour valider le pipeline Maestro.

---

## Runs de Test

| Run # | Date | Statut | Tests Passés | Tests Échoués | Problèmes Identifiés | Document |
|-------|------|--------|--------------|---------------|---------------------|----------|
| 1 | 2026-01-30 | Complété | 20/22 | 2 | 4 (2 corrigés, 1 majeur, 1 mineur) | [RUN-001.md](./runs/RUN-001.md) |
| 2 | 2026-01-30 | Complété | 25/28 | 3 | 4 (2 corrigés pendant run) | [RUN-002.md](./runs/RUN-002.md) |
| 3 | 2026-01-30 | Partiel | 5/7 | 2 | **Tool calling FONCTIONNE avec SmolLM2!** | [RUN-003.md](./runs/RUN-003.md) |
| 4 | 2026-01-31 | Partiel | 6/7 | 1 | **Context block ajouté**, SmolLM2 ignore inputs | [RUN-004.md](./runs/RUN-004.md) |

---

## Tests de Capacités des Modèles

| Model | Score | Classification | Tool Calling | Document |
|-------|-------|----------------|--------------|----------|
| DeepSeek-R1-Distill-Qwen-1.5B | 66% | Medium | Oui | [Results](./model-runs/DeepSeek-R1-1.5B-results.json) |
| Qwen2.5-Coder-3B-Instruct | 53% | Medium | Oui | [Results](./model-runs/Qwen2.5-Coder-3B-results.json) |
| deepseek-coder-1.3b-instruct | 40% | Weak | Non | [Results](./model-runs/deepseek-coder-1.3B-results.json) |
| SmolLM2-1.7B-Instruct | 17% | Insufficient | **Format Parfait** | [Results](./model-runs/SmolLM2-1.7B-results.json) |
| SmolLM2-360M-Instruct | 17% | Insufficient | **Format Parfait** | [Results](./model-runs/SmolLM2-360M-results.json) |
| distilgpt2 | 0% | Insufficient | Non | [Results](./model-runs/distilgpt2-results.json) |

**Résumé complet :** [MODEL-TESTS-SUMMARY.md](./model-runs/MODEL-TESTS-SUMMARY.md)

---

## Problèmes Identifiés et Corrigés

| Run | # | Problème | Description | Sévérité | Statut | Correction |
|-----|---|----------|-------------|----------|--------|------------|
| 1 | 1 | API création block | curl avec JSON config échoue | Mineur | Contourné | Utiliser CLI |
| 1 | 2 | Agent LLM tool calls | Le modèle deepseek-coder-1.3b ne suit pas format JSON | **Majeur** | **Résolu** | Utiliser SmolLM2 |
| 1 | 3 | API block-tests | Endpoint diffère du template | Mineur | Documenté | Template mis à jour |
| 1 | 4 | Commande CLI | list-blocks vs blocks | Mineur | Corrigé | Utiliser `blocks` |
| 2 | 1 | isAtomic non lu | FileSystemBlockDiscoveryService ne lisait pas isAtomic | **Majeur** | **Corrigé** | Ajout lecture propriété |
| 2 | 2 | CLI children | Affichage incorrect des propriétés enfants | Mineur | **Corrigé** | Utiliser resolvedBlockId |
| 2 | 3 | metrics training-run | Commande non implémentée | Mineur | Non résolu | À implémenter |
| 2 | 4 | Agent LLM tool calls | Même problème que Run 1 | **Majeur** | **Résolu** | Utiliser SmolLM2 |
| 3 | 1 | Boucles agent | Agent appelle même tool plusieurs fois | Moyenne | **Résolu** | Context management |
| 4 | 1 | SmolLM2 inputs | Modèle ignore les inputs utilisateur | **Majeur** | Non résolu | Tester modèle plus capable |

---

## Progression Globale

**Dernière Run :** RUN-004 (2026-01-31)
**Statut Global :** Context management implémenté, problème modèle identifié

### ✅ CONTEXT MANAGEMENT AJOUTÉ (Run #004)

Le système de gestion du contexte a été implémenté :

**Bloc Context :**
- `sliding-window-context` : Garde les N derniers messages dans la limite de tokens
- Truncation testée : 100 messages → 11 (system + 10 recent)
- Intégré dans AgentBlockExecutor

**Configuration Agent :**
```json
{
  "config": {
    "context": {
      "strategy": "sliding-window",
      "maxTokens": 2048,
      "keepSystemPrompt": true,
      "keepLastN": 6
    }
  }
}
```

### ⚠️ NOUVEAU PROBLÈME IDENTIFIÉ (Run #004)

Le modèle `SmolLM2-1.7B-Instruct` **ignore les inputs utilisateur** et utilise des patterns mémorisés :
```
Input: task="List files in C:/Meastro"
LLM: {"tool":"list_files","args":{"path":"/home/user/Documents"}}  ← Path incorrect!
```

**Conclusion :** SmolLM2 produit du JSON valide mais n'est pas assez intelligent pour suivre les instructions.

### ✅ PROBLÈME RÉSOLU (Run #003)

Le modèle `SmolLM2-1.7B-Instruct` **produit du JSON structuré correct** pour les tool calls :
```
LLM response: {"tool":"list_files","args":{"path":"C:/Meastro"}}
Tool call detected: list_files ← Détecté et exécuté!
```

**Conclusion :** Le problème des runs #001 et #002 était le choix du modèle (`deepseek-coder-1.3b`), pas Maestro.

---

## Fonctionnalités Validées

### Fonctionnelles (100%)
- [x] Health checks des services
- [x] Listing et détails des blocks
- [x] Exécution de blocks simples (tools)
- [x] Sélection et vérification d'agents
- [x] API de tests de blocks
- [x] Configuration d'entraînement
- [x] Exécution d'entraînement (itérations réelles)
- [x] Collection de métriques
- [x] Sessions de projet (create, start, exec, stop)
- [x] **Vérification blocks composites (children)**
- [x] **Hiérarchie récursive des blocks**
- [x] **Context management (sliding-window)** ← Nouveau (Run #004)
- [x] **Bloc Context exécutable** ← Nouveau (Run #004)

### Partiellement Fonctionnelles
- [x] **Exécution d'agents avec appels d'outils** ← Format JSON OK (Run #003)
- [ ] Métriques par run d'entraînement (commande CLI manquante)
- [ ] **Instruction following** ← SmolLM2 ignore les inputs (Run #004)

### Non Testées
- [ ] Nettoyage (Phase 10 - volontairement ignorée)

---

## Recommandations Globales

### 1. **Priorité Haute**: Utiliser un Modèle avec Tool Calling

**Analyse Approfondie du Problème LLM (2026-01-30)**:

Le modèle `deepseek-coder-1.3b-instruct` BASE **n'a pas été entraîné pour le function calling**. Ce n'est PAS une limitation de Maestro mais du modèle lui-même.

**Solutions disponibles**:

| Solution | Effort | Recommandation |
|----------|--------|----------------|
| Utiliser `SmolLM2-1.7B-Instruct` | Aucun | **Recommandé** - Même taille, supporte tools |
| Utiliser `Hermes-3-Llama-3.1-8B` (INT4) | Configuration | Excellent pour tools, si VRAM suffisante |
| Utiliser `meetkai/functionary-small-v3.2` | Configuration | Spécialisé function calling |
| Fine-tuner deepseek | Élevé | Non recommandé |

**Comment utiliser un modèle avec tool-use**:

Le modèle est spécifié dans la configuration du block. Le LLM-Provider le charge automatiquement lors de l'exécution.

```json
// Dans le fichier .block.json de l'agent
{
  "config": {
    "model": "HuggingFaceTB/SmolLM2-1.7B-Instruct"
  }
}
```

**Vérifier le statut LLM actuel**:
```bash
node C:\Meastro\tools\maestro-cli\index.js llm
```

### 2. **Priorité Moyenne**: Implémenter la commande `metrics training-run` dans le CLI.

### 3. **Priorité Basse**: Finaliser le template de test avec toutes les commandes CLI correctes.

---

## Context Management (2026-01-31)

### Architecture

Le système de gestion du contexte permet d'optimiser les conversations LLM :

```
Messages (input)
    ↓
ContextProcessor (sliding-window, summarize, rag, none)
    ↓
Messages optimisés (output)
    ↓
LLM
```

### Bloc Context

**ID :** `sliding-window-context`
**Type :** `context`
**Stratégie :** Garde les N derniers messages dans la limite de tokens

**Configuration :**
```json
{
  "strategy": "sliding-window",
  "maxTokens": 4096,
  "reserveForResponse": 512,
  "keepSystemPrompt": true,
  "keepLastN": 10
}
```

### Intégration Agent

Les agents utilisent automatiquement le context management via leur config :

```json
{
  "config": {
    "context": {
      "strategy": "sliding-window",
      "maxTokens": 2048,
      "keepLastN": 6
    }
  }
}
```

### Résultats de Test

| Input | Output | Truncated |
|-------|--------|-----------|
| 5 messages | 5 messages | Non |
| 100 messages | 11 messages | Oui (90 supprimés) |

---

## Analyse LLM-Provider (2026-01-30)

### Architecture
- Service Python FastAPI sur port 8000
- Registre de 58+ modèles avec métadonnées de capacités
- Chargement à la demande (on-demand)
- Gestion automatique VRAM (décharge autres modèles lors du switch)
- Support quantization 8-bit et 4-bit

### Modèles Compatibles avec Tool Calling (6GB VRAM)

| Modèle | Capacités | VRAM FP16 |
|--------|-----------|-----------|
| SmolLM2-1.7B-Instruct | tool-use | ~4GB |
| SmolLM2-360M-Instruct | tool-use | ~1GB |
| Hermes-3-Llama-3.1-8B | tool-use, function-calling, json-output | ~4GB (INT4) |
| Functionary-small-v3.2 | tool-use, function-calling, structured-output | ~4GB (INT4) |
| Ministral-8B | tool-use, function-calling | ~4GB (INT4) |

### Endpoints Clés

- `GET /v1/models/compatible` - Modèles compatibles avec le hardware
- `GET /v1/models/registry` - Tous les modèles disponibles
- `POST /v1/switch-model` - Changer de modèle actif
- `GET /v1/models/local` - Modèles déjà téléchargés

---

## Historique des Corrections

| Date | Correction | Appliquée dans |
|------|------------|----------------|
| 2026-01-30 | Correction TrainingService pour exécution en arrière-plan (IServiceScopeFactory) | Backend |
| 2026-01-30 | Correction AgentBlockExecutor pour gestion réponses vides | Backend |
| 2026-01-30 | Correction endpoints /api/runs et /api/metrics | Backend + CLI |
| 2026-01-30 | **Lecture isAtomic dans FileSystemBlockDiscoveryService** | Backend |
| 2026-01-30 | **Ajout méthode SetVersion à BlockDefinition** | Backend |
| 2026-01-30 | **Correction affichage children dans CLI** | CLI |
| 2026-01-30 | **Création MAESTRO-PHILOSOPHY.md** | Documentation |
| 2026-01-30 | **Création AGENT-TOOL-CREATION-GUIDE.md** | Documentation |
| 2026-01-31 | **Ajout IContextProcessor et implémentations** | Backend |
| 2026-01-31 | **Ajout SlidingWindowContextProcessor** | Backend |
| 2026-01-31 | **Ajout ContextBlockExecutor** | Backend |
| 2026-01-31 | **Intégration context dans AgentBlockExecutor** | Backend |
| 2026-01-31 | **Ajout bloc sliding-window-context** | Blocks |
| 2026-01-31 | **Ajout type context dans frontend** | Frontend |

---

## Architecture Validée

La Run #2 a confirmé que l'architecture de composition des blocks fonctionne :

```
Workflow (autonomous-development)
  ├── Tool: git-status
  ├── Tool: directory-list
  ├── Agent: autonomous-programmer (composite)
  ├── Tool: git-diff
  ├── Tool: test-runner
  ├── Decision: validate-result
  ├── Tool: shell-execute
  └── Script: handle-failure
```

Les blocks peuvent contenir n'importe quel autre type de block, conformément à la philosophie Maestro (voir MAESTRO-PHILOSOPHY.md).

---

## Notes

- Les tests ont été exécutés sur le repository Maestro (C:\Meastro)
- Le projet Cantante (C:\Cantante) a été utilisé pour les tests de sessions
- Services démarrés via `powershell.exe -File C:\Meastro\scripts\dev-start.ps1`
- Le template de test a été mis à jour pour être CLI-only (plus de curl)
- Phase 11 (Blocks Composites) ajoutée au template
