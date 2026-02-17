# Suggestions V2 : Compatibilité, Adaptation Automatique, et Évaluation

> Date : 2026-02-15
> Suite de : SUGGESTIONS-OPTIMIZE-AND-PHILOSOPHY.md
> Statut : Proposition architecturale

---

## 1. Le concept central : Maestro s'adapte à l'utilisateur, pas l'inverse

### Le problème actuel

Un workflow publié est figé. Il dit "j'ai besoin de claude-sonnet pour le nœud X". Si l'utilisateur n'a pas claude-sonnet, le workflow échoue. L'utilisateur doit manuellement trouver un tier compatible ou modifier le workflow lui-même.

### La vision

Maestro devrait être capable de :

1. **Dire à l'utilisateur exactement ce qui lui manque** — "Ce workflow a besoin de 3 modèles, vous en avez 2, il manque claude-haiku"
2. **Proposer de tester avec ce qu'il a** — "Voulez-vous tester si vos modèles locaux peuvent remplacer claude-haiku ?"
3. **Évaluer automatiquement si ça marche** — Exécuter les blocs concernés avec les modèles locaux, mesurer le fitness
4. **Produire un workflow adapté** — Publier une variante personnalisée du workflow pour cet utilisateur

C'est une feature qui différencie fondamentalement Maestro de tout autre outil. Claude Code ne fait pas ça. Cursor ne fait pas ça. Aucun outil ne dit "tu n'as pas le modèle idéal, laisse-moi tester si ça marche avec ce que tu as".

---

## 2. Architecture en deux niveaux

### Niveau 1 : Vérification statique (instantanée, sans exécution)

Quand l'utilisateur veut utiliser un workflow :

```
maestro check autonomous-dev-v3

╭─ Compatibility Report ─────────────────────────────╮
│                                                     │
│  Workflow: autonomous-dev-v3 (Tier 1)               │
│  Published with: 6 blocks, 2 distinct models        │
│                                                     │
│  ✅ claude-sonnet     Available (ClaudeCode)        │
│  ✅ claude-haiku      Available (ClaudeCode)        │
│                                                     │
│  Result: FULLY COMPATIBLE                           │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

Ou :

```
maestro check autonomous-dev-v3-tier3

╭─ Compatibility Report ─────────────────────────────╮
│                                                     │
│  Workflow: autonomous-dev-v3-tier3                   │
│  Published with: 6 blocks, 3 distinct models        │
│                                                     │
│  ✅ claude-haiku            Available (ClaudeCode)  │
│  ❌ Qwen2.5-Coder-1.5B     Not available           │
│  ✅ SmolLM2-1.7B            Available (Local)       │
│                                                     │
│  Result: 2/3 models available (4/6 blocks covered)  │
│                                                     │
│  Missing models affect:                             │
│    • test-executor-v3  (needs Qwen2.5-Coder-1.5B)  │
│    • git-committer-v3  (needs Qwen2.5-Coder-1.5B)  │
│                                                     │
│  Run `maestro adapt autonomous-dev-v3-tier3`        │
│  to test your local models as replacements.         │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

**Comment ça fonctionne :**

Le workflow publié embarque un **manifeste** dans ses métadonnées :

```json
{
  "id": "autonomous-dev-v3-tier3",
  "metadata": {
    "manifest": {
      "publishedAt": "2026-02-20",
      "publishedFitness": 0.91,
      "models": {
        "claude-haiku": {
          "blocks": ["context-analyzer-v3", "task-planner-v3", "code-implementer-v3", "code-reviewer-v3"],
          "role": "inference",
          "minCapability": "instruction-following"
        },
        "Qwen2.5-Coder-1.5B": {
          "blocks": ["test-executor-v3", "git-committer-v3"],
          "role": "inference",
          "minCapability": "json-output"
        }
      },
      "totalBlocks": 6,
      "evaluationCriteria": ["hasJsonStructure", "validJsonParse", "hasRequiredFields"]
    }
  }
}
```

