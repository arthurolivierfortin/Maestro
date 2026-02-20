# ADR : Qualite d'abord, Fitness ensuite — Strategie de degradation en escalier

**Date** : 2026-02-19
**Statut** : Accepte
**Contexte** : Phase 34 — Agent Maestro v4
**Auteurs** : Createur + Claude Opus 4.6

---

## Probleme

La formule fitness V2 de Philosophy V2 est :

```
ModelFitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ
```

Cette formule melange qualite (P, S, W) et cout (C) dans un seul score. Elle est concue pour comparer des modeles entre eux en tenant compte du rapport qualite/prix.

**Mais pour le Tier 1, le prix n'a aucune importance.** Le createur a Claude Code Max — Opus et Sonnet sont disponibles sans contrainte de cout. Le seul objectif du Tier 1 est d'etre **exceptionnellement meilleur que Claude Code brut**. Penaliser un bloc parce qu'il utilise Opus (cher) au lieu de Haiku (pas cher) irait a l'encontre de cet objectif.

Pour les tiers suivants, le probleme est different : on veut **garder la meme qualite** tout en reduisant le cout. Si on ne peut plus reduire le cout sans baisser la qualite, alors — et seulement alors — on accepte une baisse de qualite de ~5%, et on recommence l'optimisation du cout.

La formule fitness actuelle ne capture pas ce processus en escalier.

---

## Decision

### Deux metriques distinctes

Nous separons l'evaluation en deux metriques independantes :

#### 1. QualityScore — mesure pure de la qualite

```
QualityScore = P × S × W
```

- **P** (Performance) : qualite de la sortie mesuree par des tests objectifs
- **S** (Specialisation) : P / entropie des taches (fixe a 1.0 pour les blocs mono-tache par design)
- **W** (Composabilite) : 1 - taux d'hallucination, respect du format de sortie

Pas de dimension de cout. C'est la seule metrique pour le Tier 1.

#### 2. Fitness — rapport qualite/prix

```
Fitness = QualityScore / (C_norm × C_compute × C_hw)^λ
```

Utilise a partir du Tier 2 pour optimiser le cout **sous contrainte de qualite**.

