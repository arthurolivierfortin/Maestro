# Phase 34-F : Degradation Progressive — Qualite d'abord, Cout ensuite (Tiers 2+)

**Statut** : A faire
**Prerequis** : Phase 34-E COMPLETE (Tier 1 publie avec QualityBaseline)
**Objectif** : Substituer progressivement les modeles bloc par bloc en utilisant le processus en escalier (Phase A + Phase B), en preservant la qualite au maximum, jusqu'a un seuil minimal de QualityFloor = 0.70.

> **ADR** : Cette sous-phase applique `ADR-QUALITY-FIRST-DEGRADATION.md`. Le processus n'est PAS un simple "drop de 5% de fitness". C'est un processus en escalier : optimiser le cout sous contrainte de qualite, puis baisser le plancher de qualite seulement quand on ne peut plus reduire le cout.

---

## Vision

### Le processus en escalier

```
TIER 1 : Maximiser QualityScore. Cout = irrelevant.
         Resultat = QualityBaseline (reference absolue)
         |
         v
PHASE A : Optimiser le cout, qualite = meme plancher.
          QualityFloor = QualityBaseline x 0.98
          Pour chaque bloc (du moins critique au plus critique) :
            Tester modele moins cher
            Si QualityScore_global >= QualityFloor → accepter
            Sinon → garder le modele cher
          Resultat : TIER 2 (meme qualite, cout reduit)
         |
         v
      Plateau atteint ?
      (plus de substitution possible sans casser le QualityFloor)
         |
    Non: continuer Phase A     Oui: Phase B
                                |
                                v
                    PHASE B : Descendre QualityFloor de 5%
                              Nouveau plancher = QualityFloor x 0.95
                                |
                                v
                    Retour a Phase A avec le nouveau plancher
                                |
                                v
                    QualityFloor < 0.70 ? → STOP
```

### Deux metriques en jeu

| Metrique | Formule | Role |
|----------|---------|------|
| **QualityScore** | P x W | Mesure la qualite pure de chaque bloc et du workflow global |
| **Fitness** | QualityScore / (C_norm x C_compute x C_hw)^lambda | Rapport qualite/prix — utilise pour comparer les tiers entre eux |

La degradation est guidee par **QualityScore** (contrainte : rester au-dessus du QualityFloor). Le **Fitness** est mesure pour chaque tier publie a titre informatif (le gain de Fitness montre le gain de rapport qualite/prix).

---

## Phase A : Optimiser le cout sans perdre de qualite

### Entree

- QualityBaseline = QualityScore_global du Tier 1 (de 34-E)
- QualityFloor = QualityBaseline x 0.98 (marge de 2% pour absorber la variance)

### Processus

Pour chaque bloc, dans l'ordre de substitution (du moins critique au plus critique) :

1. **Substituer** le modele par un modele moins cher (Opus → Sonnet, Sonnet → Haiku, Haiku → modele local)
2. **Re-mesurer** le QualityScore du bloc (P x W) avec le meme protocole que le Tier 1
3. **Re-calculer** le QualityScore_global (moyenne ponderee par phase)
4. **Decision** :
   - Si QualityScore_global >= QualityFloor → **accepter** la substitution
   - Si QualityScore_global < QualityFloor → **rejeter**, garder le modele precedent

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

**Principe** : les blocs de jugement (review, architecture, interaction) sont substitues en dernier car ils ont le plus grand impact sur la qualite globale.

### Sortie de Phase A

Un tier avec un cout reduit mais la meme qualite (a 2% pres) → publier comme Tier N.

---

## Detection du plateau

Un **plateau** est atteint quand :
- Tous les blocs ont ete testes avec un modele moins cher
- Aucune substitution supplementaire n'est possible sans casser le QualityFloor
- **OU** les 3 dernieres tentatives de substitution ont toutes ete rejetees

---

## Phase B : Descendre le plancher de qualite

Quand un plateau est detecte :

```
QualityFloor_new = QualityFloor_current x 0.95
```

**Si QualityFloor_new < 0.70** → **STOP**. La qualite est en dessous du seuil minimal acceptable. Ne pas publier de tier supplementaire.

**Sinon** : retourner en Phase A avec le nouveau plancher. Les blocs precedemment rejetes peuvent maintenant etre substitues (la marge de qualite est plus grande).

---

## Manifeste par tier

Chaque tier publie DOIT contenir :