La vérification est une simple comparaison :
1. Lire le manifeste du workflow
2. Appeler `GET /api/v1/models/` pour lister les modèles disponibles
3. Comparer les deux listes
4. Afficher le rapport

**Pas de LLM, pas d'exécution, instantané.** C'est un tool block `system:compatibility-checker`.

### Niveau 2 : Adaptation dynamique (exécution, foundry-like)

```
maestro adapt autonomous-dev-v3-tier3

╭─ Adaptation Test ──────────────────────────────────╮
│                                                     │
│  Testing local models as replacements...            │
│                                                     │
│  test-executor-v3:                                  │
│    Testing SmolLM2-1.7B... ▓▓▓▓▓▓▓░░░ 70%         │
│    Fitness: 0.82 (need ≥ 0.80) ✅ PASS             │
│                                                     │
│  git-committer-v3:                                  │
│    Testing SmolLM2-1.7B... ▓▓▓▓▓▓▓▓▓▓ 100%        │
│    Fitness: 0.91 (need ≥ 0.80) ✅ PASS             │
│                                                     │
│  Result: All blocks can be adapted!                 │
│                                                     │
│  Save adapted workflow? [Y/n]                       │
│  → Saved as: autonomous-dev-v3-tier3-adapted        │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

**Comment ça fonctionne :**

C'est un **workflow** (pas du code hardcodé) :

```
system:adapt-workflow
│
├── 1. load-manifest        Lire le manifeste du workflow cible
├── 2. detect-models        Lister les modèles disponibles
├── 3. find-gaps            Identifier les blocs sans modèle compatible
├── 4. for-each gap:
│   ├── 4a. list-candidates   Quels modèles locaux pourraient remplacer ?
│   ├── 4b. test-candidate    Exécuter le bloc avec le candidat (foundry mini)
│   ├── 4c. evaluate          Mesurer le fitness
│   └── 4d. decide            Si fitness ≥ seuil → accepter, sinon → prochain candidat
├── 5. assemble             Construire le workflow adapté
└── 6. publish-local        Sauvegarder dans .maestro/blocks/ de l'utilisateur
```

Chaque étape est un bloc. Le workflow lui-même est un bloc. **Tout est un bloc.**

---

## 3. L'évaluateur — Le cœur du système

### Le problème de l'évaluation

L'étape 4c (évaluer) est critique. Qui décide si "SmolLM2 produit un commit message acceptable" ?

### Trois niveaux d'évaluation, du plus accessible au plus puissant

```
┌─────────────────────────────────────────────────────────┐
│  Niveau 1 : HEURISTIQUE (gratuit, local, toujours)     │
│                                                         │
│  Critères automatiques sans LLM :                       │
│  • hasJsonStructure — JSON valide ?                     │
│  • validJsonParse — Parse sans erreur ?                 │
│  • hasRequiredFields — Champs obligatoires ?            │
│  • tokenEfficiency — Pas de bavardage ?                 │
│  • noMarkdownFences — Pas de ``` parasite ?             │
│  • outputMatchesSchema — Conforme au schéma I/O ?       │
│  • executionSuccess — Le bloc n'a pas crashé ?          │
│                                                         │
│  Suffisant pour : format, structure, stabilité          │
│  Insuffisant pour : qualité sémantique, pertinence      │
├─────────────────────────────────────────────────────────┤
│  Niveau 2 : LLM LOCAL (gratuit, si modèle évaluateur)  │
│                                                         │
│  Un modèle local évalue la sortie d'un autre :          │
│  • "Ce commit message décrit-il le diff ?"              │
│  • "Ce plan de tâches est-il cohérent ?"                │
│  • "Ce code compile-t-il conceptuellement ?"            │
│                                                         │
│  Limité : un 1.5B qui évalue un 1.5B = bruit           │
│  Utile si : le modèle évaluateur > modèle évalué       │
│  Ex : Qwen 7B évalue Qwen 1.5B → raisonnable          │
├─────────────────────────────────────────────────────────┤
│  Niveau 3 : ÉVALUATEUR CLOUD MAESTRO (payant, futur)   │
│                                                         │
│  Service Maestro hébergé :                              │
│  • POST maestro-cloud.io/api/evaluate                   │
│  • Envoie : le bloc, ses inputs, la sortie à évaluer   │
│  • Reçoit : score, feedback, suggestions                │
│  • Utilise Claude/GPT-4 côté serveur                    │
│                                                         │
│  L'utilisateur ne paie pas un modèle — il paie          │
│  un SERVICE D'ÉVALUATION. C'est différent.              │
│  Le workflow reste local. Les données aussi.             │
│  Seule l'évaluation passe par le cloud.                 │
│                                                         │
│  Business model : freemium                              │
│  • 10 évaluations/jour gratuites                        │
│  • Pro : illimité + évaluation avancée                  │
│  • Enterprise : self-hosted evaluator                   │
└─────────────────────────────────────────────────────────┘
```

