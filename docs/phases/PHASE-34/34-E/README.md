# Phase 34-E : Integration + QualityScore Tier 1 + Comparaison vs Claude Code

**Statut** : A faire
**Prerequis** : Phase 34-C COMPLETE (agents + workflow v4), Phase 34-D COMPLETE (interaction handler)
**Objectif** : Tester l'agent v4 de bout en bout sur des projets reels, mesurer le QualityScore de chaque bloc, etablir le QualityBaseline, et demontrer que l'agent depasse considerablement Claude Code brut sur la qualite.

> **ADR** : Cette sous-phase applique `ADR-QUALITY-FIRST-DEGRADATION.md`. Le Tier 1 est evalue sur QualityScore (qualite pure), pas sur Fitness (rapport qualite/prix). Le cout est irrelevant pour le Tier 1.

---

## Vision

L'agent v4 doit etre teste sur **au moins 5 taches de complexite variee** et compare objectivement a Claude Code utilise directement. La comparaison porte uniquement sur la **qualite du resultat**, pas sur le cout ou la duree.

### Tests prevus

| # | Tache | Complexite | Ce qu'on mesure |
|---|-------|-----------|----------------|
| 1 | CRUD Module (React + Express) | Faible | Qualite du code, du design, des tests |
| 2 | Authentication Flow (JWT, formulaires) | Moyenne | Coordination backend/frontend, securite |
| 3 | Data Visualization Dashboard (charts, animations) | Moyenne-Elevee | Qualite visuelle, animations, responsiveness |
| 4 | File Explorer Component (tree, drag-drop) | Elevee | Complexite algorithmique, accessibilite, UX |
| 5 | Full-Stack Notifications (WebSocket, animations) | Elevee | Autonomie complete, architecture, qualite globale |

Details complets : `spec/14-test-plan.md`

### Comparaison Claude Code — criteres de qualite uniquement

Pour chaque tache, on compare sur **5 criteres de qualite** (pas de duree, pas de cout) :

| Critere | Poids | Description |
|---------|-------|-------------|
| **Completion** | 30% | La tache est-elle completement realisee ? |
| **Code Quality** | 25% | Score du code-reviewer v4 |
| **Tests** | 15% | Tests ecrits et passants |
| **Visual Quality** | 15% | Score du ui-reviewer v4 (screenshots) |
| **Security** | 15% | Score du security-reviewer v4 |

> Duration et Cost sont mesures a titre informatif mais ne sont PAS des criteres de victoire pour le Tier 1.

### Critere de succes

> **L'agent v4 doit depasser Claude Code brut sur au moins 4 des 5 criteres de qualite**, pour au moins **4 des 5 taches**, avec une qualite visiblement superieure sur le frontend/styling.

### QualityScore Tier 1 — Manifeste

Mesurer le QualityScore (P x W) de chaque bloc selon les protocoles de `spec/11-fitness-criteria.md` :

```
QualityScore = P x W
```

Publier le manifeste Tier 1 avec :
- QualityScore par bloc (P et W mesures individuellement)
- QualityScore_global (moyenne ponderee par phase)
- QualityBaseline = QualityScore_global (reference pour les Tiers 2+)
- Scores de comparaison vs Claude Code par tache et par critere de qualite
- Metriques secondaires : Duration, Cost, Token usage (informatives)

### QualityBaseline

```
QualityBaseline = QualityScore_global du Tier 1
```

C'est la reference absolue de qualite. Les Tiers 2+ ne peuvent pas descendre en dessous de `QualityBaseline x 0.98` sans passer par une descente de plancher explicite (Phase B dans le processus en escalier — voir `34-F/README.md`).

