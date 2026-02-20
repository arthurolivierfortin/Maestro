# 11. Criteres de Qualite et Fitness par Bloc

> **ADR** : Ce document a ete mis a jour selon `ADR-QUALITY-FIRST-DEGRADATION.md` (2026-02-19).
> La metrique principale du Tier 1 est **QualityScore**, pas Fitness. Fitness est reserve aux Tiers 2+.

---

## Deux metriques distinctes

### 1. QualityScore — metrique pure de qualite (Tier 1)

```
QualityScore = P x W
```

- **P** (Performance) : qualite de la sortie mesuree par des tests objectifs (protocoles detailles ci-dessous)
- **W** (Composabilite) : 1 - taux d'hallucination, respect du format de sortie
- **S** (Specialisation) : fixe a **1.0** par design — chaque bloc v4 est mono-tache (voir justification ci-dessous)

**Pas de dimension de cout.** C'est la seule metrique pour le Tier 1. Le createur a Claude Code Max — Opus et Sonnet sont disponibles sans contrainte. Le seul objectif est la qualite maximale.

### 2. Fitness — rapport qualite/prix (Tiers 2+)

```
Fitness = QualityScore / (C_norm x C_compute x C_hw)^lambda
```

Utilise a partir du Tier 2 pour optimiser le cout **sous contrainte de qualite** (QualityFloor).

| Dimension | Signification |
|-----------|---------------|
| **P** (Performance) | Qualite de la sortie : tests passes, format respecte, criteres metier |
| **W** (Composabilite) | 1 - taux d'hallucination. Respect du format de sortie, pas d'inventions |
| **S** (Specialisation) | Fixe a 1.0 (blocs mono-tache par design) |
| **C_norm** | Cout economique normalise par rapport a un baseline |
| **C_compute** | log(params) x FLOPs/token du modele |
| **C_hw** | VRAM + RAM + GPU requirement |
| **lambda** | Penalisation non-lineaire des couts (recommande: 1.5) |

---

## Pourquoi S = 1.0

Chaque bloc v4 est concu pour une seule tache :

```
S = P / H(taches)

ou H(taches) = entropie de Shannon des types de taches

Puisque chaque bloc ne fait qu'un type de tache :
  H(taches) = 0 → S = P / epsilon ≈ 1.0
```

