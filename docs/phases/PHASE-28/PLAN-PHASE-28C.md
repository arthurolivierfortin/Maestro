# Plan : Phase 28-C — Optimisation Multi-Tiers + Manifeste de Publication

> Prérequis : Phase 28-A ✅ (Agent Tier 1 fonctionnel) + Phase 28-B ✅ (CLI interactif)
> Effort estimé : ~2 jours
> But : Publier des variantes avec manifeste embarqué, préparer l'adaptation automatique (Phase 29)

---

## Principes

1. **Le Tier 1 est le plafond** — C'est la référence qualité. On ne peut pas faire mieux.
2. **Chaque tier est un workflow publié** — Pas une configuration runtime, un artifact publié.
3. **Le processus foundry standard** — Workspace → foundry session → test → publish. Pas de raccourcis.
4. **Fitness = (qualité × succès) / coût** — On optimise le fitness, pas juste la qualité.
5. **Publication à chaque plateau** — Quand le fitness ne monte plus, publier et descendre le seuil.

---

## Étape 1 : Établir la baseline Tier 1

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Exécuter les 3 tâches Cantante avec Tier 1 | Utiliser le workflow autonomous-dev-v3 de Phase 28-A | 3 tâches réussies | ⬜ |
| 2 | Mesurer la qualité par agent | Pour chaque agent : temps d'exécution, tokens utilisés, qualité du résultat (0-1) | Métriques enregistrées | ⬜ |
| 3 | Calculer le coût Tier 1 | Additionner les tokens × prix par modèle pour chaque agent | Coût total baseline | ⬜ |
| 4 | Créer le rapport baseline | `baseline-tier1.json` avec qualité, coût, temps par agent | Fichier créé | ⬜ |

### Structure du rapport baseline

```json
{
  "tier": 1,
  "totalQuality": 1.0,
  "totalCost": "$$$.$$",
  "agents": {
    "context-analyzer-v3": { "model": "claude-sonnet", "quality": 1.0, "tokens": 5000, "time": "12s" },
    "task-planner-v3": { "model": "claude-sonnet", "quality": 1.0, "tokens": 3000, "time": "8s" },
    "code-implementer-v3": { "model": "claude-sonnet", "quality": 1.0, "tokens": 15000, "time": "45s" },
    "test-executor-v3": { "model": "claude-sonnet", "quality": 1.0, "tokens": 5000, "time": "15s" },
    "code-reviewer-v3": { "model": "claude-sonnet", "quality": 1.0, "tokens": 4000, "time": "10s" },
    "git-committer-v3": { "model": "claude-sonnet", "quality": 1.0, "tokens": 2000, "time": "5s" }
  }
}
```

---

## Étape 2 : Processus d'optimisation par agent

Pour chaque agent du workflow, on teste des modèles moins chers et on mesure la dégradation.

### Ordre d'optimisation

L'ordre est important — on commence par les agents les moins critiques :

1. **git-committer** — Formattage de commit message. Même un petit modèle peut le faire.
2. **test-executor** — Exécute des commandes shell et rapporte. Peu de créativité nécessaire.
3. **context-analyzer** — Lit des fichiers et résume. Qualité dépend du résumé.
4. **code-reviewer** — Évalue du code. Nécessite du jugement.
5. **task-planner** — Décompose des tâches. Nécessite de la compréhension.
6. **code-implementer** — Écrit du code. Le plus critique pour la qualité finale.

### Processus par agent

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer une foundry session pour l'agent | `session create --type foundry --name "<agent> tier optimization"` | Session créée | ⬜ |
| 2 | Tester avec le modèle Tier 1 (baseline) | Exécuter le même input que le Tier 1 | Résultat = baseline qualité | ⬜ |
| 3 | Tester avec modèle candidat N-1 | Remplacer le modèle, exécuter le même input | Résultat + qualité mesurée | ⬜ |
| 4 | Comparer qualité | Si qualité >= seuil du tier → le modèle passe | Score ≥ seuil | ⬜ |
| 5 | Si qualité < seuil | Essayer un autre modèle, ou garder le modèle actuel | Meilleur modèle choisi | ⬜ |
| 6 | Enregistrer le résultat | Mettre à jour le rapport du tier avec le modèle choisi | Rapport à jour | ⬜ |

