# Guide: Session Foundry "Generate Commit Tool"

Ce guide explique comment configurer, lancer et utiliser la session Foundry qui crée un outil `generate-commit-description`.

---

## Qu'est-ce que cette session ?

Cette session Foundry est un **environnement d'entraînement** qui:

1. **Évalue l'état actuel** du repo (git diff, git log)
2. **Génère** un outil de commit description via LLM
3. **Applique** le résultat dans le répertoire de travail
4. **Évalue la qualité** (fitness score) et met à jour les métriques

Le tout est visible en **temps réel** dans le TUI Monitor.

---

## Prérequis

- Backend Maestro compilé et fonctionnel
- Node.js installé
- LLM-Provider optionnel (fallback automatique si indisponible)

---

## Commandes Complètes

### 1. Démarrer les services

```powershell
# Dans un terminal PowerShell
powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -BackendOnly
```

Attendez que les services soient prêts, puis vérifiez:

```powershell
cd C:\Meastro\tools\maestro-cli
node index.js health
```

Sortie attendue:
```
  Backend (localhost:5000):      Healthy
  LLM Provider (localhost:8000): Healthy (ou Unavailable - c'est OK)
```

### 2. Créer le projet

```powershell
node index.js projects create --name "Gen Commit Foundry" --path "C:\Users\arthu\foundry-repos\gen-commit"
```

Notez le **PROJECT_ID** retourné.

### 3. Créer la session

```powershell
node index.js session create --project <PROJECT_ID> --name "Generate Commit Tool" --authority human --access full
```

Notez le **SESSION_ID** retourné.

### 4. Importer le template Foundry

```powershell
node index.js session import <SESSION_ID> --template foundry-default
```

Ceci importe automatiquement:
- **Variables**: currentIteration, currentFitness, scoreHistory, targetFitness, maxIterations, etc.
- **Entry Points**: start, validate-block, improve-agent, submit-approval, etc.
- **Widgets**: fitness progress bar, iteration counter, score chart, pending approvals

### 5. Démarrer la session (lance le TUI Monitor automatiquement)

```powershell
node index.js session start <SESSION_ID>
```

Une **nouvelle fenêtre PowerShell** s'ouvre avec le TUI Monitor.

### 6. Invoquer les workflows

Dans le terminal original (pas le TUI):

```powershell
# D'abord, valider les blocs
node index.js session invoke <SESSION_ID> validate-block

# Puis, lancer le workflow principal
node index.js session invoke <SESSION_ID> start
```

### 7. Observer dans le TUI

Le TUI Monitor affiche:
- **WORKFLOW TREE**: Les nœuds progressent de `pending` → `running` → `done`
- **WIDGETS**: Fitness score, itération courante, historique des scores
- **VARIABLES**: Toutes les variables de session en temps réel

### 8. Arrêter la session

```powershell
node index.js session stop <SESSION_ID>
```

---

## Ce que fait chaque Entry Point

| Entry Point | Workflow | Description |
|-------------|----------|-------------|
| `validate-block` | block-validation | Valide la structure des blocs (load → syntax → schema) |
| `start` | agent-improvement-loop | Boucle complète: évaluer → générer → appliquer → scorer |
| `improve-agent` | agent-improvement-loop | Même que start |
| `submit-approval` | submit-for-approval | Soumet pour approbation |

---

## Pipeline du Workflow "start" (Improvement Loop)

```
┌──────────────────────┐
│  evaluate-current     │  git diff --stat + git log --oneline -5
│  [pending → running   │  (commandes réelles sur le repo)
│   → done]             │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  generate-improvement │  Appel LLM pour générer l'outil
│  [pending → running   │  (utilise ILLMGateway.SendAsync)
│   → done]             │  (fallback si LLM indisponible)
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  apply-changes        │  Écrit le fichier gen-commit-tool.json
│  [pending → running   │  dans le répertoire du projet
│   → done]             │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  check-fitness        │  Évalue la qualité du résultat
│  [pending → running   │  Met à jour: currentFitness,
│   → done]             │  currentIteration, scoreHistory
└──────────────────────┘
```

---

## Raccourcis TUI Monitor

| Touche | Action |
|--------|--------|
| `t` | Toggle workflow tree |
| `w` | Toggle widgets |
| `v` | Toggle variables |
| `f` | Toggle filesystem |
| `l` | Toggle command log |
| `r` | Refresh maintenant |
| `?` | Aide |
| `q` | Quitter |
| `Esc` | Retour à la liste des sessions |

---

## Variables de Session Importantes

| Variable | Description | Mise à jour |
|----------|-------------|-------------|
| `_executionTree` | Arbre d'exécution (affiché dans le TUI) | À chaque étape du workflow |
| `_activeWorkflow` | Nom du workflow en cours | Début/fin de workflow |
| `currentIteration` | Numéro d'itération actuel | Fin de chaque boucle |
| `currentFitness` | Score de fitness (0-1) | Fin de chaque boucle |
| `scoreHistory` | Historique des scores | Fin de chaque boucle |
| `targetFitness` | Seuil cible | Configurable |
| `maxIterations` | Maximum d'itérations | Configurable |

---

## Résolution de Problèmes

### Le TUI ne montre pas l'arbre d'exécution
- Vérifiez que la session est en statut `running`
- Vérifiez les variables: `node index.js session vars <ID> get _executionTree`
- Appuyez sur `t` pour activer le panneau tree

### Le LLM ne répond pas
- C'est normal si LLM-Provider n'est pas démarré
- Le système utilise un **fallback automatique** qui génère un outil par défaut
- Pour activer le LLM: démarrez LLM-Provider sur le port 8000

### La session ne démarre pas
- Vérifiez que le backend est en marche: `node index.js health`
- Vérifiez que le projet existe: `node index.js projects list`
