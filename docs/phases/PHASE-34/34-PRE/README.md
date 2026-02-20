# Phase 34-PRE : Formalisation de QualityScore — Metrique de qualite prerequise

**Statut** : A faire
**Prerequis** : Phase 34-A COMPLETE (AGENT-V4-SPEC.md valide)
**Objectif** : Analyser le projet actuel, formaliser QualityScore comme metrique principale du Tier 1, et aligner tous les documents de spec et sous-phases avec l'ADR Quality-First Degradation.

---

## Contexte

L'ADR `ADR-QUALITY-FIRST-DEGRADATION.md` identifie un probleme fondamental : la formule Fitness V2 melange qualite et cout dans un seul score. Pour le Tier 1 (Claude Code Max, cout irrelevant), seule la qualite compte. L'ADR decide de separer en deux metriques :

1. **QualityScore = P x W** — metrique pure de qualite (S = 1.0 par design)
2. **Fitness = QualityScore / Cost^lambda** — rapport qualite/prix pour les Tiers 2+

Cette sous-phase formalise QualityScore comme concept de premier ordre dans le projet, met a jour les specs, et prepare le terrain pour les mesures de 34-E.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque etape
3. **Ecrire dans `PHASE-34/34-PRE/checkpoint.md`** apres completion
4. **Ne PAS ecrire de code C# ou TypeScript** — cette phase est design/documentation uniquement
5. **Ne PAS modifier les system prompts des blocs** — seuls les documents de metrique et les READMEs de sous-phases changent

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi le lire |
|---------|-----------------|
| `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` | L'ADR qui motive cette sous-phase — contient les formules, protocoles, et decisions |
| `docs/phases/PHASE-34/34-A/spec/11-fitness-criteria.md` | Les criteres de fitness actuels — a mettre a jour |
| `docs/phases/PHASE-34/34-A/spec/14-test-plan.md` | Le plan de tests actuel — a mettre a jour |
| `docs/phases/PHASE-34/34-E/README.md` | Sous-phase integration — doit utiliser QualityScore, pas Fitness |
| `docs/phases/PHASE-34/34-F/README.md` | Sous-phase degradation — doit utiliser le processus en escalier |
| `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` | La philosophie V2 — verifier que QualityScore est coherent avec la vision |
| `docs/phases/PHASE-34/AGENT-V4-SPEC.md` | L'index du spec — verifier les references croisees |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Auditer les references aux metriques dans le projet

Identifier tous les fichiers qui referencent la formule Fitness V2 ou les metriques P, S, W, C :
- `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md`
- `docs/phases/PHASE-34/34-A/spec/11-fitness-criteria.md`
- `docs/phases/PHASE-34/34-A/spec/14-test-plan.md`
- `docs/phases/PHASE-34/34-A/spec/01-architecture-overview.md`
- `docs/phases/PHASE-34/34-E/README.md`
- `docs/phases/PHASE-34/34-F/README.md`
- `docs/phases/PHASE-34/AGENT-REQUEST.md` (section 6)
- `docs/phases/PHASE-34/README.md`

Pour chaque fichier, noter :
- Les sections qui referencent `Fitness` ou `ModelFitness`
- Les endroits ou `Cost` / `C_norm` / `C_compute` / `C_hw` sont inclus dans des metriques Tier 1
- Les incohérences avec l'ADR

### Etape 2 : Mettre a jour `spec/11-fitness-criteria.md`

Reecriture majeure selon l'ADR :

