# Feature : Fitness Engine + Agent Evaluateur Autonome

**Phase cible** : 44
**Prerequis** : Phase 42 (Catalogue — les evaluateurs specialises doivent etre partageables)
**Statut** : Vision documentee

---

## Probleme

Phase 39 implemente `maestro adapt` et `maestro optimize` avec une mesure de fitness binaire :

```
measureFitness = execute le bloc → result.success === true ? → 1 ou 0
```

Ca marche pour du code (compile ? tests passent ?) mais **ne fonctionne pas pour les domaines non-code** :
- Traduction : comment mesurer si la traduction est bonne ?
- Resume de texte : le resume est-il fidele ?
- Classification : les categories sont-elles correctes ?
- Generation d'images : la description est-elle respectee ?

L'utilisateur ne devrait pas avoir a definir ses propres criteres d'evaluation. **Maestro doit le faire automatiquement.**

---

## Vision

Quand l'utilisateur fait `maestro adapt mon-workflow`, un agent system Maestro prend le relais et gere tout :

```
maestro adapt mon-workflow-de-traduction

1. L'agent lit la DESCRIPTION du bloc publie
   → Comprend le but : "Traduit du francais vers l'anglais en preservant le ton"

2. Execute le workflow avec le modele ORIGINAL
   → Capture le resultat REFERENCE (gold standard)

3. Construit des tests automatiquement
   → Compare les futures sorties au gold standard
   → Tests bases sur : description + output reference + heuristiques
   → Exemples : langue de sortie correcte ? longueur similaire ? sens preserve ?

4. Cree un sandbox pour l'isolation

5. Teste les modeles alternatifs contre ces tests
   → Chaque candidat est evalue sur les criteres construits a l'etape 3

6. Rapporte les resultats a l'utilisateur
```

### Deux modes d'execution

```
Si l'utilisateur a les modeles necessaires localement :
  → L'agent system LOCAL fait tout (session locale, sandbox local, evaluation locale)

Si l'utilisateur n'a pas les modeles :
  → Envoye au CLOUD Maestro
  → L'agent cloud cree le sandbox, construit les tests, teste les modeles cloud
  → Retourne les resultats a l'utilisateur
```

**Les deux chemins executent la meme logique.** Local = meme workflow que cloud, juste un runtime different.

---

## Sources d'information pour l'agent

L'agent n'a pas besoin de "comprendre le domaine" a partir de rien. Il dispose de :

| Source | Ce qu'elle apporte |
|--------|--------------------|
| **Block description** (`metadata.description`) | Le BUT du bloc — "traduit FR→EN", "resume un article", etc. |
| **Output reference** (execution avec modele original) | Le GOLD STANDARD — ce que le bloc est cense produire |
| **Block inputs/outputs schema** | La STRUCTURE attendue — types, champs, format |
| **Companion docs** (README.md, RESEARCH.md) | Contexte additionnel si disponible |
| **Historique de fitness** (si disponible) | Metriques passees des executions precedentes |

Le combo **description + output reference** est suffisant pour construire les tests automatiquement.

---

## Les 3 niveaux d'evaluation

### Niveau 1 : Heuristique (gratuit, offline, rapide)

Regles mecaniques, zero LLM :
- JSON/format valide ?
- Champs requis presents ?
- Langue de sortie correcte ? (detection via regex/heuristique)
- Longueur raisonnable ? (pas vide, pas 10x plus long que la reference)
- Temps d'execution acceptable ?
- Tokens utilises raisonnables ?

**Quand** : Toujours, en premier. Filtre les echecs evidents.

### Niveau 2 : LLM-as-Judge local (gratuit si GPU, modele 7B+)

Un modele local evalue la sortie d'un autre :
- Prompt : "Voici l'input, voici la reference, voici le candidat. Note de 0 a 10 sur : fidelite, style, completude."
- Le modele juge n'a pas besoin d'etre bon au domaine — il doit juste COMPARER

**Quand** : Si un modele 7B+ est disponible localement. Apres le filtre heuristique.

### Niveau 3 : LLM-as-Judge cloud (payant, plus fiable)

Meme logique que Niveau 2 mais avec un modele cloud (Claude, GPT-4).

**Quand** : Si l'utilisateur n'a pas de modele local pour juger, ou si l'evaluation locale n'est pas concluante. Payant.

**Cascade** :
```
Niveau 1 (heuristique) — filtre les echecs evidents (gratuit)
  ↓ si OK
Niveau 2 (LLM local) — evalue la qualite (gratuit si GPU)
  ↓ si pas de modele local ou resultat ambigu
Niveau 3 (LLM cloud) — evaluation definitive (payant)
```