### Hiérarchie de modèles à tester (du plus cher au moins cher)

```
claude-opus          →  Meilleur, plus cher
claude-sonnet        →  Très bon, cher
claude-haiku         →  Bon, modéré
Qwen2.5-Coder-1.5B  →  Local, gratuit, capable pour certaines tâches
SmolLM2-1.7B        →  Local, gratuit, simple inference seulement
```

---

## Étape 3 : Définition des Tiers

### Tier 2 : Haute qualité, coût réduit (≥95%)

| Agent | Modèle Tier 1 | Candidat Tier 2 | Justification |
|-------|---------------|-----------------|---------------|
| context-analyzer | claude-sonnet | claude-haiku | Résumé de fichiers = tâche simple |
| task-planner | claude-sonnet | claude-sonnet | Planification = critique, garder |
| code-implementer | claude-sonnet | claude-sonnet | Code = critique, garder |
| test-executor | claude-sonnet | claude-haiku | Exécution shell = tâche simple |
| code-reviewer | claude-sonnet | claude-sonnet | Review = critique, garder |
| git-committer | claude-sonnet | claude-haiku | Commit message = tâche simple |

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer workspace Tier 2 | `workspace create --name "Phase 28C - Tier 2 Optimization"` | Workspace créé | ⬜ |
| 2 | Cloner le workflow Tier 1 | Copier autonomous-dev-v3 → autonomous-dev-v3-tier2 | Workflow créé | ⬜ |
| 3 | Optimiser git-committer | Tester avec claude-haiku | Qualité ≥ 0.95 | ⬜ |
| 4 | Optimiser test-executor | Tester avec claude-haiku | Qualité ≥ 0.95 | ⬜ |
| 5 | Optimiser context-analyzer | Tester avec claude-haiku | Qualité ≥ 0.95 | ⬜ |
| 6 | Test E2E Tier 2 | Exécuter les 3 tâches Cantante avec le workflow Tier 2 | 3 tâches réussies, qualité ≥ 0.95 | ⬜ |
| 7 | Calculer fitness | fitness = (qualité × succès) / coût | Fitness > Tier 1 | ⬜ |
| 8 | Publier | `publish autonomous-dev-v3-tier2` | Workflow publié | ⬜ |

### Tier 3 : Qualité modérée, coût faible (≥90%)

| Agent | Modèle Tier 2 | Candidat Tier 3 | Justification |
|-------|---------------|-----------------|---------------|
| context-analyzer | claude-haiku | claude-haiku | Déjà optimisé |
| task-planner | claude-sonnet | claude-haiku | Tester si Haiku planifie bien |
| code-implementer | claude-sonnet | claude-haiku | Tester Haiku pour le code |
| test-executor | claude-haiku | Qwen2.5-Coder-1.5B | Tester un modèle local |
| code-reviewer | claude-sonnet | claude-haiku | Tester Haiku pour review |
| git-committer | claude-haiku | Qwen2.5-Coder-1.5B | Commit = formatage, local possible |

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer workspace Tier 3 | `workspace create --name "Phase 28C - Tier 3 Optimization"` | Workspace créé | ⬜ |
| 2 | Cloner le workflow Tier 2 | Copier → autonomous-dev-v3-tier3 | Workflow créé | ⬜ |
| 3 | Optimiser git-committer | Tester avec Qwen2.5-Coder-1.5B | Qualité ≥ 0.90 | ⬜ |
| 4 | Optimiser test-executor | Tester avec Qwen2.5-Coder-1.5B | Qualité ≥ 0.90 | ⬜ |
| 5 | Optimiser task-planner | Tester avec claude-haiku | Qualité ≥ 0.90 | ⬜ |
| 6 | Optimiser code-reviewer | Tester avec claude-haiku | Qualité ≥ 0.90 | ⬜ |
| 7 | Optimiser code-implementer | Tester avec claude-haiku | Qualité ≥ 0.90 | ⬜ |
| 8 | Test E2E Tier 3 | 3 tâches Cantante | 3 réussies, qualité ≥ 0.90 | ⬜ |
| 9 | Publier | `publish autonomous-dev-v3-tier3` | Workflow publié | ⬜ |

### Tier 4 : Principalement local (≥80%)

