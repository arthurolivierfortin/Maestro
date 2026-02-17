# Issue 33-A-1 : Commande `maestro adapt`

**Statut** : A faire — plan detaille a creer apres Phase 32
**Estimation** : 1-2 sessions
**Prerequis** : Phase 32 complete (tiers + manifestes + check)

---

## Description

`maestro adapt` teste automatiquement des modeles locaux comme substituts pour les blocs d'un workflow, en utilisant les donnees du manifeste.

---

## Concept

```bash
maestro adapt autonomous-dev
```

La commande :
1. Lit le manifeste du workflow
2. Pour chaque bloc, identifie les modeles alternatifs disponibles localement
3. Execute les scenarios de test du manifeste avec chaque modele alternatif
4. Mesure le fitness
5. Produit un rapport de compatibilite
6. Propose un nouveau tier optimise

### Flow

```
Manifeste du workflow
  → Lister les blocs et modeles requis
  → Pour chaque bloc :
    → Lister les modeles locaux disponibles
    → Pour chaque modele local :
      → Executer les scenarios de test
      → Mesurer le fitness
    → Classer les substituts par fitness
  → Assembler le meilleur tier local possible
  → Publier comme nouveau tier (si fitness >= seuil)
```

### Sortie

```
  Maestro Adapt — autonomous-dev

  Block: prepare (currently: claude-opus, fitness: 0.90)
    claude-sonnet     → fitness 0.85 (viable ✓)
    claude-haiku      → fitness 0.70 (below threshold ✗)
    qwen2.5-coder     → fitness 0.55 (below threshold ✗)

  Block: commit (currently: claude-sonnet, fitness: 0.95)
    claude-haiku      → fitness 0.90 (viable ✓)
    qwen2.5-coder     → fitness 0.82 (viable ✓)

  ...

  Proposed new tier:
    prepare: claude-sonnet (0.85) | plan: claude-opus (0.95) | ...
    Estimated composite fitness: 0.83

  Publish as Tier 2? [y/n]
```

---

## Critere de completion

- [ ] La commande execute les scenarios de test pour chaque substitut
- [ ] Le fitness est mesure pour chaque combinaison
- [ ] Un nouveau tier est propose avec le fitness estime
- [ ] L'utilisateur peut accepter et publier le nouveau tier
- [ ] Les resultats sont ajoutes au manifeste (testedSubstitutes)

---

## Dependances

- Le manifeste (32-B-1) doit contenir les scenarios de test
- `maestro check` (32-B-2) pour detecter les modeles disponibles
- La foundry doit pouvoir mesurer le fitness automatiquement