### Processus de degradation en escalier

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1 : Maximiser QualityScore. Cout = irrelevant.        │
│          Resultat = QualityBaseline (ex: 0.88)              │
│          C'est notre reference absolue de qualite.          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE A : Optimiser le cout, qualite = meme plancher.       │
│           QualityFloor = QualityBaseline × 0.98             │
│           Pour chaque bloc (ordre : moins critique d'abord) │
│             Tester modele moins cher                        │
│             Si QualityScore bloc >= QualityFloor → accepter │
│             Sinon → garder le modele cher                   │
│           Resultat : TIER 2 (meme qualite, cout reduit)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    Plateau atteint ?
                  (plus de substitution possible
                   sans casser le QualityFloor)
                               │
                     ┌─────────┴─────────┐
                     │ Non               │ Oui
                     │ Continuer         │
                     │ Phase A           ▼
                     │         ┌──────────────────────┐
                     │         │ PHASE B : Descendre   │
                     │         │ QualityFloor de 5%    │
                     │         │ Nouveau plancher =    │
                     │         │ QualityFloor × 0.95   │
                     │         └──────────┬───────────┘
                     │                    │
                     │                    ▼
                     │          Retour a Phase A avec
                     │          le nouveau plancher
                     │                    │
                     └────────────────────┘
                               │
                               ▼
                    QualityFloor < 0.70 ?
                               │
                     ┌─────────┴─────────┐
                     │ Non               │ Oui
                     │ Continuer         │ STOP
                     └───────────────────┘
```

---

## Comment on evalue la qualite — precision par bloc

### Mesure de P (Performance) par type de bloc

P est la dimension la plus critique. Voici comment elle est mesuree concretement selon le **role** du bloc :

#### Blocs d'implementation (backend-developer, frontend-developer, styling-developer)

P est mesure par **l'execution reelle du code produit** :

```
P_implementation = (w1 × CompilationRate) + (w2 × TestPassRate) + (w3 × AcceptanceCriteria)

ou :
  CompilationRate    = nb steps qui compilent / nb steps total        [0-1]
  TestPassRate       = nb tests passes / nb tests ecrits              [0-1]
  AcceptanceCriteria = nb steps dont l'acceptance est verifiee / total [0-1]
  w1 = 0.30, w2 = 0.40, w3 = 0.30
```

**Protocole** : executer le bloc sur 10 steps varies (create, modify, de complexite variee). Pour chaque step :
1. Le bloc implemente le step
2. `compilation-checker` verifie que ca compile → CompilationRate
3. `test-runner` execute les tests → TestPassRate
4. Un evaluateur verifie les acceptance criteria → AcceptanceCriteria

**Pourquoi ces poids** : les tests sont le critere le plus fort (40%) parce qu'un code qui compile mais ne passe pas les tests n'a pas de valeur. Les acceptance criteria (30%) verifient que le code fait ce qui est demande. La compilation (30%) est un prerequis binaire.

#### Blocs de review (code-reviewer, security-reviewer, architecture-reviewer)

P est mesure par **la correlation avec le jugement humain** :

```
P_review = Correlation(scores_bloc, scores_humain) sur N evaluations

ou :
  scores_bloc   = scores donnes par le bloc sur N revues de code
  scores_humain = scores donnes par un humain sur les memes N revues
  Correlation   = coefficient de Pearson [0-1]
```

**Protocole** : preparer 20 revues de code (10 bonne qualite, 10 mauvaise qualite). Un humain evalue chaque revue (score 0-1). Le bloc evalue les memes revues. Calculer la correlation.

**Anti-leniency** : si le bloc donne systematiquement > 0.85 a tout (meme au mauvais code), la correlation sera faible → P faible.

#### Blocs de planification (task-planner, task-architect)

P est mesure par **l'executabilite du plan produit** :

```
P_planning = nb_steps_implementes_avec_succes / nb_steps_du_plan

ou :
  Un step est "implemente avec succes" si un developer-agent arrive
  a l'implementer sans erreur en utilisant seulement les infos du step.
```

**Protocole** : donner 10 taches au planner. Pour chaque plan produit, demander a un developer-agent de l'executer step par step. Compter les steps reussis.

**Pourquoi cette mesure** : un plan est bon si chaque step est assez precis pour etre implemente. Un step vague ("implement the feature") echouera → P baisse.

#### Blocs d'analyse (project-analyzer, research-agent)

P est mesure par **la precision factuelle** :

```
P_analysis = nb_champs_corrects / nb_champs_total

ou :
  Pour chaque champ de l'output (stack.language, conventions.naming, etc.)
  Verifier si la valeur est correcte (comparaison avec la verite terrain)
```

**Protocole** : preparer 10 repos dont on connait exactement la stack, les conventions, l'architecture. Executer le bloc. Comparer chaque champ avec la verite.

#### Blocs de verification visuelle (ui-reviewer, accessibility-checker)

P est mesure par **la concordance avec les outils automatises** :

```
P_visual = (TP + TN) / (TP + TN + FP + FN)

ou :
  TP = vrais positifs (probleme detecte par le bloc ET par l'outil/humain)
  TN = vrais negatifs (pas de probleme, ni bloc ni outil)
  FP = faux positifs (le bloc voit un probleme qui n'existe pas)
  FN = faux negatifs (le bloc rate un probleme reel)
```

**Protocole pour ui-reviewer** : 20 screenshots (10 avec problemes visuels, 10 corrects). Un humain identifie les problemes. Le bloc identifie les problemes. Comparer.

**Protocole pour accessibility-checker** : 20 pages analysees en parallele par le bloc et par `axe-core` (outil automatise WCAG). Comparer les violations detectees.

#### Blocs d'interaction (classify-intent, decide-action)

P est mesure par **l'accuracy de classification/decision** :

```
P_interaction = nb_reponses_correctes / nb_scenarios_total
```

**Protocole pour classify-intent** : 50 messages de test avec l'intent attendu pre-etiquete. 10 par categorie (question, feedback, change-request, override, acknowledgment). Compter les classifications correctes.

**Protocole pour decide-action** : 30 scenarios avec l'action attendue. Inclure des cas limites (feedback ambigu, override sans confirmation, etc.).

#### Blocs utilitaires (step-validator, compilation-checker, git-committer, test-runner)

P est mesure par **le taux de succes binaire** :

```
P_utility = nb_executions_correctes / nb_executions_total
```

Pas de nuance — ca marche ou ca marche pas.

---

### Mesure de W (Composabilite)

W est plus simple que P. Il mesure si le bloc **respecte son contrat de sortie** :

```
W = 1 - HallucinationRate

ou :
  HallucinationRate = (nb_outputs_invalides + nb_inventions) / nb_executions_total

  Output invalide = JSON mal forme, champs manquants, types incorrects
  Invention = URL fabriquee, import inexistant, file path invente, nombre invente
```

**Protocole** : sur les memes N executions utilisees pour mesurer P, verifier chaque output :
1. Est-ce du JSON valide ? (si le bloc doit produire du JSON)
2. Tous les champs requis sont-ils presents ?
3. Les valeurs sont-elles des observations reelles (pas des inventions) ?

**Seuils W par criticite** :
- Blocs d'interaction (classify-intent, decide-action) : W >= 1.0 (zero hallucination tolerable)
- Blocs de review : W >= 0.95
- Blocs d'implementation : W >= 0.90
- Blocs utilitaires : W >= 0.95

---

### Mesure de S (Specialisation)

S est **fixe par design** pour les blocs v4. Chaque bloc est mono-tache, donc :

```
S = P / H(taches)

ou H(taches) = entropie de Shannon des types de taches

Puisque chaque bloc ne fait qu'un type de tache :
  H(taches) = 0 → S = P / epsilon ≈ 1.0
```

En pratique, on fixe **S = 1.0** pour tous les blocs v4 car ils sont tous specialises par conception. S devient pertinent uniquement si un bloc est reutilise pour des taches differentes (ce qu'on ne fait pas en v4).

Cela simplifie QualityScore a :

```
QualityScore = P × 1.0 × W = P × W
```

---

## Application au Tier 1

### Etape 1 : Mesurer le QualityScore de chaque bloc

Pour chaque bloc, executer le protocole de mesure de P et W decrit ci-dessus.

```
Bloc                   | Modele    | P     | W     | QualityScore
-----------------------|-----------|-------|-------|-------------
project-analyzer       | Sonnet    | 0.87  | 0.96  | 0.835
task-architect         | Opus      | 0.90  | 0.93  | 0.837
research-agent         | Sonnet    | 0.82  | 0.97  | 0.795
task-planner           | Sonnet    | 0.88  | 0.96  | 0.845
plan-validator         | Sonnet    | 0.92  | 1.00  | 0.920
backend-developer      | Sonnet    | 0.86  | 0.92  | 0.791
frontend-developer     | Sonnet    | 0.85  | 0.91  | 0.774
styling-developer      | Sonnet    | 0.82  | 0.93  | 0.763
step-validator         | Haiku     | 0.96  | 0.99  | 0.950
compilation-checker    | Haiku     | 0.91  | 0.96  | 0.874
test-writer            | Sonnet    | 0.86  | 0.92  | 0.791
test-runner            | Sonnet    | 0.92  | 0.97  | 0.892
e2e-tester             | Sonnet    | 0.81  | 0.91  | 0.737
ui-reviewer            | Opus      | 0.83  | 0.96  | 0.797
accessibility-checker  | Sonnet    | 0.86  | 0.96  | 0.826
code-reviewer          | Opus      | 0.87  | 0.97  | 0.844
security-reviewer      | Opus      | 0.86  | 0.96  | 0.826
architecture-reviewer  | Opus      | 0.84  | 0.96  | 0.806
git-committer          | Sonnet    | 0.93  | 0.97  | 0.902
changelog-writer       | Sonnet    | 0.83  | 0.96  | 0.797
summary-reporter       | Sonnet    | 0.87  | 0.97  | 0.844
classify-intent        | Opus      | 0.94  | 1.00  | 0.940
decide-action          | Opus      | 0.91  | 1.00  | 0.910
```

*(Les valeurs ci-dessus sont des projections illustratives. Les valeurs reelles seront mesurees en Phase 34-E.)*

### Etape 2 : Calculer le QualityScore global

```
QualityScore_global = moyenne ponderee des QualityScore par bloc

Poids par phase :
  COMPRENDRE  : 10%  (3 blocs)
  PLANIFIER   : 10%  (2 blocs)
  IMPLEMENTER : 30%  (5 blocs — le coeur du travail)
  VERIFIER    : 20%  (5 blocs)
  REVIEWER    : 15%  (3 blocs)
  LIVRER      :  5%  (3 blocs)
  INTERACTION : 10%  (3 blocs)
```

### Etape 3 : Etablir le QualityBaseline

```
QualityBaseline = QualityScore_global du Tier 1
```

C'est la reference. Les tiers suivants ne peuvent pas descendre en dessous de ce baseline sans passer par la Phase B (descente de 5%).

---

## Application aux Tiers 2+

### Phase A : Optimiser le cout sans perdre de qualite

**Entree** : QualityFloor = QualityBaseline × 0.98 (marge de 2% pour absorber la variance)

**Pour chaque bloc** (du moins critique au plus critique) :
1. Remplacer le modele par un modele moins cher (Opus → Sonnet, Sonnet → Haiku)
2. Re-mesurer le QualityScore du bloc (P × W avec le meme protocole)
3. Re-calculer le QualityScore_global
4. **Si QualityScore_global >= QualityFloor** → accepter la substitution
5. **Si QualityScore_global < QualityFloor** → rejeter, garder le modele precedent

**Ordre de substitution** (du moins critique au plus critique) :

| Priorite | Blocs | Justification |
|----------|-------|---------------|
| 1 (premiers) | step-validator, compilation-checker, send-widget-response | Taches simples, meme Haiku devrait suffire |
| 2 | changelog-writer, summary-reporter, test-runner | Formatage et parsing, pas de raisonnement profond |
| 3 | plan-validator, accessibility-checker, project-analyzer | Validation structurelle, pas de creativite |
| 4 | test-writer, research-agent, task-planner | Creativite moderee requise |
| 5 | backend-developer, frontend-developer, styling-developer | Code generation — impact direct sur la qualite |
| 6 | e2e-tester | Interaction browser, raisonnement sequentiel |
| 7 (derniers) | code-reviewer, security-reviewer, architecture-reviewer, ui-reviewer, task-architect, classify-intent, decide-action | Jugement, raisonnement profond, decisions critiques |

**Sortie** : un tier avec un cout reduit mais la meme qualite (a 2% pres).

### Detection du plateau

Un **plateau** est atteint quand :
- Tous les blocs ont ete testes avec un modele moins cher
- Aucune substitution supplementaire n'est possible sans casser le QualityFloor
- OU les 3 dernieres tentatives de substitution ont toutes ete rejetees

### Phase B : Descendre le plancher de qualite

Quand un plateau est detecte :

```
QualityFloor_new = QualityFloor_current × 0.95
```

Si `QualityFloor_new < 0.70` → **STOP**. La qualite est en dessous du seuil minimal acceptable.

Sinon, retourner en Phase A avec le nouveau plancher. Les blocs precedemment rejetes peuvent maintenant etre substitues.

### Resultat : un tier par palier

Chaque palier est publie comme un tier avec son **manifeste** :

```json
{
  "tier": 3,
  "qualityScore": 0.82,
  "qualityFloor": 0.836,
  "costReduction": "42% vs Tier 1",
  "blocks": {
    "project-analyzer": { "model": "haiku-4.5", "qualityScore": 0.78 },
    "task-architect": { "model": "opus-4.6", "qualityScore": 0.84 },
    "backend-developer": { "model": "sonnet-4.6", "qualityScore": 0.79 },
    "step-validator": { "model": "local-qwen2.5", "qualityScore": 0.93 }
  },
  "substitutionsTested": [
    { "block": "backend-developer", "from": "sonnet-4.6", "to": "haiku-4.5", "qualityDrop": 0.18, "rejected": true },
    { "block": "code-reviewer", "from": "opus-4.6", "to": "sonnet-4.6", "qualityDrop": 0.03, "accepted": true }
  ]
}
```

---

## Changements requis par rapport au spec actuel

### Fichier `spec/11-fitness-criteria.md`

| Section | Changement |
|---------|------------|
| Formule Fitness V2 | Ajouter QualityScore = P × W comme metrique principale. Fitness reste pour les tiers 2+. |
| Fitness du workflow global | Remplacer `WorkflowFitness = ... / NormalizedCost` par `QualityScore_global = moyenne ponderee`. Le cout sort de la formule Tier 1. |
| Processus de mesure | Ajouter les protocoles detailles par type de bloc (cette ADR). |
| Degradation progressive | Remplacer par le processus en escalier (Phase A + Phase B + plateau detection). |

### Fichier `spec/14-test-plan.md`

| Section | Changement |
|---------|------------|
| Criteres d'evaluation | Retirer "Duration" du Tier 1 (le temps n'est pas un critere de qualite). Le garder pour les tiers 2+. |
| Seuil de victoire | Reformuler : Tier 1 gagne sur la **qualite** (4/5 criteres qualite), pas sur le cout. |

### Fichier `AGENT-V4-SPEC.md` (index)

| Section | Changement |
|---------|------------|
| Aucun changement structurel | L'index pointe vers les fichiers. Les fichiers sont mis a jour individuellement. |

### Workflow de Phase 34-E et 34-F

| Phase | Changement |
|-------|------------|
| 34-E (Integration + Tier 1) | Mesurer le QualityScore par bloc et global. Pas de Fitness. Comparer vs Claude Code sur la qualite uniquement. |
| 34-F (Degradation) | Implementer le processus en escalier : Phase A (meme qualite, moins cher) → plateau → Phase B (5% de moins) → Phase A → ... |

---

## Pourquoi cette decision

1. **Le Tier 1 est la vitrine.** Si on penalise Opus pour son cout dans le Tier 1, on obtient un agent mediocre qui utilise Haiku partout — l'inverse de l'objectif.

2. **La qualite est une contrainte, pas une variable d'optimisation.** On ne "trade" pas de la qualite contre du cout. On fixe un plancher de qualite, puis on optimise le cout en dessous.

3. **La descente en escalier est previsible.** Chaque tier a un QualityFloor explicite. Pas de surprise ou le fitness augmente mais la qualite chute.

4. **Le plateau force la decision consciente.** Quand on ne peut plus reduire le cout, on doit explicitement accepter de baisser la qualite. Pas de glissement progressif invisible.

5. **Le manifeste capture les decisions.** Chaque tier publie documente exactement quelles substitutions ont ete testees, lesquelles ont ete rejetees, et pourquoi. Transparence totale.