### Sélection automatique de l'évaluateur

```
Logique dans le workflow system:adapt-workflow :

1. Vérifier si un évaluateur cloud Maestro est configuré
   → Si oui ET abonnement actif → Niveau 3
   → Sinon ↓

2. Vérifier les modèles locaux capables d'évaluer
   → Si un modèle ≥ 7B est disponible ET différent de la cible → Niveau 2
   → Sinon ↓

3. Fallback heuristique
   → Niveau 1 (toujours disponible)

4. L'utilisateur peut toujours override :
   maestro adapt <workflow> --evaluator heuristic
   maestro adapt <workflow> --evaluator local:Qwen-7B
   maestro adapt <workflow> --evaluator cloud
```

### Le point crucial

**L'évaluateur est lui-même un bloc.** Donc :

```
content/system/blocks/evaluators/
├── heuristic-evaluator.tool.block.json       ← Niveau 1
├── llm-evaluator.inference.block.json        ← Niveau 2
└── cloud-evaluator.tool.block.json           ← Niveau 3 (futur)
```

L'utilisateur peut créer le sien :
```
.maestro/blocks/evaluators/
└── my-domain-evaluator.agent.block.json      ← Évaluateur spécialisé
```

Un sommelier qui utilise Maestro pour optimiser ses notes de dégustation pourrait créer un évaluateur qui vérifie que les termes œnologiques sont corrects. Cet évaluateur utiliserait ses propres critères — pas ceux du code.

---

## 4. Le manifeste de publication — La clé de tout

### Ce qui existe aujourd'hui

Un bloc publié est un fichier JSON avec un `config` et un `metadata`. Il ne dit PAS de quels modèles il a besoin.

### Ce qu'il faut ajouter

Quand un workflow est publié (via foundry → publish), le système génère automatiquement un **manifeste** :

