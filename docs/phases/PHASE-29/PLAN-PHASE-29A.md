# Plan : Phase 29-A — Adaptation Automatique

> Prérequis : Phase 28-C ✅ (Tiers publiés avec manifestes)
> Effort estimé : ~2 jours
> But : `maestro adapt` — teste les modèles locaux, produit un workflow adapté

---

## Principes

1. Le manifeste du workflow publié contient TOUT ce qu'il faut (modèles, fitness, substituts testés)
2. Si un substitut est déjà testé dans le manifeste → pas de ré-exécution
3. L'évaluation utilise le meilleur évaluateur disponible (heuristique → LLM → cloud)
4. Le workflow d'adaptation EST un bloc system, overridable

---

## Étape 1 : Évaluateurs comme blocs

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer `heuristic-evaluator.tool.block.json` | Dans `content/system/blocks/evaluators/`. Script JS qui vérifie : JSON valide, champs requis, token efficiency, format, exécution success | Block fonctionnel | ⬜ |
| 2 | Créer `llm-evaluator.inference.block.json` | Bloc inference avec prompt d'évaluation. Input : sortie à évaluer + critères + contexte. Output : score + feedback | Block fonctionnel | ⬜ |
| 3 | Créer `cloud-evaluator.tool.block.json` | Stub qui retourne une erreur "Cloud evaluator not configured. Visit maestro.io/cloud" | Block fonctionnel (stub) | ⬜ |
| 4 | Créer `evaluator-selector.tool.block.json` | Détecte le meilleur évaluateur : si cloud configuré → cloud, si LLM ≥7B → llm, sinon → heuristic | Sélection correcte | ⬜ |
| 5 | Tester chaque évaluateur | Donner la même sortie à chaque évaluateur, comparer les scores | Cohérence vérifiée | ⬜ |

### Critères heuristiques supportés

```
hasJsonStructure     — L'output est du JSON valide
validJsonParse       — Parse sans erreur
hasRequiredFields    — Champs du schéma I/O présents
noMarkdownFences     — Pas de ``` parasite
tokenEfficiency      — Ratio tokens utiles / tokens totaux
minLength            — Longueur minimale
maxLength            — Longueur maximale
executionSuccess     — Le bloc n'a pas crashé
outputMatchesSchema  — Conforme au schéma de sortie du bloc
conventionalFormat   — Format conventionnel (commit, etc.)
```

---

## Étape 2 : Workflow `system:adapt-workflow`

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Créer `adapt-workflow.workflow.block.json` | Dans `content/system/blocks/adaptation/` | Block valide | ⬜ |
| 2 | Node `load-manifest` | Lit le manifeste du workflow cible | Manifeste chargé | ⬜ |
| 3 | Node `detect-models` | Appelle `model-detector` (INFRA-5) | Modèles listés | ⬜ |
| 4 | Node `find-gaps` | Compare manifeste vs modèles disponibles. Retourne les blocs sans modèle compatible | Gaps identifiés | ⬜ |
| 5 | Node `for-each gap` | Pour chaque bloc sans modèle : | | ⬜ |
| 5a | → Vérifier manifeste | Si `testedSubstitutes` contient un modèle dispo → utiliser directement | Raccourci manifeste | ⬜ |
| 5b | → Tester candidat | Sinon : exécuter le bloc 3x avec le modèle candidat, évaluer | Fitness mesuré | ⬜ |
| 5c | → Décider | Si fitness ≥ seuil → accepter. Sinon → prochain candidat ou signaler | Décision prise | ⬜ |
| 6 | Node `assemble` | Construire le workflow adapté (copier l'original, remplacer les modèles) | Workflow assemblé | ⬜ |
| 7 | Node `save` | Sauvegarder dans `.maestro/blocks/` de l'utilisateur | Fichier créé | ⬜ |

### Flux de décision par bloc

```
Pour chaque bloc avec modèle manquant :
  1. Vérifier le manifeste pour des substituts testés
     → Si un substitut est dispo ET fitness ≥ seuil → UTILISER (0 exécution)
  2. Lister les modèles candidats de l'utilisateur
  3. Pour chaque candidat (du plus capable au moins) :
     a. Exécuter le bloc 3 fois avec des inputs représentatifs
     b. Évaluer avec le meilleur évaluateur disponible
     c. Si fitness moyen ≥ seuil → ACCEPTER
  4. Si aucun candidat ne passe → SIGNALER (le bloc reste non adapté)
```

---

## Étape 3 : Commande CLI `maestro adapt`

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Ajouter la commande | `program.command('adapt <workflow>')` avec options : `--threshold`, `--evaluator`, `--save-as` | Help fonctionne | ⬜ |
| 2 | Résolution du workflow | Accepter un blockId ou un alias | Résolution correcte | ⬜ |
| 3 | Créer une session foundry | Session auto-gérée pour l'adaptation | Session créée | ⬜ |
| 4 | Invoquer `system:adapt-workflow` | Passer le workflow cible et les options | Adaptation lancée | ⬜ |
| 5 | Afficher la progression | Réutiliser les widgets de `run-interactive` | Progression visible | ⬜ |
| 6 | Afficher le résumé | Modèles substitués, fitness par bloc, workflow sauvegardé | Résumé clair | ⬜ |

### Exemples d'utilisation

```bash
# Adapter avec les défauts
maestro adapt autonomous-dev-v3-tier3

# Adapter avec un seuil spécifique
maestro adapt autonomous-dev-v3 --threshold 0.85

# Adapter avec évaluateur forcé
maestro adapt autonomous-dev-v3 --evaluator heuristic

# Sauvegarder sous un nom spécifique
maestro adapt autonomous-dev-v3 --save-as my-adapted-workflow
```

---

## Étape 4 : Intégration avec `run-interactive`

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Après `check` incompatible | Proposer "Adapt?" en plus de "Use compatible tier" | Option visible | ⬜ |
| 2 | Si l'utilisateur choisit adapt | Lancer `adapt` inline, puis continuer avec le workflow adapté | Flow seamless | ⬜ |
| 3 | Cache du workflow adapté | Si déjà adapté → réutiliser sans re-tester | Cache `.maestro/blocks/` | ⬜ |

---

## Gate 29-A

| Critère | Vérification | Statut |
|---------|--------------|--------|
| 3 évaluateurs créés (heuristic, llm, cloud-stub) | `list-blocks --type tool` montre les 3 | ⬜ |
| Évaluateur heuristique fonctionne sans LLM | Évalue une sortie correctement avec critères | ⬜ |
| `maestro adapt tier3` avec modèles locaux | Produit un workflow adapté dans .maestro/blocks/ | ⬜ |
| Raccourci manifeste fonctionne | Si le substitut est dans le manifeste → pas de test | ⬜ |
| Modèle non testé → mini-foundry | 3 itérations, évaluation, décision | ⬜ |
| Intégré dans `run-interactive` | Check → adapt → exécuter en un flow | ⬜ |
| Litmus test : zéro logique code-spécifique | Grep dans adaptation/ → 0 mention de code/commit/test | ⬜ |
