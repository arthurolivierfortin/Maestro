# Phase 35 : `maestro adapt` + `maestro optimize`

**Statut** : A faire
**Prerequis** : Phase 34 COMPLETE (au moins 2 tiers publies avec manifestes)
**Objectif** : Automatiser l'adaptation des workflows aux modeles disponibles de l'utilisateur et l'optimisation des tiers.

---

## Vision

Phase 34 cree les tiers manuellement. Phase 35 automatise ce processus :

- **`maestro adapt <workflow>`** : L'utilisateur a ses propres modeles (locaux ou cloud).
  L'outil lit le manifeste du workflow, detecte les modeles disponibles, teste des
  substitutions automatiquement, et produit un workflow personnalise.

- **`maestro optimize <block>`** : Meta-workflow qui prend un bloc et tente de
  l'optimiser avec des strategies pluggables (model-downgrade, prompt-refinement,
  temperature-tuning). Les strategies sont elles-memes des blocs.

---

## Sous-phases

| Phase | Titre | Objectif | Effort |
|-------|-------|----------|--------|
| 35-A | `maestro adapt` | Adaptation automatique aux modeles de l'utilisateur | 1-2 semaines |
| 35-B | `maestro optimize` | Meta-workflow d'optimisation avec strategies pluggables | 1-2 semaines |

---

## 35-A : `maestro adapt`

```bash
$ maestro adapt autonomous-development

Reading manifest for autonomous-development@3.0.0 (Tier 1)...
Detecting available models...
  ✓ claude-sonnet (via ClaudeCodeProvider)
  ✓ qwen-2.5-coder-1.5b (via LocalProvider)
  ✗ claude-haiku (not configured)

Testing substitutions:
  project-preparer: claude-sonnet → qwen-2.5-coder... fitness 0.65 (below 0.80, keeping claude-sonnet)
  git-committer:    claude-sonnet → qwen-2.5-coder... fitness 0.88 (OK, substituting)
  code-reviewer:    claude-sonnet → qwen-2.5-coder... fitness 0.72 (below 0.80, keeping claude-sonnet)

Result: Custom tier generated
  4/6 blocks: claude-sonnet
  2/6 blocks: qwen-2.5-coder-1.5b
  Global fitness: 0.87
  Estimated cost reduction: 25%

Save as personal tier? [Y/n]
```

**Mecanisme** :
1. Lire le manifeste du workflow (modeles requis, fitness par bloc, substituts deja testes)
2. Detecter les modeles disponibles via `LLM-Provider /api/v1/models/`
3. Pour chaque bloc, tester les substituts disponibles (mini-session foundry, 3 iterations, evaluateur heuristique)
4. Garder la substitution seulement si fitness >= seuil (configurable, default 0.80)
5. Sauvegarder le workflow adapte comme tier personnel

**3 niveaux d'evaluateurs** :
- Niveau 1 (Heuristique) : JSON valide, champs requis, efficacite tokens — gratuit, toujours
- Niveau 2 (LLM local) : Un modele local evalue la sortie d'un autre — gratuit si 7B+ disponible
- Niveau 3 (Cloud) : Evaluation par Claude/GPT-4 — payant, futur (Phase 37+)

Par defaut, `maestro adapt` utilise le Niveau 1. Si un modele 7B+ est disponible, Niveau 2.

---

## 35-B : `maestro optimize`

```bash
$ maestro optimize project-preparer --strategy model-downgrade

Optimizing project-preparer (current: claude-sonnet, fitness: 0.95)...
Strategy: model-downgrade

Testing claude-haiku... fitness 0.92 (delta: -0.03) ✓
Testing qwen-2.5-coder... fitness 0.65 (delta: -0.30) ✗
Testing smollm2-1.7b... fitness 0.40 (delta: -0.55) ✗

Best: claude-haiku (fitness 0.92, cost reduction 60%)
Publish optimized block? [Y/n]
```

**Strategies (elles-memes des blocs)** :
- `model-downgrade` : Tester des modeles moins chers
- `prompt-refinement` : Reecrire le prompt pour un modele plus petit
- `temperature-tuning` : Ajuster la temperature pour meilleur fitness
- Plus tard : `few-shot-injection`, `context-compression`, etc.

**Mode recursif** :
```bash
$ maestro optimize autonomous-development --recursive
# Optimise chaque sous-bloc bottom-up, puis le workflow global
```

---

## Principe architectural

- `adapt` et `optimize` sont des WORKFLOWS, pas de l'infrastructure
- Les strategies sont des BLOCS (pas du code C#)
- Les evaluateurs sont des BLOCS (pas du code C#)
- Ajouter une nouvelle strategie = creer un .block.json, zero changement C#

---

## Criteres de completion

- [ ] `maestro adapt <workflow>` produit un tier personnalise
- [ ] `maestro optimize <block>` teste au moins 2 strategies
- [ ] L'evaluateur heuristique (Niveau 1) fonctionne sans LLM
- [ ] Les strategies sont des blocs, pas du code hardcode