| Agent | Modèle Tier 3 | Candidat Tier 4 | Justification |
|-------|---------------|-----------------|---------------|
| context-analyzer | claude-haiku | Qwen2.5-Coder-1.5B | Résumé possible localement |
| task-planner | claude-haiku | Qwen2.5-Coder-1.5B | Tester planification locale |
| code-implementer | claude-haiku | claude-haiku | Garder au moins Haiku pour le code |
| test-executor | Qwen2.5-Coder-1.5B | Qwen2.5-Coder-1.5B | Déjà local |
| code-reviewer | claude-haiku | Qwen2.5-Coder-1.5B | Tester review locale |
| git-committer | Qwen2.5-Coder-1.5B | Qwen2.5-Coder-1.5B | Déjà local |

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer workspace Tier 4 | `workspace create --name "Phase 28C - Tier 4 Optimization"` | Workspace créé | ⬜ |
| 2 | Cloner le workflow Tier 3 | Copier → autonomous-dev-v3-tier4 | Workflow créé | ⬜ |
| 3-7 | Optimiser chaque agent | Tester avec modèles locaux | Qualité ≥ 0.80 par agent | ⬜ |
| 8 | Test E2E Tier 4 | 3 tâches Cantante | Au moins 2/3 réussies, qualité ≥ 0.80 | ⬜ |
| 9 | Publier | `publish autonomous-dev-v3-tier4` | Workflow publié | ⬜ |

### Tier 5 : 100% local (≥70%)

| Agent | Candidat Tier 5 |
|-------|-----------------|
| Tous | Qwen2.5-Coder-1.5B ou SmolLM2-1.7B |

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Tester tous les agents avec Qwen2.5-Coder-1.5B | Foundry sessions, un par agent | Qualité mesurée par agent | ⬜ |
| 2 | Identifier les agents qui tombent sous 0.70 | Comparer les résultats | Liste des points faibles | ⬜ |
| 3 | Optimiser les prompts pour les modèles locaux | Reformuler avec few-shot, JSON strict, étapes explicites | Qualité améliorée | ⬜ |
| 4 | Test E2E Tier 5 | 3 tâches Cantante | Au moins 1/3 réussie | ⬜ |
| 5 | Si qualité < 0.70 | Documenter les limites, proposer un Tier 5 partiel | Rapport clair | ⬜ |
| 6 | Publier | `publish autonomous-dev-v3-tier5` si viable | Workflow publié ou raison documentée | ⬜ |

---

## Étape 4 : Sélection automatique de tier

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Détecter les providers disponibles | `GET /api/v1/models/` → lister les modèles accessibles | Liste de modèles | ⬜ |
| 2 | Mapper modèles → tiers | Si claude-opus dispo → Tier 1. Si claude-sonnet → Tier 1-2. Si claude-haiku → Tier 2-3. Si locaux seulement → Tier 4-5 | Mapping correct | ⬜ |
| 3 | Proposer le meilleur tier | `maestro agent` affiche : "Modèles détectés: claude-sonnet, Qwen2.5-Coder. Tier recommandé: 2" | Message clair | ⬜ |
| 4 | Override possible | `maestro agent --tier 3` force un tier spécifique | Override fonctionne | ⬜ |
| 5 | Fallback intelligent | Si le tier choisi manque un modèle → proposer le tier inférieur | Message d'avertissement | ⬜ |

### Logique de sélection

```
function selectBestTier(availableModels):
  if has("claude-opus"):     return Tier 1
  if has("claude-sonnet"):   return Tier 2
  if has("claude-haiku"):    return Tier 3
  if has("Qwen2.5-Coder"):  return Tier 4
  else:                      return Tier 5
```

---

## Étape 5 : Rapport comparatif

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Générer le rapport | Comparer tous les tiers : qualité, coût, temps, fitness | Rapport structuré | ⬜ |
| 2 | Format tableau | Markdown avec tous les tiers côte à côte | Lisible | ⬜ |
| 3 | Visualisation TUI | Commande `maestro tiers` affiche le rapport dans le terminal | Affiché correctement | ⬜ |

### Format du rapport final