```json
{
  "tier": 3,
  "qualityScore": 0.82,
  "qualityFloor": 0.836,
  "qualityBaseline": 0.88,
  "qualityDropFromBaseline": "-6.8%",
  "costReduction": "42% vs Tier 1",
  "fitness": 1.45,
  "blocks": {
    "project-analyzer": { "model": "haiku-4.5", "qualityScore": 0.78, "P": 0.82, "W": 0.95 },
    "task-architect": { "model": "opus-4.6", "qualityScore": 0.84, "P": 0.90, "W": 0.93 },
    "backend-developer": { "model": "sonnet-4.6", "qualityScore": 0.79, "P": 0.86, "W": 0.92 },
    "step-validator": { "model": "local-qwen2.5", "qualityScore": 0.93, "P": 0.95, "W": 0.98 }
  },
  "substitutionsTested": [
    {
      "block": "backend-developer",
      "from": "sonnet-4.6",
      "to": "haiku-4.5",
      "qualityScoreBefore": 0.79,
      "qualityScoreAfter": 0.61,
      "qualityDrop": 0.18,
      "globalImpact": "-4.2%",
      "rejected": true,
      "reason": "QualityScore_global dropped below QualityFloor"
    },
    {
      "block": "code-reviewer",
      "from": "opus-4.6",
      "to": "sonnet-4.6",
      "qualityScoreBefore": 0.84,
      "qualityScoreAfter": 0.81,
      "qualityDrop": 0.03,
      "globalImpact": "-0.5%",
      "accepted": true
    }
  ],
  "evaluationCriteria": [
    "P measured per block type protocol (spec/11-fitness-criteria.md)",
    "W measured on same N executions",
    "QualityScore_global = weighted average by phase"
  ],
  "publishDate": "YYYY-MM-DD"
}
```

### Ou sauvegarder les manifestes

```
content/system/manifests/
  tier-1.manifest.json    (publie en 34-E)
  tier-2.manifest.json    (publie en 34-F)
  tier-3.manifest.json    (publie en 34-F)
  ...
```

---

## Avertissements

Les constats de Phase 13 (research) et Phase 26 (agents) montrent :
- **Les prompts Opus/Sonnet NE FONCTIONNENT PAS directement avec Qwen/SmolLM** — il faut reecrire les prompts avec des few-shot examples
- **SmolLM2-1.7B ne suit pas le protocole tool-call** — inutilisable pour les agents
- **Le re-training = reecrire le system prompt** — pas juste changer le model_id

Quand on substitue un modele :
1. D'abord essayer avec le prompt existant
2. Si ca echoue, reecrire le prompt avec des exemples concrets (few-shot)
3. Si ca echoue toujours, la substitution est rejetee pour ce bloc

Si un tier ne tient pas un QualityFloor minimal (< 0.70) : ne pas le publier.

### Effort estime : 5-10 jours (depend du nombre de tiers viables)

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi le lire |
|---------|-----------------|
| `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` | L'ADR qui definit le processus en escalier |
| `docs/phases/PHASE-34/34-A/spec/11-fitness-criteria.md` | Protocoles de mesure, seuils, ordre de substitution, format manifeste |
| `docs/phases/PHASE-34/checkpoint.md` | QualityBaseline du Tier 1 (de 34-E) |
| `content/system/manifests/tier-1.manifest.json` | Le manifeste Tier 1 — point de depart |

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS creer des tiers arbitraires (ex: "Tier 2 = Haiku partout") — chaque substitution est testee bloc par bloc avec mesure du QualityScore
- Ne PAS publier un tier avec QualityFloor < 0.70 — mieux vaut 3 tiers de qualite que 5 dont 2 inutilisables
- Ne PAS oublier de reecrire les prompts quand on passe a des petits modeles — changer le model_id ne suffit pas
- Ne PAS hardcoder les tiers dans le code — les manifestes sont des fichiers JSON, pas du C#
- Ne PAS confondre QualityScore et Fitness — QualityScore guide la degradation (contrainte), Fitness est mesure a titre informatif par tier
- Ne PAS baisser le QualityFloor AVANT d'avoir atteint un plateau — Phase B seulement quand Phase A ne peut plus rien substituer
- Ne PAS sauter la mesure complete du QualityScore_global apres chaque substitution — une substitution locale peut avoir un impact global imprevu

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 34-F : Degradation Progressive
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**QualityBaseline (Tier 1)** : [score]
**Tiers publies** : X
**Detail par tier** :
  | Tier | QualityScore_global | QualityFloor | CostReduction | Fitness |
  |------|--------------------|--------------|--------------|---------|
  | 1 | [baseline] | N/A | 0% | [ref] |
  | 2 | [score] | [floor] | [%] | [score] |
  | 3 | [score] | [floor] | [%] | [score] |
**Plateaux detectes** : X (a quels QualityFloors)
**Descentes de plancher** : X (Phase B executee X fois)
**Blocs substitues** :
  | Bloc | Tier 1 modele | Tier final modele | QualityScore drop |
  |------|--------------|-------------------|-------------------|
  | ... | | | |
**Manifestes** : [chemins des fichiers manifestes]
**Seuil minimal atteint a** : Tier X (QualityFloor = Y)
**Problemes** : [si BLOQUE]
```
