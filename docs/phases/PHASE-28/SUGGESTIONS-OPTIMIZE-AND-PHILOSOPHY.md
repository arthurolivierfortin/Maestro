# Suggestions : Entry Point `optimize`, Disponibilité des Modèles, et Philosophie

> Date : 2026-02-15
> Contexte : Réflexion architecturale avant implémentation de Phase 28

---

## 1. L'idée `optimize` — Analyse critique

### Ce que vous proposez

Chaque bloc aurait un entry point `optimize` qui :
- Appelle un agent system (ou override utilisateur)
- Utilise une méthode de training (system, override, ou spécifiée)
- Pour un gros workflow, `optimize` descend récursivement et optimise du bas vers le haut

### Ce qui est bon dans l'idée

L'intuition est excellente. L'optimisation comme opération de première classe, applicable à n'importe quel bloc, avec stratégie configurable — c'est puissant. Et la récursivité bottom-up pour les workflows est la bonne approche : optimiser les feuilles d'abord, puis remonter.

### Ce qui pose problème

**`optimize` comme entry point sur le bloc lui-même viole deux principes :**

1. **Un bloc ne se connaît pas lui-même.** Un bloc est un artifact passif — il a un prompt, un config, des inputs/outputs. Il ne sait pas comment s'améliorer. L'optimisation est une opération EXTERNE sur un bloc, pas une opération DU bloc. C'est comme si un fichier `.js` avait une méthode `this.refactorMyself()` — non, c'est un outil externe (ESLint, un dev) qui refactorise le fichier.

2. **Ça crée une dépendance circulaire conceptuelle.** Le bloc A a un entry point `optimize` → qui appelle un agent system → qui doit évaluer le bloc A → qui nécessite un modèle capable. Mais le bloc A lui-même est peut-être un agent. On confond le niveau d'abstraction (le bloc) avec le méta-niveau (l'optimisation du bloc).

---

## 2. Suggestion alternative : L'optimisation comme META-WORKFLOW

### Architecture proposée

Au lieu d'un entry point `optimize` sur chaque bloc, l'optimisation est un **workflow externe** qui prend un bloc comme cible :

```
┌─────────────────────────────────────────┐
│  optimize-block (workflow system)        │
│                                         │
│  Input: blockId, strategy, threshold    │
│                                         │
│  1. Charger le bloc cible               │
│  2. Charger la stratégie d'optimisation │
│  3. Créer une foundry session           │
│  4. Exécuter la boucle d'optimisation   │
│  5. Mesurer le fitness                  │
│  6. Publier si plateau atteint          │
│                                         │
│  Output: optimizedBlockId, fitness      │
└─────────────────────────────────────────┘
```

### Pourquoi c'est mieux

| Critère | Entry point `optimize` | Meta-workflow externe |
|---------|----------------------|---------------------|
| Séparation des niveaux | Bloc = son propre optimiseur (circulaire) | Bloc = cible passive, workflow = optimiseur |
| Philosophie Maestro | Feature hardcodée dans l'infra | Workflow = bloc comme les autres |
| Override | Override de l'entry point (complexe) | Override du workflow d'optimisation (standard) |
| Récursivité | L'entry point doit gérer la récursion | Le workflow recurse naturellement via les children |
| Testabilité | Comment tester un entry point qui modifie son propre bloc ? | Le meta-workflow a ses propres tests, indépendants |
| Disponibilité modèle | Chaque bloc doit vérifier les modèles | Le meta-workflow vérifie UNE FOIS au lancement |

### Implémentation concrète

**1. Un workflow system `optimize-block`**

```json
{
  "id": "system:optimize-block",
  "blockType": "workflow",
  "isSystem": true,
  "overridable": true,
  "config": {
    "nodes": [
      { "id": "load-target", "blockRef": "system:block-loader", "inputs": { "blockId": "{{inputs.blockId}}" } },
      { "id": "check-models", "blockRef": "system:model-checker", "inputs": { "strategy": "{{inputs.strategy}}" } },
      { "id": "create-foundry", "blockRef": "system:foundry-creator", "inputs": { "targetBlock": "{{load-target.output}}" } },
      { "id": "run-optimization", "blockRef": "{{inputs.strategy}}", "inputs": { "targetBlock": "{{load-target.output}}", "threshold": "{{inputs.threshold}}" } },
      { "id": "publish", "type": "conditional", "condition": "run-optimization.fitness >= inputs.threshold",
        "then": { "blockRef": "system:block-publisher" },
        "else": { "blockRef": "system:report-failure" }
      }
    ]
  }
}
```

**2. Des stratégies d'optimisation (elles-mêmes des blocs)**

```
content/system/blocks/strategies/
├── prompt-refinement.workflow.block.json    ← Stratégie par défaut
├── model-downgrade.workflow.block.json      ← Tester des modèles moins chers
├── few-shot-injection.workflow.block.json   ← Ajouter des exemples au prompt
└── temperature-tuning.workflow.block.json   ← Optimiser la température
```

