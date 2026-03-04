# Phase 50 : Adapt Integration TUI + Fitness Engine Production

**Statut** : Planifie
**Prerequis** : Phase 49 COMPLETE (hardware-aware setup, capabilities model, metrics)
**Objectif** : L'utilisateur peut lancer `maestro adapt` depuis le TUI et le systeme teste automatiquement ses modeles locaux contre ses workflows pour proposer la meilleure configuration. Le fitness engine passe de "module CLI" a "feature integree utilisable".

---

## Contexte

### Ce qui existe deja (construit en Phase 39)

Le module `packages/maestro-cli/adapt-optimize.ts` contient l'infrastructure complete :

| Fonction | Description |
|----------|-------------|
| `extractManifest(blockId)` | Extrait tous les modeles requis d'un workflow (recursif sur config.nodes) |
| `detectModels(required, client)` | Matching fuzzy des modeles disponibles vs requis |
| `measureFitness(blockId, sandboxId)` | Mesure de fitness via sandbox + git worktrees |
| `withBlockVariant(blockId, mutations)` | Cree des variants temporaires pour tester des configs alternatives |
| `maestroAdapt(workflowId, sandboxId)` | Orchestration complete : manifest → detection → substitution → fitness → save |
| `maestroOptimize(blockId, sandboxId)` | Strategies : model-downgrade, temperature-tuning |

**Probleme** : Ce module n'est utilise que via CLI (`maestro adapt <workflow>`, `maestro optimize <block>`). Il n'est pas integre dans le TUI, et le fichier a `@ts-nocheck`.

### Ce que Phase 49 ajoute

- **Capabilities model** : chaque block declare ses capacites et requirements
- **Hardware detection** : on sait ce que la machine peut faire
- **Tests de capacite** : on peut verifier si un modele supporte tool-calling, structured-output, etc.
- **Resultats stockes** : `.maestro/capabilities/<block-id>/<model-id>.json`

### La formule de fitness (de MAESTRO-PHILOSOPHY-V2.md)

```
                P x S x W
ModelFitness = ─────────────────────────
               (C_norm x C_compute x C_hw)^λ
```

| Dimension | Description |
|-----------|-------------|
| P | Performance — succes reel sur la tache ciblee |
| S | Specialisation — P / entropie de la tache |
| W | Composabilite — 1 - taux hallucination |
| C_norm | Cout economique normalise |
| C_compute | Taille cognitive (log(params) x FLOPs/token) |
| C_hw | Friction hardware (α·VRAM + β·RAM + γ·GPU) |
| λ | Facteur de penalisation non-lineaire (recommande : 1.5) |

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 50-A | Adapt dans le TUI | 2-3 jours |
| 50-B | Fitness multi-dimensionnel | 2-3 jours |
| 50-C | Auto-adapt post-setup | 1-2 jours |

---

## 50-A : Adapt dans le TUI

### But
L'utilisateur peut lancer un adapt depuis la page Models ou via `/adapt` dans le chat.

### Taches

1. **Commande `/adapt`** dans TaskInputBar :
   - `/adapt` → adapte le workflow maestro-assistant au hardware actuel
   - `/adapt <workflow-id>` → adapte un workflow specifique
   - Affiche le resultat dans le ConversationLog

2. **Bouton [A] Adapt** dans ModelsScreen :
   - Lance `maestroAdapt` sur le workflow actif
   - Affiche les resultats en temps reel : "Testing deepseek-coder-1.3b... fitness: 0.72"
   - Propose de sauvegarder la config adaptee

3. **Fix `@ts-nocheck`** dans adapt-optimize.ts :
   - Ajouter les types manquants
   - Ce refactoring est JUSTIFIE car il bloque l'integration dans un module type-safe

4. **Sauvegarder le resultat d'adapt** dans `.maestro/adapted/` :
   - Format : `<workflow-id>-adapted.block.json`
   - L'utilisateur peut revenir a la version originale

### Verification
```bash
# Lancer maestro code, taper /adapt, verifier que le workflow est teste et adapte
# Verifier que .maestro/adapted/ contient le resultat
```

---

## 50-B : Fitness multi-dimensionnel

### But
Remplacer le fitness binaire (pass/fail) par la formule multi-dimensionnelle de PHILOSOPHY-V2.

### Taches

1. **Implementer la formule de fitness** comme un block (content, pas infra) :
   - Input : resultats de test, profil modele, profil hardware
   - Output : score 0-1, decomposition par dimension, rank (S/A/B/C/D/F)

2. **Cascade d'evaluateurs** :
   - Niveau 1 (Heuristique) : JSON valide, champs requis, efficacite tokens — gratuit, toujours execute
   - Niveau 2 (LLM-as-Judge local) : un modele local 7B+ evalue la sortie — gratuit si GPU
   - Niveau 3 (LLM-as-Judge cloud) : modele cloud — payant, definitif

3. **Integrer avec les capabilities de Phase 49** :
   - Le score de fitness inclut les capacites testees
   - Un modele qui ne supporte pas tool-calling a un fitness reduit pour les agents qui en ont besoin

### Verification
```bash
# maestro fitness <block-id> --sandbox <id>
# Affiche : fitness score, decomposition, rank
```

---

## 50-C : Auto-adapt post-setup

### But
Apres le first-run (Phase 49-A), proposer automatiquement d'adapter le maestro-assistant au hardware.

### Taches

1. **Apres le setup, proposer** :
   ```
   Would you like Maestro to optimize the assistant for your hardware?
   This will test your local model and adjust settings automatically.
   [Y] Yes, optimize  [N] No, use defaults
   ```

2. **Si oui** : lancer `maestroAdapt` en background, afficher le resultat, sauvegarder

3. **Si le fitness est trop bas** (< 0.5) : recommander un modele plus gros ou un provider cloud

---

## Definition of Done

- [ ] `/adapt` fonctionne dans le TUI
- [ ] `[A] Adapt` fonctionne dans la page Models
- [ ] adapt-optimize.ts n'a plus `@ts-nocheck`
- [ ] Fitness multi-dimensionnel implemente (formule PHILOSOPHY-V2)
- [ ] Cascade d'evaluateurs (heuristique + LLM-as-Judge local)
- [ ] Auto-adapt propose apres le first-run
- [ ] Resultats sauvegardes dans `.maestro/adapted/`

### NOT in scope
- LLM-as-Judge cloud (Phase 51)
- Agent Creator (Phase 51)
- Catalogue communautaire (Phase 52)
- Self-improvement loop (Phase 53+)