```json
{
  "id": "autonomous-dev-v3-tier2",
  "metadata": {
    "manifest": {
      "version": "1.0",
      "publishedAt": "2026-02-20T14:30:00Z",
      "publishedBy": "foundry-session:abc123",

      "requirements": {
        "models": [
          {
            "id": "claude-sonnet",
            "usedBy": ["task-planner-v3", "code-implementer-v3", "code-reviewer-v3"],
            "role": "primary-inference",
            "minCapability": ["instruction-following", "code-generation", "json-output"],
            "substitutable": false,
            "reason": "Core reasoning blocks — quality drops significantly with smaller models"
          },
          {
            "id": "claude-haiku",
            "usedBy": ["context-analyzer-v3", "test-executor-v3", "git-committer-v3"],
            "role": "secondary-inference",
            "minCapability": ["instruction-following", "json-output"],
            "substitutable": true,
            "testedSubstitutes": [
              { "model": "Qwen2.5-Coder-1.5B", "fitness": 0.84, "viable": true },
              { "model": "SmolLM2-1.7B", "fitness": 0.71, "viable": false }
            ],
            "reason": "Simpler tasks — local models may work"
          }
        ],
        "tools": ["file-read", "file-write", "shell-execute", "directory-list"],
        "minMaestroVersion": "1.0.0"
      },

      "fitness": {
        "overall": 0.95,
        "perBlock": {
          "context-analyzer-v3": { "model": "claude-haiku", "fitness": 0.96 },
          "task-planner-v3": { "model": "claude-sonnet", "fitness": 0.98 },
          "code-implementer-v3": { "model": "claude-sonnet", "fitness": 0.94 },
          "test-executor-v3": { "model": "claude-haiku", "fitness": 0.93 },
          "code-reviewer-v3": { "model": "claude-sonnet", "fitness": 0.97 },
          "git-committer-v3": { "model": "claude-haiku", "fitness": 0.95 }
        }
      },

      "evaluationCriteria": {
        "context-analyzer-v3": ["hasJsonStructure", "hasRequiredFields", "relevantFileSelection"],
        "task-planner-v3": ["hasJsonStructure", "orderedSteps", "noMissingDependencies"],
        "code-implementer-v3": ["executionSuccess", "syntaxValid", "importsCorrect"],
        "test-executor-v3": ["executionSuccess", "hasJsonStructure", "reportsResults"],
        "code-reviewer-v3": ["hasJsonStructure", "hasScore", "hasIssuesList"],
        "git-committer-v3": ["executionSuccess", "conventionalCommitFormat"]
      }
    }
  }
}
```

### Pourquoi c'est puissant

Le manifeste contient TOUT ce qu'il faut pour :

1. **`check`** — Comparer `requirements.models` avec les modèles disponibles
2. **`adapt`** — Savoir quels blocs sont `substitutable: true` et quels substituts ont déjà été testés
3. **Évaluer** — Les `evaluationCriteria` disent exactement quoi mesurer pour chaque bloc
4. **Raccourcir les tests** — Si le manifeste dit "Qwen2.5-Coder-1.5B donne 0.84 pour test-executor", et que l'utilisateur a ce modèle, pas besoin de retester

Le manifeste est généré automatiquement par le processus de publication foundry — pas écrit à la main. Chaque tier publié en Phase 28-C embarquerait ce manifeste.

---

## 5. Le flux complet de l'utilisateur

### Scénario : Alice a seulement des modèles locaux

```
$ maestro run-interactive autonomous-dev-v3

╭─ Compatibility Check ──────────────────────────────╮
│                                                     │
│  autonomous-dev-v3 requires:                        │
│  ❌ claude-sonnet  (6 blocks)  Not available        │
│                                                     │
│  You have: Qwen2.5-Coder-1.5B, SmolLM2-1.7B       │
│                                                     │
│  Options:                                           │
│  1. Try a compatible tier                           │
│     → autonomous-dev-v3-tier4 (80% quality, local)  │
│     → autonomous-dev-v3-tier5 (70% quality, local)  │
│                                                     │
│  2. Adapt this workflow to your models              │
│     → Test your local models as replacements        │
│     → Estimated time: ~5 minutes                    │
│                                                     │
│  3. Configure a cloud provider                      │
│     → maestro setup                                 │
│                                                     │
╰─────────────────────────────────────────────────────╯

> 1

Using autonomous-dev-v3-tier4...
All required models available. ✅

> Add a file-tree module to the project
```

### Scénario : Bob a Claude Haiku mais pas Sonnet

```
$ maestro check autonomous-dev-v3-tier2

╭─ Compatibility Report ─────────────────────────────╮
│                                                     │
│  ✅ claude-haiku   Available                        │
│  ❌ claude-sonnet  Not available                    │
│                                                     │
│  3/6 blocks need claude-sonnet:                     │
│    task-planner, code-implementer, code-reviewer    │
│                                                     │
│  Manifest says: NOT substitutable                   │
│  (quality drops significantly with smaller models)  │
│                                                     │
│  Compatible tiers for your models:                  │
│    → autonomous-dev-v3-tier3  (90%, haiku+local)    │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

### Scénario : Carol veut adapter un workflow

```
$ maestro adapt autonomous-dev-v3-tier3