L'utilisateur peut créer ses propres stratégies :
```
.maestro/blocks/strategies/
└── my-custom-optimization.workflow.block.json
```

**3. La commande CLI reste simple et générique**

```bash
# Optimiser un bloc avec la stratégie par défaut
maestro optimize <block-id>

# Optimiser avec une stratégie spécifique
maestro optimize <block-id> --strategy model-downgrade

# Optimiser un workflow entier (bottom-up)
maestro optimize <workflow-id> --recursive

# Optimiser avec un seuil spécifique
maestro optimize <block-id> --threshold 0.90

# Optimiser avec override utilisateur
maestro optimize <block-id> --strategy my-custom-optimization
```

**La commande CLI fait :**
1. Résoudre le bloc cible
2. Résoudre la stratégie (system default, override, ou spécifiée)
3. Créer une session foundry
4. Invoquer `system:optimize-block` avec les inputs
5. Afficher la progression (via le monitor existant)

**C'est 100% générique.** Aucune logique spécifique au code. On peut optimiser un bloc de génération de poésie, un bloc de traduction, un bloc de classification — la mécanique est la même.

### Bottom-up récursif pour les workflows

```
maestro optimize autonomous-dev-v3 --recursive
```

Le meta-workflow `optimize-block` en mode récursif :

```
optimize autonomous-dev-v3
├── optimize context-analyzer-v3      ← feuille, optimise directement
│   └── Essai modèles: sonnet → haiku → local
│   └── Résultat: haiku à 0.95 fitness
├── optimize task-planner-v3          ← feuille
│   └── Essai modèles: sonnet → haiku
│   └── Résultat: sonnet (haiku trop bas)
├── optimize code-implementer-v3      ← feuille
│   └── Essai modèles: sonnet → haiku
│   └── Résultat: sonnet (code trop critique)
├── optimize test-executor-v3         ← feuille
│   └── Résultat: local à 0.92
├── optimize code-reviewer-v3         ← feuille
│   └── Résultat: haiku à 0.91
├── optimize git-committer-v3         ← feuille
│   └── Résultat: local à 0.97
└── Re-test workflow E2E avec les blocs optimisés
    └── Résultat: workflow optimisé publié comme tier N
```

L'ordre naturel : feuilles d'abord, puis le workflow entier.

---

## 3. Disponibilité des modèles

### Le problème

L'optimisation nécessite un modèle capable d'ÉVALUER. Si l'utilisateur n'a que des modèles locaux 1.5B, qui évalue si le 1.5B est bon ?

### Les options

**Option A : Exiger un modèle évaluateur**

Le meta-workflow `optimize-block` a un pré-requis : un modèle capable d'évaluer (claude-sonnet minimum, ou claude-haiku pour de l'évaluation simple).

```
maestro optimize <block-id>
→ "Optimisation requires an evaluator model (claude-haiku minimum).
   Available models: Qwen2.5-Coder-1.5B (local)
   No suitable evaluator found.

   Options:
   1. Configure an API provider: maestro setup
   2. Use heuristic evaluation: maestro optimize <block-id> --eval heuristic
   3. Use manual evaluation: maestro optimize <block-id> --eval manual"
```

**Option B : Évaluation heuristique (sans LLM)**

Maestro a déjà des critères d'évaluation heuristiques :
- `hasJsonStructure` — vérifie la structure JSON
- `validJsonParse` — parse sans erreur
- `noMarkdownFences` — pas de ```markdown
- `hasRequiredFields` — champs obligatoires présents
- `minLength` / `maxLength` — contraintes de taille
- `tokenEfficiency` — ratio tokens utiles / tokens totaux

Ces critères ne nécessitent AUCUN LLM. Un modèle local peut générer, et les heuristiques évaluent. C'est déjà ce que fait le système foundry actuel avec SmolLM2.

```
maestro optimize <block-id> --eval heuristic
→ Utilise les critères d'évaluation définis dans le bloc
→ Pas besoin de modèle évaluateur
→ Limité mais fonctionne pour l'optimisation structurelle
```

**Option C : Évaluation hybride**

Le système `EvaluationConfig` supporte déjà 3 modes : `Auto`, `Manual`, `Hybrid`.

- **Auto** : LLM évalue (nécessite un modèle capable)
- **Manual** : L'utilisateur évalue (lent mais universel)
- **Hybrid** : Heuristiques + LLM pour les cas ambigus
- **Heuristic** (nouveau) : Uniquement heuristiques, 0 LLM

### Suggestion : Détection automatique + fallback

```
Logique de sélection d'évaluation :

