# Plan : Phase 29-B — Optimisation Automatique

> Prérequis : Phase 29-A ✅ (Adaptation fonctionne, évaluateurs créés)
> Effort estimé : ~2 jours
> But : `maestro optimize` — meta-workflow qui optimise n'importe quel bloc

---

## Principes

1. L'optimisation est une opération EXTERNE sur un bloc (meta-workflow), pas une opération DU bloc
2. Les stratégies d'optimisation sont elles-mêmes des blocs → overridables, composables, mesurables
3. Le mode récursif optimise un workflow bottom-up (feuilles d'abord, puis test E2E)
4. L'optimisation utilise les évaluateurs de Phase 29-A

---

## Étape 1 : Stratégies d'optimisation comme blocs

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer `model-downgrade.workflow.block.json` | Dans `content/system/blocks/strategies/`. Teste des modèles progressivement moins chers. | Block valide | ⬜ |
| 2 | Créer `prompt-refinement.workflow.block.json` | Utilise un LLM capable pour reformuler le prompt du bloc cible (few-shot, instructions explicites, contraintes). | Block valide | ⬜ |
| 3 | Créer `temperature-tuning.workflow.block.json` | Teste la température de 0.1 à 0.9 par pas de 0.1, mesure la stabilité et la qualité. | Block valide | ⬜ |
| 4 | Tester chaque stratégie | Appliquer sur un bloc simple (ex: commit-message-generator) | Chaque stratégie produit un résultat | ⬜ |

### Interface commune des stratégies

Chaque stratégie est un workflow qui accepte les mêmes inputs :

```json
{
  "inputs": {
    "targetBlockId": "string",
    "threshold": "number",
    "maxIterations": "number",
    "evaluator": "string (blockId de l'évaluateur)"
  },
  "outputs": {
    "optimizedBlock": "object (la config optimisée)",
    "fitness": "number",
    "iterations": "number",
    "changes": "array (ce qui a changé)"
  }
}
```

### Stratégie `model-downgrade` (détail)

```
1. Charger le bloc cible et son modèle actuel
2. Lister les modèles disponibles triés par coût décroissant
3. Pour chaque modèle moins cher que l'actuel :
   a. Remplacer le modèle dans la config du bloc
   b. Exécuter le bloc 3 fois avec des inputs représentatifs
   c. Évaluer le fitness
   d. Si fitness ≥ threshold → ACCEPTER (meilleur fitness/coût)
   e. Si fitness < threshold → NEXT
4. Retourner le meilleur modèle trouvé (ou l'original si aucun ne passe)
```

### Stratégie `prompt-refinement` (détail)

```
1. Charger le bloc cible et son prompt
2. Exécuter le bloc 3 fois → baseline fitness
3. Demander à un LLM évaluateur de reformuler le prompt :
   - Ajouter des exemples few-shot
   - Rendre les instructions plus explicites
   - Ajouter des contraintes de format
4. Exécuter avec le nouveau prompt 3 fois → nouveau fitness
5. Si amélioration → garder. Répéter jusqu'à plateau.
6. Note : nécessite un LLM capable (au moins haiku) pour reformuler
```

---

## Étape 2 : Workflow `system:optimize-block`

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer `optimize-block.workflow.block.json` | Dans `content/system/blocks/optimization/` | Block valide | ⬜ |
| 2 | Node `load-target` | Charge le bloc cible via discovery | Bloc chargé | ⬜ |
| 3 | Node `select-evaluator` | Utilise `evaluator-selector` de 29-A | Évaluateur choisi | ⬜ |
| 4 | Node `resolve-strategy` | Charge la stratégie (system default ou spécifiée) | Stratégie chargée | ⬜ |
| 5 | Node `create-foundry` | Crée une foundry session pour l'optimisation | Session créée | ⬜ |
| 6 | Node `run-strategy` | Exécute le workflow de stratégie avec le bloc comme cible | Optimisation terminée | ⬜ |
| 7 | Node `compare` | Compare le fitness avant/après | Rapport de comparaison | ⬜ |
| 8 | Node `decide-publish` | Si amélioration significative → proposer publication | Décision prise | ⬜ |

### Flux du meta-workflow

```
maestro optimize context-analyzer-v3 --strategy model-downgrade

┌─ system:optimize-block ──────────────────────────┐
│                                                   │
│  1. Load target: context-analyzer-v3              │
│     model: claude-haiku, fitness: 0.96            │
│                                                   │
│  2. Select evaluator: heuristic-evaluator         │
│     (no capable LLM for evaluation)               │
│                                                   │
│  3. Strategy: model-downgrade                     │
│                                                   │
│  4. Create foundry session                        │
│     "context-analyzer-v3 - model-downgrade opt"   │
│                                                   │
│  5. Run strategy:                                 │
│     Testing Qwen2.5-Coder-1.5B...                 │
│       Iter 1: fitness 0.84                        │
│       Iter 2: fitness 0.86                        │
│       Iter 3: fitness 0.85                        │
│       Average: 0.85 ≥ 0.80 threshold ✅          │
│                                                   │
│  6. Compare:                                      │
│     Before: claude-haiku (0.96) — $0.05/call      │
│     After:  Qwen2.5-Coder (0.85) — $0.00/call    │
│     Fitness improvement: 0.85/0.96 quality        │
│     Cost improvement: 100% reduction              │
│                                                   │
│  7. Save optimized block? [Y/n]                   │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Étape 3 : Mode récursif pour workflows

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Détecter les children d'un workflow | Lire `config.nodes` et extraire les `blockRef` | Liste des blocs enfants | ⬜ |
| 2 | Optimiser chaque enfant | Pour chaque blockRef : appeler `system:optimize-block` | Tous les enfants optimisés | ⬜ |
| 3 | Assembler le workflow optimisé | Remplacer les blockRef par les versions optimisées | Workflow assemblé | ⬜ |
| 4 | Test E2E | Exécuter le workflow complet avec les blocs optimisés | Test pass | ⬜ |
| 5 | Comparer avec l'original | Fitness global avant/après | Rapport comparatif | ⬜ |

### Ordre d'optimisation (bottom-up)

```
maestro optimize autonomous-dev-v3 --recursive

Ordre d'exécution :
  1. git-committer-v3        (feuille, moins critique)
  2. test-executor-v3        (feuille)
  3. context-analyzer-v3     (feuille)
  4. code-reviewer-v3        (feuille)
  5. task-planner-v3         (feuille)
  6. code-implementer-v3     (feuille, plus critique)
  7. autonomous-dev-v3       (workflow, test E2E final)
```

L'ordre suit le même principe que Phase 28-C : des moins critiques aux plus critiques. L'échec d'un bloc non-critique n'empêche pas de continuer.

---

## Étape 4 : Commande CLI `maestro optimize`

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Ajouter la commande | `program.command('optimize <block>')` | Help fonctionne | ⬜ |
| 2 | Option `--strategy` | Nom du bloc stratégie (défaut: `model-downgrade`) | Résolution correcte | ⬜ |
| 3 | Option `--threshold` | Fitness minimum accepté (défaut: 0.80) | Seuil appliqué | ⬜ |
| 4 | Option `--recursive` | Active l'optimisation bottom-up pour les workflows | Récursion fonctionne | ⬜ |
| 5 | Option `--evaluator` | Force un évaluateur (heuristic, llm, cloud) | Override fonctionne | ⬜ |
| 6 | Option `--dry-run` | Affiche ce qui serait optimisé sans exécuter | Plan affiché | ⬜ |
| 7 | Progression | Réutiliser les widgets de `run-interactive` | Visible en temps réel | ⬜ |

### Exemples d'utilisation

```bash
# Optimiser un bloc avec la stratégie par défaut
maestro optimize context-analyzer-v3

# Optimiser avec une stratégie spécifique
maestro optimize context-analyzer-v3 --strategy prompt-refinement

# Optimiser un workflow entier
maestro optimize autonomous-dev-v3 --recursive

# Voir ce qui serait optimisé
maestro optimize autonomous-dev-v3 --recursive --dry-run

# Optimiser avec un seuil strict
maestro optimize autonomous-dev-v3 --recursive --threshold 0.95

# Utiliser une stratégie personnalisée
maestro optimize my-block --strategy my-custom-strategy
```

---

## Étape 5 : Infrastructure évaluateur cloud (préparation)

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Définir l'API de l'évaluateur cloud | Spécification OpenAPI du endpoint `POST /evaluate` | Spec écrite | ⬜ |
| 2 | Définir le format de requête/réponse | Input : output du bloc + critères + contexte. Output : score + feedback + suggestions | Format documenté | ⬜ |
| 3 | Compléter le stub `cloud-evaluator` | Passer de "not configured" à "check maestro.io/cloud" avec lien d'inscription | Message amélioré | ⬜ |
| 4 | Config CLI | `maestro config cloud --api-key <key>` pour configurer le cloud | Config stockée | ⬜ |

**Note** : Le service cloud lui-même est Phase 30. Ici on prépare seulement l'interface.

---

## Gate 29-B

| Critère | Vérification | Statut |
|---------|--------------|--------|
| 3 stratégies créées (model-downgrade, prompt-refinement, temperature-tuning) | `list-blocks --type workflow` dans strategies/ | ⬜ |
| `system:optimize-block` fonctionne | Optimise un bloc simple avec une stratégie | ⬜ |
| `maestro optimize <block>` CLI | Commande end-to-end | ⬜ |
| Mode récursif | `--recursive` sur un workflow → optimise bottom-up | ⬜ |
| Stratégie personnalisée | `.maestro/blocks/strategies/my-strategy.workflow.block.json` utilisable | ⬜ |
| `--dry-run` affiche le plan | Pas d'exécution, juste le plan | ⬜ |
| API évaluateur cloud définie | Spécification OpenAPI écrite, stub fonctionnel | ⬜ |
| Litmus test | `maestro optimize recipe-generator --strategy prompt-refinement` fonctionne | ⬜ |
