# Issue 33-C-1 : Commande `maestro optimize`

**Statut** : A faire — plan detaille a creer apres Phase 32
**Estimation** : 2-3 sessions
**Prerequis** : 33-A (maestro adapt), 33-B (agent creator)

---

## Description

`maestro optimize` est un meta-workflow qui optimise un workflow existant automatiquement : substitution de modeles, ajustement de prompts, reorganisation des blocs.

---

## Concept

```bash
maestro optimize autonomous-dev --target-fitness 0.80 --maximize cost-reduction
```

La commande :
1. Lit le manifeste du workflow actuel
2. Identifie les blocs ou l'optimisation est possible
3. Pour chaque bloc optimisable :
   - Teste des modeles plus petits (via `adapt`)
   - Teste des variations de prompts (via foundry)
   - Mesure le fitness apres chaque changement
4. Assemble le meilleur workflow optimise
5. Publie comme nouveau tier

### Strategies d'optimisation

Les strategies sont ELLES-MEMES des blocs (meta-recursion) :

| Strategie | Description | Quand l'utiliser |
|-----------|-------------|-----------------|
| model-downgrade | Remplacer un modele par un plus petit | Quand le fitness reste >= seuil |
| prompt-refinement | Ajuster le system prompt pour un modele plus petit | Quand le model-downgrade degrade le fitness |
| context-reduction | Reduire le contexte passe a un bloc | Quand le contexte est trop large |
| bloc-fusion | Fusionner deux blocs qui font des taches similaires | Quand la decomposition est trop fine |
| bloc-split | Separer un bloc trop complexe en deux | Quand un bloc echoue frequemment |

### Flow

```
maestro optimize <workflow>
  → Lire le manifeste
  → Pour chaque strategie applicable :
    → Appliquer la strategie
    → Mesurer le fitness
    → Si fitness >= target → conserver
    → Sinon → revert
  → Assembler le workflow optimise
  → Publier
```

---

## Architecture recursive

```
maestro optimize = meta-workflow
│
├── analyze-workflow (inference)
│   → Identifier les opportunites d'optimisation
│
├── for-each opportunite :
│   ├── apply-strategy (agent)
│   │   → Modifier le bloc/prompt/modele
│   │
│   └── measure-fitness (agent)
│       → Tester et mesurer
│
├── select-best-combination (inference)
│   → Choisir la meilleure combinaison de changements
│
└── publish-optimized (agent)
    → Publier le workflow optimise
```

Les strategies sont des blocs — on peut en ajouter de nouvelles sans modifier le meta-workflow.

---

## Niveaux d'evaluation

| Niveau | Cout | Precision | Quand |
|--------|------|-----------|-------|
| Heuristique | Gratuit | ~70% | Toujours (premiere passe) |
| LLM local | Minimal | ~85% | Si modele local capable disponible |
| LLM cloud | Cher | ~95% | Sur demande explicite |

L'evaluateur heuristique verifie :
- Le JSON est valide
- Les champs requis sont presents
- Les types sont corrects
- Les patterns connus sont suivis

L'evaluateur LLM evalue :
- La qualite du contenu
- La coherence avec les conventions
- L'adequation a la tache

---

## Critere de completion

- [ ] `maestro optimize` produit un workflow optimise
- [ ] Le fitness du workflow optimise >= target
- [ ] Les strategies sont des blocs (extensibles)
- [ ] Les 3 niveaux d'evaluation fonctionnent
- [ ] Le workflow optimise est publie avec un manifeste a jour
- [ ] Le cout est reduit par rapport au tier original

---

## Note

Cette issue est la plus ambitieuse de toute la roadmap. Elle necessite que TOUT le reste fonctionne :
- Les foundry sessions pour mesurer le fitness
- Le manifeste pour stocker les donnees
- `maestro adapt` pour tester les substituts
- L'Agent Creator pour creer de nouveaux blocs si necessaire
- `maestro check` pour verifier la compatibilite

C'est le dernier etage de la pyramide. Ne pas commencer avant que les fondations soient solides.