1. Vérifier les modèles disponibles
2. Si claude-sonnet/opus dispo → mode Auto (LLM évalue)
3. Si claude-haiku dispo → mode Hybrid (heuristiques + Haiku pour les cas limites)
4. Si locaux seulement → mode Heuristic (heuristiques pures)
5. Toujours proposer mode Manual comme fallback

L'utilisateur peut override avec --eval [auto|hybrid|heuristic|manual]
```

**Le point clé : l'optimisation FONCTIONNE même sans gros modèle.** L'évaluation est juste moins fine. Mais les heuristiques suffisent pour :
- Vérifier que le JSON est valide
- Vérifier que les champs requis sont présents
- Mesurer l'efficacité des tokens
- Détecter les régressions évidentes

L'optimisation heuristique ne trouvera pas "ce prompt est mieux formulé" (ça nécessite du jugement), mais elle trouvera "ce modèle produit du JSON valide 95% du temps au lieu de 70%".

---

## 4. La question de la spécialisation — Le vrai problème

### Le constat

Vous avez raison de vous inquiéter. Regardons ce qui est en train de se passer :

| Élément | Générique ou spécifique ? |
|---------|--------------------------|
| Sessions, blocs, foundry, fitness | **Générique** — fonctionne pour tout |
| Monitor TUI, CLI, API | **Générique** — affiche n'importe quoi |
| `maestro agent` (28-B) | **Spécifique code** — "comme Claude Code" |
| 6 agents V3 (28-A) | **Spécifique code** — context-analyzer, code-implementer, etc. |
| Tiers d'optimisation (28-C) | **Spécifique code** — testés sur Cantante uniquement |
| `optimize` entry point | **Serait générique** — optimise n'importe quel bloc |

Le problème n'est pas dans l'infrastructure — elle reste générique. Le problème est dans la **couche de présentation et la narration**. Maestro peut faire bien plus que du code, mais les 3 premières choses que nous construisons sont code-spécifiques.

### Est-ce vraiment un problème ?

**Non, si on fait la distinction clairement.**

Les 6 agents de Phase 28-A sont du **CONTENU** — des fichiers `.block.json` avec des `system-prompt.md`. Ils vivent dans `content/system/blocks/`. Ils n'ont AUCUN code C# spécifique. Un utilisateur pourrait créer 6 agents pour la rédaction technique, la traduction, ou la composition musicale — exactement de la même manière.

La commande `maestro agent` (28-B) est plus problématique. Si elle hardcode :
- "Lire .maestro/CONVENTIONS.md" → spécifique code/dev
- "Créer branche, commit, PR" → spécifique git/code
- "Phases: analyze → plan → implement → test → review → commit" → spécifique code

Alors c'est une commande code-spécifique déguisée en commande générique.

### Suggestion : Séparer l'infrastructure de la "recette"

**L'infrastructure CLI :**

```bash
# Générique — lance n'importe quel workflow interactivement
maestro run-interactive <workflow-id> --repo <path>
```

Ça fait :
1. Détecter le repo (CWD ou --repo)
2. Lire `.maestro/` si présent
3. Créer une session
4. Lancer le workflow en mode interactif (prompt, progression, résumé)
5. Boucler sur les tâches

**La "recette" code :**

```bash
# Alias spécifique code, qui appelle l'infrastructure générique
maestro agent → maestro run-interactive autonomous-dev-v3 --repo .
```

C'est un **alias de convenance**, pas une feature hardcodée. L'alias est défini dans un fichier de configuration, pas dans le code CLI :

```json
// content/system/aliases.json (ou .maestro/aliases.json)
{
  "agent": {
    "workflow": "autonomous-dev-v3",
    "description": "Autonomous code development agent",
    "defaults": { "repo": "." }
  },
  "writer": {
    "workflow": "content-writer-v1",
    "description": "Technical writing assistant",
    "defaults": { "repo": "." }
  },
  "translator": {
    "workflow": "translation-workflow-v1",
    "description": "Multi-language translator",
    "defaults": {}
  }
}
```

```bash
maestro agent          # → autonomous-dev-v3
maestro writer         # → content-writer-v1
maestro translator     # → translation-workflow-v1
maestro run-interactive my-custom-workflow  # direct
```

**Avantage** : L'infrastructure est 100% générique. Les "recettes" (agent, writer, translator) sont du contenu. Un utilisateur peut ajouter ses propres alias. Rien dans le code C# ou TypeScript du CLI ne sait que "agent" veut dire "code development".

---

## 5. Réponse directe : Est-ce que `optimize` devrait être en Phase 28 ?

### Mon avis : NON pour Phase 28, OUI pour Phase 29

**Pourquoi pas Phase 28 :**

1. **Phase 28-A dépend de INFRA** (BlockRef dispatch). INFRA n'est pas encore fait. Ajouter `optimize` rallonge le chemin critique.

2. **L'optimisation nécessite que le Tier 1 existe.** On ne peut pas optimiser ce qui n'existe pas encore. Phase 28-A crée le Tier 1, Phase 28-C l'optimise manuellement. La mécanique `optimize` automatise ce que 28-C fait à la main.

3. **28-C est déjà un test de la logique.** En faisant l'optimisation manuellement dans 28-C (foundry sessions, test par tier, publish), on VALIDE la logique. Ensuite, en Phase 29, on AUTOMATISE cette logique dans le meta-workflow `optimize-block`.

4. **Le scope de Phase 28 est déjà conséquent.** INFRA + 6 agents + workflow + CLI agent + 5 tiers manuels. Ajouter l'infrastructure `optimize` fait déborder.

### Ce que Phase 28 devrait faire pour PRÉPARER Phase 29

| Préparation | Dans quelle sous-phase |
|-------------|----------------------|
| Vérifier que les stratégies d'optimisation sont des workflows standard (pas de code spécifique) | 28-C — en optimisant manuellement, noter les patterns |
| Documenter les étapes répétitives de l'optimisation | 28-C — chaque tier suit le même processus |
| Créer le `system:model-checker` tool (vérifie les modèles disponibles) | 28-INFRA — utile immédiatement |
| Implémenter la commande `maestro run-interactive` au lieu de `maestro agent` | 28-B — infrastructure générique |
| Définir le format des alias (`aliases.json`) | 28-B — pour que `agent` soit un alias |

### Phase 29 : L'automatisation

| Étape | Livrable |
|-------|----------|
| 1 | Workflow `system:optimize-block` |
| 2 | Stratégies d'optimisation par défaut (model-downgrade, prompt-refinement, etc.) |
| 3 | Commande `maestro optimize <block-id>` |
| 4 | Mode récursif pour les workflows |
| 5 | Détection automatique du mode d'évaluation (auto/hybrid/heuristic/manual) |
| 6 | Tests : optimiser le Tier 1 automatiquement → obtenir le même Tier 2/3 que manuellement |

---

## 6. Résumé des suggestions

### Architecture

| Suggestion | Détail |
|------------|--------|
| `optimize` = meta-workflow externe, pas entry point | Le bloc est une cible passive. L'optimisation est un workflow qui agit SUR le bloc. |
| Stratégies d'optimisation = blocs | `prompt-refinement`, `model-downgrade`, etc. sont des workflow blocks dans `content/system/blocks/strategies/`. Override utilisateur possible. |
| Évaluation adaptative | Auto (LLM) si modèle capable dispo, Hybrid si Haiku, Heuristic si locaux seulement, Manual toujours disponible. |
| `maestro agent` = alias de `maestro run-interactive` | L'infrastructure est générique. Les "recettes" sont du contenu configurable. |
| Aliases configurables | `aliases.json` mappe des noms courts à des workflows. Utilisateur peut ajouter les siens. |

### Timeline

| Phase | Ce qui se passe |
|-------|----------------|
| 28-INFRA | BlockRef dispatch + model-checker tool + timeout/loop |
| 28-A | 6 agents code + workflow Tier 1 |
| 28-B | `run-interactive` (générique) + alias `agent` (contenu) |
| 28-C | Optimisation MANUELLE des tiers (valide la logique) |
| **29** | **Automatisation : `optimize` command + meta-workflow + stratégies** |

### Ce qui change dans les plans Phase 28 existants

| Plan | Changement suggéré |
|------|-------------------|
| PLAN-PHASE-28B.md | Remplacer `maestro agent` par `maestro run-interactive` + système d'aliases. L'alias `agent` pointe vers `autonomous-dev-v3`. |
| PLAN-PHASE-28C.md | Ajouter : documenter les patterns répétitifs pour préparer l'automatisation en Phase 29. |
| PLAN-INFRA.md | Ajouter : `system:model-checker` tool qui liste les modèles disponibles et leurs capacités. |

---

## 7. Le test décisif

> "Un utilisateur qui n'a jamais écrit de code, qui veut utiliser Maestro pour optimiser des recettes de cuisine avec un modèle local, peut-il le faire sans modifier l'infrastructure ?"

Si la réponse est OUI → la philosophie est respectée.

Avec l'architecture proposée :
1. Il crée un bloc `recipe-generator.inference.block.json` avec un prompt pour générer des recettes
2. Il crée un workflow `recipe-optimizer.workflow.block.json` qui enchaîne génération → évaluation → itération
3. Il lance `maestro run-interactive recipe-optimizer --repo ~/my-recipes`
4. Ou il définit un alias : `"chef": { "workflow": "recipe-optimizer" }`
5. Il lance `maestro chef`
6. En Phase 29, il pourra aussi faire `maestro optimize recipe-generator` pour optimiser le bloc lui-même

Zéro code spécifique. Zéro feature hardcodée. La même infrastructure, du contenu différent.