╭─ Adaptation ───────────────────────────────────────╮
│                                                     │
│  2 blocks need models you don't have.               │
│                                                     │
│  Manifest already has test data:                    │
│  • test-executor-v3 + Qwen2.5-Coder-1.5B → 0.84   │
│    You have Qwen2.5-Coder-1.5B ✅ Skip test        │
│                                                     │
│  • git-committer-v3 + Qwen2.5-Coder-1.5B → 0.84   │
│    You have Qwen2.5-Coder-1.5B ✅ Skip test        │
│                                                     │
│  All gaps resolved from manifest data!              │
│  No testing needed.                                 │
│                                                     │
│  Save as: autonomous-dev-v3-tier3-adapted? [Y/n]    │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

Le manifeste contient déjà les résultats des tests. Si le modèle de l'utilisateur a déjà été testé lors de la publication, **zéro exécution nécessaire** — on sait déjà que ça marche.

### Scénario : Dave a un modèle exotique

```
$ maestro adapt autonomous-dev-v3-tier3

╭─ Adaptation ───────────────────────────────────────╮
│                                                     │
│  2 blocks need models you don't have.               │
│                                                     │
│  • test-executor-v3 needs Qwen2.5-Coder-1.5B       │
│    You have: Mistral-7B-Instruct                    │
│    Not in manifest — needs testing.                  │
│                                                     │
│  • git-committer-v3 needs Qwen2.5-Coder-1.5B       │
│    You have: Mistral-7B-Instruct                    │
│    Not in manifest — needs testing.                  │
│                                                     │
│  Running adaptation tests...                        │
│                                                     │
│  test-executor-v3 + Mistral-7B:                     │
│    Iteration 1/3... ✅ fitness: 0.91                │
│    Iteration 2/3... ✅ fitness: 0.89                │
│    Iteration 3/3... ✅ fitness: 0.90                │
│    Average: 0.90 ≥ 0.80 threshold ✅               │
│                                                     │
│  git-committer-v3 + Mistral-7B:                     │
│    Iteration 1/3... ✅ fitness: 0.94                │
│    Iteration 2/3... ✅ fitness: 0.93                │
│    Iteration 3/3... ✅ fitness: 0.95                │
│    Average: 0.94 ≥ 0.80 threshold ✅               │
│                                                     │
│  All blocks adapted successfully!                   │
│  Evaluator used: heuristic (no capable LLM found)   │
│                                                     │
│  Save as: autonomous-dev-v3-tier3-adapted? [Y/n]    │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

Évaluation heuristique : pas besoin de gros modèle. Les critères du manifeste (`executionSuccess`, `conventionalCommitFormat`, etc.) sont vérifiables par du code.

---

## 6. L'évaluateur cloud Maestro — Le business model futur

### Le concept

Les workflows et les blocs sont **gratuits et open-source**. L'infrastructure est gratuite. Les modèles locaux sont gratuits. Mais l'**évaluation de qualité** est un service premium.

### Pourquoi ça a de la valeur

| Ce que l'heuristique sait faire | Ce que l'heuristique ne sait PAS faire |
|--------------------------------|---------------------------------------|
| "Le JSON est valide" | "Ce plan de tâches est logiquement cohérent" |
| "Le commit suit le format conventionnel" | "Ce message de commit décrit bien le changement" |
| "Le code n'a pas de SyntaxError" | "Ce code est idiomatique et maintenable" |
| "Les champs requis sont présents" | "Le contenu des champs est pertinent" |

L'évaluateur cloud comble ce gap. Il offre du **jugement**, pas juste de la validation.

### Architecture technique

```
Côté utilisateur (local) :
  maestro adapt workflow-x --evaluator cloud
  │
  ├── Exécute le bloc avec le modèle local (LOCAL)
  ├── Capture la sortie (LOCAL)
  ├── Envoie à l'API Maestro Cloud :
  │   {
  │     "blockId": "test-executor-v3",
  │     "input": { "changedFiles": [...] },
  │     "output": "{ ... la sortie du bloc ... }",
  │     "criteria": ["executionSuccess", "reportsResults"],
  │     "manifest": { ... le manifeste du workflow ... }
  │   }
  └── Reçoit :
      {
        "score": 0.87,
        "passed": true,
        "feedback": "Output is structured correctly. Minor: test summary could be more detailed.",
        "suggestions": ["Add failure count to summary", "Include test file paths"]
      }