| Section | Changement |
|---------|------------|
| Formule principale | Ajouter QualityScore = P x W comme metrique Tier 1. Fitness reste pour Tiers 2+ uniquement |
| QualityScore global | Remplacer `WorkflowFitness = TaskCompletion x CodeQuality x UserSatisfaction / NormalizedCost` par `QualityScore_global = moyenne ponderee des QualityScore par bloc` |
| Mesure de P par type de bloc | Ajouter les protocoles detailles de l'ADR : P_implementation, P_review, P_planning, P_analysis, P_visual, P_interaction, P_utility |
| Mesure de W | Ajouter les seuils W par criticite (de l'ADR) |
| Mesure de S | Formaliser S = 1.0 par design, simplifier QualityScore a P x W |
| Degradation progressive | Remplacer le processus simple "5% drop" par le processus en escalier de l'ADR (Phase A + plateau + Phase B) |
| Ordre de substitution | Mettre a jour avec les 7 niveaux de priorite de l'ADR |

### Etape 3 : Mettre a jour `spec/14-test-plan.md`

| Section | Changement |
|---------|------------|
| Criteres d'evaluation | Retirer "Duration" (10%) du Tier 1. Redistribuer : Completion 30%, Code Quality 25%, Tests 15%, Visual Quality 15%, Security 15% |
| Seuil de victoire | Reformuler : Tier 1 gagne sur la **qualite** (4/5 criteres qualite), pas sur le cout ou la duree |
| Metriques secondaires | Garder Duration et Cost comme metriques secondaires (informatives, pas decisionnelles pour Tier 1) |

### Etape 4 : Mettre a jour `34-E/README.md`

| Section | Changement |
|---------|------------|
| Fitness Tier 1 | Remplacer par QualityScore Tier 1 — mesurer QualityScore par bloc et global, pas Fitness |
| Formule dans la vision | Remplacer la formule Fitness V2 par QualityScore = P x W |
| Manifeste | Le manifeste Tier 1 contient QualityScore par bloc, QualityBaseline global, pas de Fitness (cout non pertinent) |
| Comparaison Claude Code | Comparer sur la qualite uniquement (pas sur le cout ou la duree) |
| Checkpoint | Mettre a jour pour refleter QualityScore au lieu de Fitness |

### Etape 5 : Mettre a jour `34-F/README.md`

| Section | Changement |
|---------|------------|
| Processus de degradation | Remplacer par le processus en escalier : Phase A (optimiser cout sous QualityFloor) → plateau → Phase B (baisser QualityFloor de 5%) → repeter |
| QualityFloor | Introduire le concept : QualityFloor = QualityBaseline x 0.98 pour le premier palier |
| Manifeste par tier | Mettre a jour le format pour inclure QualityScore, QualityFloor, costReduction, substitutionsTested |
| Seuil minimal | QualityFloor < 0.70 → STOP (pas fitness < 0.50) |
| Ordre de substitution | Aligner avec les 7 niveaux de priorite de l'ADR |
| Checkpoint | Mettre a jour pour refleter QualityScore et QualityFloor |

### Etape 6 : Mettre a jour `Phase 34 README.md`

- Ajouter 34-PRE dans le tableau des sous-phases (entre 34-A et 34-B)
- Mettre a jour le graphe de dependances
- Ajouter une reference a l'ADR dans le contexte

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/34-PRE/README.md` | CREER — CE document (plan de la sous-phase) |
| `docs/phases/PHASE-34/34-A/spec/11-fitness-criteria.md` | MODIFIER — Reecriture majeure : QualityScore, protocoles P/W, escalier |
| `docs/phases/PHASE-34/34-A/spec/14-test-plan.md` | MODIFIER — Retirer Duration du Tier 1, reformuler seuil de victoire |
| `docs/phases/PHASE-34/34-E/README.md` | MODIFIER — QualityScore au lieu de Fitness |
| `docs/phases/PHASE-34/34-F/README.md` | MODIFIER — Processus en escalier au lieu de simple 5% drop |
| `docs/phases/PHASE-34/README.md` | MODIFIER — Ajouter 34-PRE, mettre a jour dependances |
| `docs/phases/PHASE-34/34-PRE/checkpoint.md` | CREER — Checkpoint de progression |

**AUCUN fichier de code ne doit etre modifie dans cette sous-phase.** C'est un travail de DOCUMENTATION uniquement.

---

## Verification [OBLIGATOIRE]

```bash
# Verification 1 : spec/11-fitness-criteria.md contient QualityScore comme metrique principale
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\34-A\spec\11-fitness-criteria.md' -Pattern 'QualityScore'"
# Resultat attendu : Plusieurs matches — QualityScore est la metrique centrale

# Verification 2 : spec/11-fitness-criteria.md contient le processus en escalier
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\34-A\spec\11-fitness-criteria.md' -Pattern 'QualityFloor|escalier|Phase A|Phase B|plateau'"
# Resultat attendu : Matches pour le processus en escalier

# Verification 3 : spec/14-test-plan.md ne contient plus Duration comme critere Tier 1
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\34-A\spec\14-test-plan.md' -Pattern 'Duration.*10%'"
# Resultat attendu : Aucun match (Duration retiree du Tier 1)

# Verification 4 : 34-E utilise QualityScore, pas Fitness pour le Tier 1
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\34-E\README.md' -Pattern 'QualityScore'"
# Resultat attendu : Plusieurs matches

# Verification 5 : 34-F contient le processus en escalier
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\34-F\README.md' -Pattern 'QualityFloor|escalier|Phase A|Phase B'"
# Resultat attendu : Plusieurs matches

# Verification 6 : Phase 34 README contient 34-PRE
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\README.md' -Pattern '34-PRE'"
# Resultat attendu : Match dans le tableau et le graphe de dependances

# Verification 7 : Aucune reference a Fitness comme metrique Tier 1 dans 34-E
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\34-E\README.md' -Pattern 'ModelFitness.*Tier 1|Fitness Tier 1'"
# Resultat attendu : Aucun match (Tier 1 utilise QualityScore, pas Fitness)
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS inventer de nouvelles formules — utiliser exactement celles de l'ADR (QualityScore = P x W, Fitness = QualityScore / Cost^lambda)
- Ne PAS garder des references a `ModelFitness` pour le Tier 1 — le Tier 1 n'utilise QUE QualityScore
- Ne PAS supprimer la formule Fitness — elle reste pertinente pour les Tiers 2+ (rapport qualite/prix)
- Ne PAS modifier les system prompts des blocs — seuls les documents de metrique changent
- Ne PAS faire de changements de code (C#, TypeScript) — cette phase est documentation uniquement
- Ne PAS oublier de mettre a jour le graphe de dependances dans Phase 34 README

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 34-PRE : Formalisation de QualityScore
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers audites** : X / 8
**Fichiers mis a jour** :
  - spec/11-fitness-criteria.md : OUI / NON
  - spec/14-test-plan.md : OUI / NON
  - 34-E/README.md : OUI / NON
  - 34-F/README.md : OUI / NON
  - Phase 34 README.md : OUI / NON
**QualityScore formalise** : OUI / NON
**Processus en escalier documente** : OUI / NON
**Verification** : [copier les resultats des commandes]
**Problemes** : [si BLOQUE]
```