En pratique, on fixe **S = 1.0** pour tous les blocs v4. S devient pertinent uniquement si un bloc est reutilise pour des taches differentes (ce qu'on ne fait pas en v4).

Cela simplifie QualityScore a : `QualityScore = P x 1.0 x W = P x W`

---

## Mesure de P (Performance) — protocoles detailles par type de bloc

P est la dimension la plus critique. Voici comment elle est mesuree concretement selon le **role** du bloc :

### Blocs d'implementation (backend-developer, frontend-developer, styling-developer)

P est mesure par **l'execution reelle du code produit** :

```
P_implementation = (w1 x CompilationRate) + (w2 x TestPassRate) + (w3 x AcceptanceCriteria)

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

### Blocs de review (code-reviewer, security-reviewer, architecture-reviewer)

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

### Blocs de planification (task-planner, task-architect)

P est mesure par **l'executabilite du plan produit** :

```
P_planning = nb_steps_implementes_avec_succes / nb_steps_du_plan

ou :
  Un step est "implemente avec succes" si un developer-agent arrive
  a l'implementer sans erreur en utilisant seulement les infos du step.
```

**Protocole** : donner 10 taches au planner. Pour chaque plan produit, demander a un developer-agent de l'executer step par step. Compter les steps reussis.

**Pourquoi cette mesure** : un plan est bon si chaque step est assez precis pour etre implemente. Un step vague ("implement the feature") echouera → P baisse.

### Blocs d'analyse (project-analyzer, research-agent)

P est mesure par **la precision factuelle** :

```
P_analysis = nb_champs_corrects / nb_champs_total

ou :
  Pour chaque champ de l'output (stack.language, conventions.naming, etc.)
  Verifier si la valeur est correcte (comparaison avec la verite terrain)
```

**Protocole** : preparer 10 repos dont on connait exactement la stack, les conventions, l'architecture. Executer le bloc. Comparer chaque champ avec la verite.

### Blocs de verification visuelle (ui-reviewer, accessibility-checker)

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

### Blocs d'interaction (classify-intent, decide-action)

P est mesure par **l'accuracy de classification/decision** :

```
P_interaction = nb_reponses_correctes / nb_scenarios_total
```

**Protocole pour classify-intent** : 50 messages de test avec l'intent attendu pre-etiquete. 10 par categorie (question, feedback, change-request, override, acknowledgment). Compter les classifications correctes.

**Protocole pour decide-action** : 30 scenarios avec l'action attendue. Inclure des cas limites (feedback ambigu, override sans confirmation, etc.).

### Blocs utilitaires (step-validator, compilation-checker, git-committer, test-runner)

P est mesure par **le taux de succes binaire** :

```
P_utility = nb_executions_correctes / nb_executions_total
```

Pas de nuance — ca marche ou ca marche pas.

---

## Mesure de W (Composabilite)

W mesure si le bloc **respecte son contrat de sortie** :

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

## Seuils QualityScore par bloc

### Phase COMPRENDRE

| Bloc | P (comment mesurer) | Seuil P | Seuil W | Seuil QualityScore |
|------|---------------------|---------|---------|-------------------|
| `project-analyzer` | Precision factuelle sur 10 repos de test | >= 0.85 | >= 0.95 | >= 0.81 |
| `task-architect` | Qualite decomposition evaluee par code-reviewer | >= 0.85 | >= 0.90 | >= 0.77 |
| `research-agent` | Pertinence findings evaluee par humain | >= 0.80 | >= 0.95 | >= 0.76 |

### Phase PLANIFIER

| Bloc | P | Seuil P | Seuil W | Seuil QualityScore |
|------|---|---------|---------|-------------------|
| `task-planner` | % plans dont chaque step est implementable | >= 0.85 | >= 0.95 | >= 0.81 |
| `plan-validator` | Precision + recall sur 20 plans | >= 0.90 | >= 1.0 | >= 0.90 |

### Phase IMPLEMENTER

| Bloc | P | Seuil P | Seuil W | Seuil QualityScore |
|------|---|---------|---------|-------------------|
| `backend-developer` | CompilationRate + TestPassRate + AcceptanceCriteria | >= 0.85 | >= 0.90 | >= 0.77 |
| `frontend-developer` | Composants qui compilent + rendent sans erreur | >= 0.85 | >= 0.90 | >= 0.77 |
| `styling-developer` | Score ui-reviewer sur le code style | >= 0.80 | >= 0.90 | >= 0.72 |
| `step-validator` | True positive + true negative rate | >= 0.95 | >= 0.98 | >= 0.93 |
| `compilation-checker` | Detection build command + parsing erreurs | >= 0.90 | >= 0.95 | >= 0.86 |

### Phase VERIFIER

| Bloc | P | Seuil P | Seuil W | Seuil QualityScore |
|------|---|---------|---------|-------------------|
| `test-writer` | % tests ecrits qui passent a l'execution | >= 0.85 | >= 0.90 | >= 0.77 |
| `test-runner` | Parsing correct des resultats | >= 0.90 | >= 0.95 | >= 0.86 |
| `e2e-tester` | % flows qui refletent de vrais parcours | >= 0.80 | >= 0.90 | >= 0.72 |
| `ui-reviewer` | Concordance avec evaluation humaine | >= 0.80 | >= 0.95 | >= 0.76 |
| `accessibility-checker` | Detection violations WCAG vs axe-core | >= 0.85 | >= 0.95 | >= 0.81 |

### Phase REVIEWER

| Bloc | P | Seuil P | Seuil W | Seuil QualityScore |
|------|---|---------|---------|-------------------|
| `code-reviewer` | Correlation avec evaluation humaine | >= 0.85 | >= 0.95 | >= 0.81 |
| `security-reviewer` | Detection vulnerabilites (recall + precision) | >= 0.85 | >= 0.95 | >= 0.81 |
| `architecture-reviewer` | Correlation avec evaluation architecturale | >= 0.80 | >= 0.95 | >= 0.76 |

### Phase LIVRER

| Bloc | P | Seuil P | Seuil W | Seuil QualityScore |
|------|---|---------|---------|-------------------|
| `git-committer` | Commit reussi + message conventionnel valide | >= 0.90 | >= 0.95 | >= 0.86 |
| `changelog-writer` | Qualite entree changelog | >= 0.80 | >= 0.95 | >= 0.76 |
| `summary-reporter` | Clarte et completude du rapport | >= 0.85 | >= 0.95 | >= 0.81 |

### Interaction Handler

| Bloc | P | Seuil P | Seuil W | Seuil QualityScore |
|------|---|---------|---------|-------------------|
| `classify-intent` | Accuracy classification sur 50 messages | >= 0.92 | >= 1.0 | >= 0.92 |
| `decide-action` | Exactitude action choisie sur 30 scenarios | >= 0.90 | >= 1.0 | >= 0.90 |
| `send-widget-response` | Formatage correct du widget JSON | >= 0.95 | >= 1.0 | >= 0.95 |

---

## QualityScore global du workflow

Le QualityScore global est mesure sur des taches completes, pas sur des blocs individuels.

### QualityScore global — moyenne ponderee

```
QualityScore_global = somme(poids_phase x QualityScore_moyen_phase)
```

**Poids par phase** :

| Phase | Poids | Blocs | Justification |
|-------|-------|-------|---------------|
| COMPRENDRE | 10% | 3 blocs | Base de donnees, mais les erreurs sont rattrapees plus tard |
| PLANIFIER | 10% | 2 blocs | Un bon plan est important mais iterable |
| IMPLEMENTER | 30% | 5 blocs | Le coeur du travail — code produit |
| VERIFIER | 20% | 5 blocs | Sans verification, le code n'a pas de valeur prouvee |
| REVIEWER | 15% | 3 blocs | Garant de la qualite finale |
| LIVRER | 5% | 3 blocs | Important mais le moins impactant sur la qualite du code |
| INTERACTION | 10% | 3 blocs | Differenciateur cle vs Claude Code |

### Mesure globale sur taches completes

En plus du QualityScore par bloc, mesurer sur des taches end-to-end :

| Dimension | Mesure | Seuil Tier 1 |
|-----------|--------|--------------|
| TaskCompletion | % de taches completees avec succes (compile, tests passent, commit) | >= 0.85 |
| CodeQuality | Score moyen du code-reviewer sur toutes les taches | >= 0.80 |
| VisualQuality | Score moyen du ui-reviewer (si applicable) | >= 0.75 |
| SecurityPass | % de taches sans vulnerabilite critique | >= 0.95 |
| UserSatisfaction | Evaluation humaine (1-5) sur la qualite du resultat | >= 4.0/5.0 |

### Comparaison vs Claude Code brut

Pour chaque tache de test, executer :
1. La tache avec `maestro-agent-v4`
2. La meme tache avec Claude Code brut (meme modele)
3. Comparer sur les dimensions de **qualite uniquement** : Completion, CodeQuality, Tests, VisualQuality, Security

**Le seuil** : Maestro Agent v4 doit etre **significativement meilleur** sur au moins 4 des 5 criteres de qualite pour au moins 4 des 5 taches de test.

> **Note** : Duration et Cost ne sont PAS des criteres de victoire pour le Tier 1. Ils sont mesures a titre informatif et deviennent pertinents a partir du Tier 2.

---

## QualityBaseline — la reference absolue

```
QualityBaseline = QualityScore_global du Tier 1
```

C'est la reference. Les tiers suivants ne peuvent pas descendre en dessous de ce baseline sans passer par la Phase B (descente de 5%).

---

## Processus de mesure du QualityScore

### Pour un bloc individuel

1. Preparer un jeu de test (inputs varies, attendus connus)
2. Executer le bloc N fois (N >= 10)
3. Mesurer P avec le protocole specifique au type de bloc (voir ci-dessus)
4. Mesurer W sur les memes executions (format, hallucinations)
5. Calculer QualityScore = P x W
6. Verifier que QualityScore >= seuil du bloc

### Pour le workflow global

1. Preparer 5 taches de complexite variee (voir [14-test-plan.md](14-test-plan.md))
2. Executer chaque tache avec le workflow complet
3. Mesurer TaskCompletion, CodeQuality, VisualQuality, Security pour chaque tache
4. Calculer QualityScore_global
5. Executer les memes taches avec Claude Code brut
6. Comparer les resultats sur la qualite

---

## Degradation progressive — processus en escalier (Tiers 2+)

> Ref: `ADR-QUALITY-FIRST-DEGRADATION.md`

### Phase A : Optimiser le cout sans perdre de qualite

**Entree** : QualityFloor = QualityBaseline x 0.98 (marge de 2% pour absorber la variance)

**Pour chaque bloc** (du moins critique au plus critique) :
1. Remplacer le modele par un modele moins cher (Opus → Sonnet, Sonnet → Haiku)
2. Re-mesurer le QualityScore du bloc (P x W avec le meme protocole)
3. Re-calculer le QualityScore_global
4. **Si QualityScore_global >= QualityFloor** → accepter la substitution
5. **Si QualityScore_global < QualityFloor** → rejeter, garder le modele precedent

### Detection du plateau

Un **plateau** est atteint quand :
- Tous les blocs ont ete testes avec un modele moins cher
- Aucune substitution supplementaire n'est possible sans casser le QualityFloor
- OU les 3 dernieres tentatives de substitution ont toutes ete rejetees

### Phase B : Descendre le plancher de qualite

Quand un plateau est detecte :

```
QualityFloor_new = QualityFloor_current x 0.95
```

Si `QualityFloor_new < 0.70` → **STOP**. La qualite est en dessous du seuil minimal acceptable.

Sinon, retourner en Phase A avec le nouveau plancher.

### Ordre de substitution (du moins critique au plus critique)

| Priorite | Blocs | Justification |
|----------|-------|---------------|
| 1 (premiers) | step-validator, compilation-checker, send-widget-response | Taches simples, meme Haiku devrait suffire |
| 2 | changelog-writer, summary-reporter, test-runner | Formatage et parsing, pas de raisonnement profond |
| 3 | plan-validator, accessibility-checker, project-analyzer | Validation structurelle, pas de creativite |
| 4 | test-writer, research-agent, task-planner | Creativite moderee requise |
| 5 | backend-developer, frontend-developer, styling-developer | Code generation — impact direct sur la qualite |
| 6 | e2e-tester | Interaction browser, raisonnement sequentiel |
| 7 (derniers) | code-reviewer, security-reviewer, architecture-reviewer, ui-reviewer, task-architect, classify-intent, decide-action | Jugement, raisonnement profond, decisions critiques |

### Manifeste par tier

Chaque tier publie DOIT contenir :

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

### Avertissements

Les constats de Phase 13 (research) et Phase 26 (agents) montrent :
- **Les prompts Opus/Sonnet NE FONCTIONNENT PAS directement avec Qwen/SmolLM** — il faut reecrire les prompts avec des few-shot examples
- **SmolLM2-1.7B ne suit pas le protocole tool-call** — inutilisable pour les agents
- **Le re-training = reecrire le system prompt** — pas juste changer le model_id

Si un tier ne tient pas un QualityFloor minimal (< 0.70) : ne pas le publier.