```

**Ce qui NE passe PAS par le cloud :**
- Le code source de l'utilisateur
- Les fichiers du repo
- Les prompts internes des blocs (sauf si nécessaire pour l'évaluation)
- Les données sensibles

**Ce qui passe par le cloud :**
- L'output d'un bloc (ce que le LLM a généré)
- Les critères d'évaluation
- Le manifeste du workflow (public de toute façon)

### Modèle économique

```
┌─────────────────────────────────────────────────────┐
│  FREE                                                │
│  • 10 évaluations cloud / jour                       │
│  • Évaluation heuristique illimitée                  │
│  • Adaptation avec modèles locaux illimitée          │
│  • Tous les workflows et blocs system                │
├─────────────────────────────────────────────────────┤
│  PRO (ex: $9/mois)                                   │
│  • Évaluations cloud illimitées                      │
│  • Évaluateur avancé (Claude Opus pour l'éval)       │
│  • Suggestions d'optimisation de prompts             │
│  • Historique d'évaluations et tendances             │
├─────────────────────────────────────────────────────┤
│  ENTERPRISE                                          │
│  • Self-hosted evaluator (on-premise)                │
│  • Custom evaluation criteria                        │
│  • Pas de données envoyées à l'extérieur             │
│  • SLA                                               │
└─────────────────────────────────────────────────────┘
```

### Pourquoi c'est cohérent avec la philosophie

L'évaluateur cloud n'est PAS un modèle d'inférence. L'utilisateur ne paie pas pour EXÉCUTER ses workflows — il paie pour les ÉVALUER. C'est la différence entre :

- ❌ "Paie pour utiliser notre modèle" (SaaS classique, dépendance)
- ✅ "Tes workflows tournent localement. Paie pour un meilleur jugement." (service optionnel, pas de dépendance)

Si l'utilisateur arrête de payer, ses workflows continuent de tourner. Il perd juste l'évaluation avancée et revient aux heuristiques.

---

## 7. Tout est un bloc — Rien n'est hardcodé

### Récapitulatif des blocs système impliqués

```
content/system/blocks/
├── compatibility/
│   ├── compatibility-checker.tool.block.json    ← check statique
│   ├── model-detector.tool.block.json           ← liste les modèles dispo
│   └── manifest-reader.tool.block.json          ← lit le manifeste d'un workflow
│
├── adaptation/
│   ├── adapt-workflow.workflow.block.json        ← orchestrateur d'adaptation
│   ├── gap-finder.tool.block.json               ← identifie les blocs sans modèle
│   ├── candidate-tester.workflow.block.json      ← teste un modèle sur un bloc
│   └── workflow-assembler.tool.block.json        ← assemble le workflow adapté
│
├── evaluators/
│   ├── heuristic-evaluator.tool.block.json      ← Niveau 1
│   ├── llm-evaluator.inference.block.json       ← Niveau 2
│   └── cloud-evaluator.tool.block.json          ← Niveau 3 (futur)
│
├── strategies/                                    ← Pour Phase 29
│   ├── model-downgrade.workflow.block.json
│   ├── prompt-refinement.workflow.block.json
│   └── temperature-tuning.workflow.block.json
│
└── publishing/
    └── manifest-generator.tool.block.json       ← Génère le manifeste à la publication
```

Chaque élément est :
- Un bloc standard avec `.block.json`
- Découvert par `FileSystemBlockDiscoveryService` (aucune modification)
- Marqué `isSystem: true, overridable: true`
- Remplaçable par l'utilisateur via `.maestro/blocks/`

**L'utilisateur qui n'est pas satisfait de l'évaluateur heuristique peut créer le sien dans `.maestro/blocks/evaluators/`. Celui qui a un meilleur algorithme de gap-finding peut override `gap-finder`. Le sommelier peut avoir un `wine-evaluator`. Tout est substituable.**

---

## 8. Ce qui change dans les plans de Phase 28

### Mon avis : le manifeste doit être en Phase 28, le reste en Phase 29+

**Phase 28 (ajouter) :**

| Ajout | Sous-phase | Justification |
|-------|-----------|---------------|
| Manifeste de publication | 28-C | Quand on publie chaque tier, on génère le manifeste automatiquement. C'est un outil `manifest-generator` simple. Si on ne le fait pas maintenant, on perd les données des tests de chaque tier. |
| `maestro check <workflow>` | 28-B | Commande CLI triviale : lire manifeste + lister modèles + comparer. Nécessaire pour le UX de `run-interactive`. |
| `model-detector` tool | 28-INFRA | Appelle `GET /api/v1/models/` et retourne la liste structurée. Utile partout. |

**Phase 29 (tout le reste) :**

| Feature | Phase | Justification |
|---------|-------|---------------|
| `maestro adapt` | 29-A | Nécessite le manifeste de 28-C comme input |
| `maestro optimize` | 29-A | Nécessite que le Tier 1 et l'adaptation fonctionnent |
| Évaluateur heuristique (bloc) | 29-A | Extraire la logique d'évaluation existante en bloc standalone |
| Évaluateur LLM (bloc) | 29-A | Bloc inference avec prompt d'évaluation |
| Stratégies d'optimisation (blocs) | 29-B | model-downgrade, prompt-refinement, etc. |
| Bottom-up récursif | 29-B | `optimize --recursive` |
| Évaluateur cloud Maestro | 30+ | Infra serveur, auth, billing — c'est un produit |

### Pourquoi le manifeste DOIT être en Phase 28

En Phase 28-C, on va manuellement optimiser chaque tier. On va tester claude-haiku sur context-analyzer, mesurer le fitness, décider si ça passe. Toutes ces données sont PRÉCIEUSES. Si on ne les capture pas dans un manifeste structuré au moment de la publication, on les perd.

Le manifeste est aussi la SEULE chose qui rend `check` et `adapt` possibles. Sans manifeste → pas de données → pas de compatibilité automatique.

Générer le manifeste à la publication coûte ~50 lignes de code (un tool block qui agrège les métriques de la foundry session). C'est petit et ça a un ROI énorme.

---

## 9. Résumé

| Concept | Architecture |
|---------|-------------|
| Vérification de compatibilité | Tool block `check` : manifeste vs modèles disponibles. Instantané, sans exécution. |
| Adaptation dynamique | Workflow block `adapt` : teste les modèles locaux comme substituts, utilise le manifeste pour raccourcir. |
| Évaluation à 3 niveaux | Heuristique (gratuit, toujours) → LLM local (si modèle capable) → Cloud Maestro (payant, futur). Chaque niveau est un bloc overridable. |
| Manifeste de publication | Métadonnées générées automatiquement à la publication foundry. Contient : modèles, fitness par bloc, substituts testés, critères d'évaluation. |
| Business model futur | Workflows gratuits + évaluation cloud premium. L'utilisateur ne paie pas pour exécuter, il paie pour du jugement. |
| Rien n'est hardcodé | Chaque composant est un bloc system overridable. Un utilisateur peut remplacer l'évaluateur, la stratégie d'adaptation, ou le vérificateur de compatibilité. |
| Phase 28 scope | Ajouter : manifeste + `check` + `model-detector`. Le reste = Phase 29+. |