### Effort estime : 3-5 jours

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi le lire |
|---------|-----------------|
| `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` | L'ADR qui definit QualityScore vs Fitness, les protocoles de mesure, et le processus en escalier |
| `docs/phases/PHASE-34/34-A/spec/11-fitness-criteria.md` | Protocoles de mesure de P et W par type de bloc, seuils, QualityScore_global |
| `docs/phases/PHASE-34/34-A/spec/14-test-plan.md` | Les 5 taches de test, criteres d'evaluation, protocole de comparaison |
| `docs/phases/PHASE-34/checkpoint.md` | Etat des sous-phases precedentes |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Preparer les repos de test
- Creer les 5 repos de test (CRUD, Auth, Dashboard, Explorer, Notifications)
- Verifier que chaque repo compile et a les deps installees
- Git init avec commit initial

### Etape 2 : Mesurer le QualityScore de chaque bloc individuellement
Pour chaque bloc specialiste :
1. Executer le protocole de mesure de P specifique au type de bloc (voir `spec/11-fitness-criteria.md`)
2. Mesurer W sur les memes executions
3. Calculer QualityScore = P x W
4. Verifier que le seuil est atteint
5. Si le seuil n'est PAS atteint : iterer le prompt, changer l'approche, retester

### Etape 3 : Executer les 5 taches avec Maestro Agent v4
- Executer chaque tache de bout en bout
- Collecter les metriques : Completion, CodeQuality, Tests, VisualQuality, Security
- Mesurer Duration et Cost comme metriques secondaires

### Etape 4 : Executer les 5 taches avec Claude Code brut
- Meme tache, meme modele, meme repo de depart
- Appliquer les memes reviewers v4 au resultat

### Etape 5 : Comparer et calculer QualityScore_global
- Remplir le tableau de comparaison (voir `spec/14-test-plan.md`)
- Calculer QualityScore_global = moyenne ponderee par phase
- Etablir le QualityBaseline

### Etape 6 : Publier le manifeste Tier 1
- Generer le manifeste JSON avec QualityScore par bloc, QualityBaseline, comparaison
- Sauvegarder dans `content/system/manifests/tier-1.manifest.json`

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `test-repos/crud/` | CREER — Repo de test CRUD |
| `test-repos/auth/` | CREER — Repo de test Auth |
| `test-repos/dashboard/` | CREER — Repo de test Dashboard |
| `test-repos/explorer/` | CREER — Repo de test Explorer |
| `test-repos/notifications/` | CREER — Repo de test Notifications |
| `content/system/manifests/tier-1.manifest.json` | CREER — Manifeste Tier 1 |
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Mettre a jour le checkpoint |

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS declarer "depasse Claude Code" sans metriques objectives — les scores doivent etre comparables sur les 5 criteres de qualite
- Ne PAS tester uniquement sur des taches triviales — au moins 2 taches de complexite haute
- Ne PAS ignorer les echecs — si l'agent v4 echoue sur une tache, documenter pourquoi et corriger
- Ne PAS utiliser Duration ou Cost comme criteres de victoire pour le Tier 1 — seule la qualite compte
- Ne PAS confondre QualityScore et Fitness — QualityScore = P x W (pas de cout), Fitness = QualityScore / Cost (pour Tiers 2+ uniquement)
- Ne PAS publier un manifeste avec des scores inventes — chaque score doit venir d'une mesure reelle

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 34-E : Integration + QualityScore Tier 1
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Repos de test prepares** : X / 5
**QualityScore par bloc** :
  | Bloc | P | W | QualityScore | Seuil | OK? |
  |------|---|---|-------------|-------|-----|
  | ... | | | | | |
**QualityScore_global** : [score]
**QualityBaseline** : [score]
**Taches testees** : X / 5
**Comparaison Claude Code** : agent v4 gagne X / 5 (sur criteres de qualite)
  | Tache | Completion | CodeQuality | Tests | Visual | Security | Gagnant |
  |-------|-----------|-------------|-------|--------|----------|---------|
  | ... | | | | | | |
**Metriques secondaires** : Duration = [X], Cost = [$X], Tokens = [X]
**Manifeste Tier 1 publie** : OUI / NON — chemin: [...]
**Problemes** : [si BLOQUE]
```
