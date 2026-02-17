# ADR : Strategie de selection des modeles pour autonomous-dev Tier 1

**Date** : 2026-02-17
**Statut** : Accepted
**Contexte** : Phase 30 — Choix des modeles pour chaque sous-bloc du Tier 1

---

## Decision

Le Tier 1 utilise **Opus pour les taches de reflexion** et **Sonnet pour les taches d'execution** :

| Bloc | Modele | Categorie |
|------|--------|-----------|
| prepare | Opus | Reflexion (synthese, abstraction, creation de docs) |
| plan | Opus | Reflexion (decomposition, architecture, dependances) |
| implement-step | Sonnet | Execution (code focalise, une seule tache) |
| test | Sonnet | Execution (detection, commandes shell, parsing) |
| review | Opus | Reflexion (jugement holiste, evaluation qualite) |
| commit | Sonnet | Execution (formatage, conventions) |

## Raisons de la decision

### Pourquoi Opus pour prepare, plan, review ?

Ces blocs font de la **reflexion strategique** :
- `prepare` : doit comprendre un projet ENTIER (architecture, conventions, patterns) et produire de la documentation de qualite. Requiert synthese et abstraction.
- `plan` : doit decomposer une tache en sous-taches ordonnees avec des dependances correctes. Requiert vision d'ensemble et raisonnement sur les dependances.
- `review` : doit evaluer la qualite GLOBALE de tous les changements. Requiert jugement et sens critique.

Sonnet est bon en code mais moins bon en raisonnement strategique. La difference est mesurable sur les taches de planification et d'evaluation.

### Pourquoi Sonnet pour implement-step, test, commit ?

Ces blocs font de **l'execution focalisee** :
- `implement-step` : recoit une tache PRECISE (une step, quelques context_files). Sonnet est excellent pour le code quand le scope est clair.
- `test` : detecte un framework, execute des commandes, parse des resultats. Pas besoin de raisonnement strategique.
- `commit` : formate un message de commit et stage les fichiers. Simple et mecanique.

Opus serait surdimensionne (plus lent, plus cher) pour ces taches.

### Pourquoi pas Haiku pour test et commit ?

En Tier 1, la priorite est la **qualite maximale**, pas l'optimisation des couts. Sonnet est le minimum pour garantir que :
- `test` parse correctement les erreurs complexes (stack traces, multi-ligne)
- `commit` ne fait pas de `git add .` et produit un message semantique

L'optimisation vers Haiku est le sujet de la Phase 32 (Tier 2+).

## Cout estime par tache

| Bloc | Modele | Tokens in (estime) | Tokens out (estime) | Cout par appel |
|------|--------|-------------------|--------------------| --------------|
| prepare | Opus | ~50K | ~5K | ~$1.50 |
| plan | Opus | ~20K | ~3K | ~$0.70 |
| implement-step (x N) | Sonnet | ~15K | ~2K | ~$0.10 x N |
| test | Sonnet | ~10K | ~2K | ~$0.08 |
| review | Opus | ~30K | ~3K | ~$1.00 |
| commit | Sonnet | ~5K | ~1K | ~$0.04 |

**Cout total par tache (estimatif)** :
- Tache simple (3 steps) : ~$3.60
- Tache moderee (7 steps) : ~$4.00
- Tache complexe (15 steps) : ~$4.80

> **Note** : Ces couts sont des estimations basees sur les tarifs Claude 2026. Le cout reel depend de la complexite du projet et du nombre de steps.

## Consequences

- Le Tier 1 est cher mais de haute qualite — c'est volontaire
- Les phases 32+ optimiseront les couts en substituant des modeles
- Les prompts du Tier 1 sont optimises pour Opus/Sonnet — ils devront etre reecrit pour des modeles plus petits
- Le `metadata.models` du bloc composite documente le mapping pour chaque tier

## Alternatives considerees

### Tout Opus

Rejete : Opus est plus lent et plus cher. Pour le code focalise (implement-step), Sonnet est aussi bon et 10x moins cher.

### Tout Sonnet

Rejete : Sonnet est moins bon pour la planification et l'evaluation. Un plan Sonnet a plus de risque d'avoir des dependances manquantes ou un ordre incorrect.

### Claude Haiku 4.5 partout (low-cost)

Rejete pour le Tier 1 : Haiku est un Tier 2/3. Le Tier 1 doit prouver que la qualite maximale est atteignable.

## References

- `docs/phases/PHASE-13/ADR-TRAINING-OPTIMIZATION-RESEARCH.md` — Evaluation criteria > model choice
- `docs/phases/PHASE-26/REFACTORING-AGENT-INFERENCE-MERGE.md` — Agent = Inference Block
- Phase 32 `SUBSTITUTION-MATRIX.md` (a creer) — Matrice de substitution par tier