```
┌─────────┬─────────┬───────┬────────┬─────────┐
│ Tier    │ Qualité │ Coût  │ Temps  │ Fitness │
├─────────┼─────────┼───────┼────────┼─────────┤
│ Tier 1  │ 100%    │ $2.50 │ 95s    │ 0.40    │
│ Tier 2  │ 97%     │ $1.20 │ 80s    │ 0.81    │
│ Tier 3  │ 92%     │ $0.30 │ 70s    │ 3.07    │
│ Tier 4  │ 83%     │ $0.05 │ 120s   │ 16.60   │
│ Tier 5  │ 72%     │ $0.00 │ 180s   │ ∞       │
└─────────┴─────────┴───────┴────────┴─────────┘
```

---

## Étape 6 : Manifeste de publication (CRITIQUE pour Phase 29)

Chaque tier publié DOIT embarquer un manifeste dans ses métadonnées. Ce manifeste est la source de données pour `maestro check` (28-B) et `maestro adapt` (29-A).

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer le tool `manifest-generator` | `content/system/blocks/system/tools/manifest-generator.tool.block.json` | Block valide | ⬜ |
| 2 | Script `generate-manifest.js` | Agrège les métriques de la foundry session : modèles par bloc, fitness, substituts testés, critères d'évaluation | JSON structuré | ⬜ |
| 3 | Intégrer dans le processus de publish | Quand `publish` est invoqué, exécuter `manifest-generator` avant | Manifeste embarqué dans metadata | ⬜ |
| 4 | Vérifier les manifestes | Pour chaque tier publié, `curl` le bloc et vérifier `metadata.manifest` | Manifeste complet | ⬜ |

### Structure du manifeste

```json
{
  "manifest": {
    "version": "1.0",
    "publishedAt": "2026-02-20T14:30:00Z",
    "requirements": {
      "models": [
        {
          "id": "claude-haiku",
          "usedBy": ["context-analyzer-v3", "test-executor-v3"],
          "substitutable": true,
          "testedSubstitutes": [
            { "model": "Qwen2.5-Coder-1.5B", "fitness": 0.84, "viable": true }
          ]
        }
      ]
    },
    "fitness": {
      "overall": 0.95,
      "perBlock": {
        "context-analyzer-v3": { "model": "claude-haiku", "fitness": 0.96 }
      }
    },
    "evaluationCriteria": {
      "context-analyzer-v3": ["hasJsonStructure", "hasRequiredFields"]
    }
  }
}
```

---

## Étape 7 : Documenter les patterns pour Phase 29

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Documenter le processus répétitif | Pour chaque tier, noter les étapes identiques : foundry → test → mesure → décision → publish | Document clair | ⬜ |
| 2 | Identifier les décisions automatisables | Quelles décisions étaient évidentes ? (ex: "JSON valide = pass") vs lesquelles nécessitaient du jugement ? | Liste classée | ⬜ |
| 3 | Lister les critères d'évaluation utilisés | Par bloc et par tier, quels critères ont été utilisés et lesquels sont heuristiques vs LLM | Tableau complet | ⬜ |
| 4 | Écrire `PATTERNS-FOR-PHASE-29.md` | Résumé des patterns, input pour le design du workflow `system:optimize-block` | Document créé | ⬜ |

---

## Gate 28-C

| Critère | Vérification | Statut |
|---------|--------------|--------|
| Au moins 3 tiers publiés | `list-blocks --type workflow` montre 3+ workflows autonomous-dev-v3-tierN | ⬜ |
| Tier 1 = 100% qualité baseline | 3 tâches Cantante réussies avec Claude partout | ⬜ |
| Tier avec locaux seulement fonctionne | Tier 4 ou 5 complète au moins 1 tâche Cantante | ⬜ |
| Sélection automatique fonctionne | `run-interactive` détecte les modèles et propose un tier | ⬜ |
| Rapport comparatif généré | Tableau qualité/coût/fitness pour tous les tiers | ⬜ |
| Chaque tier testé E2E | 3 tâches Cantante par tier, résultats documentés | ⬜ |
| Fitness croissant (coût décroissant) | Tier 1 fitness < Tier 3 fitness (coût domine) | ⬜ |
| **Manifeste embarqué dans chaque tier** | `metadata.manifest` contient modèles, fitness, substituts, critères | ⬜ |
| **Patterns documentés pour Phase 29** | `PATTERNS-FOR-PHASE-29.md` créé avec processus et critères | ⬜ |