---

## Architecture envisagee

```
maestro adapt <workflow-id>
  │
  ├─ extractManifest()              (existe — Phase 39)
  ├─ detectModels()                 (existe — Phase 39)
  │
  ├─ [NOUVEAU] runReferenceExecution()
  │   └─ Execute le workflow avec le modele original
  │   └─ Capture l'output comme gold standard
  │
  ├─ [NOUVEAU] buildEvaluationCriteria()
  │   └─ Agent system lit : description + reference output + schema I/O
  │   └─ Genere : liste de criteres + poids + seuils
  │   └─ Genere : tests heuristiques (Niveau 1)
  │   └─ Genere : prompts d'evaluation LLM (Niveau 2/3)
  │
  ├─ [NOUVEAU] createEvaluationSandbox()
  │   └─ Sandbox avec : checkpoints = inputs du workflow
  │   └─ Tests = criteres generes + reference outputs
  │
  ├─ testSubstitutions()            (existe — Phase 39, mais utilise le nouvel evaluateur)
  │   └─ Pour chaque modele candidat :
  │       1. Execute le bloc
  │       2. Evalue avec Niveau 1 → 2 → 3 (cascade)
  │       3. Score multi-dimensionnel (pas juste pass/fail)
  │
  └─ generateResult()               (existe — Phase 39)
```

### Ou vit le code ?

L'agent evaluateur est un **block Maestro comme les autres** :

```
content/system/blocks/agents/
  evaluation-agent/
    evaluation-agent.agent.block.json    — composite, isAtomic: false
    system-prompt.md                     — instructions pour construire les criteres
    README.md                            — documentation

content/system/blocks/tools/
  heuristic-evaluator/
    heuristic-evaluator.tool.block.json  — Niveau 1, regles mecaniques
  llm-judge/
    llm-judge.inference.block.json       — Niveau 2/3, LLM-as-Judge
```

L'agent evaluateur est composite : il orchestre les outils heuristiques et LLM-judge.

---

## Ce qui ne change PAS

- L'interface CLI reste `maestro adapt <workflow>` — l'utilisateur ne voit pas la difference
- Le sandbox (Phase 38) est reutilise tel quel
- L'extraction de manifeste (Phase 39) est reutilisee telle quelle
- Les strategies d'optimisation (Phase 39) sont reutilisees
- La formule de fitness V2 (Philosophy V2) est implementee dans le Fitness Engine

## Ce qui change

- `measureFitness()` passe de binaire (success/fail) a multi-dimensionnel (score 0-1 avec sous-dimensions)
- L'evaluation est faite par un agent, pas par du code TypeScript hardcode
- Les criteres d'evaluation sont generes dynamiquement, pas pre-definis
- Support cloud pour les utilisateurs sans modeles locaux

---

## Sous-phases proposees

| Sous-phase | Contenu | Effort |
|------------|---------|--------|
| 44-A | **Fitness Engine** — formule V2, metriques multi-dimensionnelles, calcul a chaque execution | 1-2 semaines |
| 44-B | **Evaluateur heuristique** (Niveau 1) — tool block, regles mecaniques, offline | 1 semaine |
| 44-C | **LLM-as-Judge** (Niveau 2/3) — inference block, prompts d'evaluation, cascade local/cloud | 1-2 semaines |
| 44-D | **Agent Evaluateur** — agent composite qui construit criteres + tests a partir de description + reference | 2-3 semaines |
| 44-E | **Integration adapt/optimize** — `measureFitness()` utilise l'agent evaluateur, mode cloud | 1-2 semaines |

---

## Lien avec les autres phases

| Phase | Relation |
|-------|----------|
| 38 (Sandbox) | L'agent evaluateur UTILISE les sandboxes pour isoler les tests |
| 39 (Adapt/Optimize) | L'agent evaluateur REMPLACE le `measureFitness()` binaire |
| 42 (Catalogue) | Les evaluateurs specialises sont PUBLIES dans le catalogue |
| 43 (Auth) | Le mode cloud necessite l'auth pour facturer |
| 45 (Agent Creator) | L'Agent Creator UTILISE l'agent evaluateur pour valider ses creations |

---

## Principe fondamental

> **L'utilisateur n'a rien a gerer.** Il fait `maestro adapt`, Maestro fait le reste.
> La description du bloc + l'output reference = suffisant pour construire les tests.
> Local ou cloud, meme workflow, meme resultat.
