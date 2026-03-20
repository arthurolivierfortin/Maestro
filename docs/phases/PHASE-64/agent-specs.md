# Phase 64 — Specs du pipeline block-forge (V4)

**Principes** :
1. Chaque etape est un workflow/block specialise, pas un LLM generaliste
2. Le workflow controle le flux, le LLM raisonne
3. Blocks specialises Maestro (read-contract, write-block, etc.) — jamais file-read/file-write
4. Le contract-definer est le SEUL qui peut "demander" des infos (via maestro-assistant)
5. Tout le reste est background, zero interaction utilisateur

**A valider AVANT toute implementation.**

---

## Pipeline block-forge

```
block-forge (workflow orchestrateur)
  |
  |  (mode creation — contrat n'existe pas)
  |
  +---> 1. contract-definer
  |         Recoit : description du block a creer
  |         Si besoin d'info → demande en JSON → maestro-assistant pose a l'utilisateur → reponse revient
  |         Produit : definition du contrat (variables descriptives : description, but, capabilities, etc.)
  |
  +---> 2. contract-creator
  |         Recoit : definition du contract-definer
  |         Produit : contract.json complet
  |           - partie descriptive (id, name, description, metadata — pour frontend/humains)
  |           - partie logique (features, weights, tests, checks — pour validation)
  |
  +---> 3. block-planner ←─────────────────────────┐
  |         Recoit : contract.json                  │
  |         Produit : plan (architecture, etapes,   │ BOUCLE
  |                   outils, modele)               │ jusqu'a fitness OK
  |                                                 │
  +---> 4. block-creator                            │
  |         Recoit : plan du block-planner          │
  |         Produit : block.json + system-prompt.md │
  |         Teste : contract-test → fitness         │
  |         Si fitness insuffisant ──────────────────┘
  |
  +---> 5. check-fitness → publish si OK


  (mode adaptation — contrat existe deja, /adapt)

  +---> CONDITIONAL : contractId fourni ?
  |       OUI → skip 1 + 2, directement 3 + 4
  |       NON → pipeline complet 1 → 2 → 3 → 4
```

---

## 1. contract-definer

### En une phrase
Recoit une description de block et produit une definition structuree du contrat.
Peut demander des clarifications via maestro-assistant.

### Type
Workflow interactif (via maestro-assistant pour les questions)

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| description | string | "Un agent qui review du TypeScript pour les bugs et le style" |

### Outputs
| Output | Type | Description |
|--------|------|-------------|
| contractDefinition | JSON | Definition structuree : description, but, capabilities requises, features identifiees, types de tests envisages |

### Comportement

Le contract-definer produit une **definition** — pas le contract.json final.
C'est l'equivalent d'un brief de projet avant la redaction formelle.

La definition contient :
```json
{
  "name": "Code Reviewer",
  "purpose": "Review TypeScript code for bugs, security issues, and style",
  "targetCapabilities": ["conversation", "tool-calling"],
  "features": [
    {
      "name": "bug-detection",
      "description": "Identifies bugs and potential runtime errors",
      "importance": "high",
      "testApproach": "Give code with known bugs, verify agent identifies them"
    },
    {
      "name": "style-review",
      "description": "Checks code style and naming conventions",
      "importance": "medium",
      "testApproach": "Give messy code, verify agent suggests improvements"
    }
  ],
  "constraints": ["Must not rewrite code, only suggest changes"],
  "targetModel": "claude-opus-4-6"
}
```

### Interaction avec maestro-assistant

Si la description est vague, le contract-definer repond avec une **demande** :
```json
{
  "type": "question",
  "questions": [
    "Quels langages le reviewer doit-il supporter ?",
    "Doit-il aussi verifier la securite (injections, XSS) ?",
    "Quel niveau de detail dans les suggestions ?"
  ]
}
```

Le maestro-assistant voit cette demande, la presente a l'utilisateur dans le chat,
collecte les reponses, et les renvoie au contract-definer qui continue.

### Nodes du workflow

```
Node 1: INFERENCE (analyser la description)
  blockRef: inference
  inputs: description
  prompt: "Analyse cette description et produis une definition de contrat structuree.
           Si la description est claire, produis directement la definition JSON.
           Si elle est vague, produis une demande de clarification JSON avec type='question'."
  output: response (definition OU question)

Node 2: CONDITIONAL (response.type)
  "question" → output la question pour maestro-assistant, attendre reponse, retour Node 1
  "definition" → continuer vers output

Node 3: OUTPUT
  contractDefinition = response
```

---

## 2. contract-creator

### En une phrase
Prend la definition du contract-definer et produit un contract.json formel complet.

### Type
Workflow background (aucune interaction)

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| contractDefinition | JSON | La definition du contract-definer |

### Outputs
| Output | Type | Description |
|--------|------|-------------|
| contractId | string | ID du contrat |
| contractPath | string | Chemin fichier |
| contractJson | string | Le contrat complet |

### Nodes du workflow

```
Node 1: INFERENCE (generer le contrat formel)
  blockRef: inference
  inputs: contractDefinition
  prompt: "Voici une definition de contrat : {{contractDefinition}}.
           Genere le contract.json Maestro complet avec :
           - Partie descriptive : id, name, version, description
           - Partie logique : requiredCapabilities, minimumFitness, features
           - Pour chaque feature : weight, minimumScore, tests (2-4 par feature)
           - Chaque test : id, description, prompt, check (type + params)
           - Utilise des check types varies (contains, tool-call, json-parseable, etc.)
           - Les weights doivent sommer a ~1.0
           Reponds UNIQUEMENT avec le JSON."
  output: contractJson

Node 2: WRITE-CONTRACT
  blockRef: write-contract
  inputs: contractJson
  output: contractId, contractPath

Node 3: VALIDATE-CONTRACT
  blockRef: validate-contract
  inputs: contractJson
  output: valid, errors

Node 4: CONDITIONAL
  valid → done
  invalide → INFERENCE (corriger avec errors) → retour Node 2
```

---

## 3. block-planner

### En une phrase
Lit le contrat et cree un plan detaille pour construire le block.

### Type
Workflow background

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| contractId | string | Le contrat a implementer |
| description | string | Description originale (contexte) |
| targetModel | string? | Modele cible |

### Outputs
| Output | Type | Description |
|--------|------|-------------|
| plan | JSON | Plan structure avec etapes, architecture, outils |

### Nodes du workflow

```
Node 1: READ-CONTRACT
  blockRef: read-contract
  inputs: contractId
  output: contractJson

Node 2: READ-TEST-SUITE
  blockRef: read-test-suite
  inputs: contractId
  output: testSuiteJson

Node 3: INFERENCE (planifier)
  blockRef: inference
  inputs: contractJson, testSuiteJson, description, targetModel
  prompt: "Voici le contrat et les tests a satisfaire.
           Cree un plan pour construire ce block :
           - Architecture : blockType, capabilities a declarer, config.nodes
           - System prompt : sections, outils disponibles, format de reponse
           - Strategie pour passer chaque test
           - Modele a utiliser : {{targetModel}}
           Reponds en JSON structure."
  output: plan
```

Pas de boucle ici — le plan est produit en un shot.
La boucle est entre block-planner + block-creator (voir pipeline).

---

## 4. block-creator

### En une phrase
Suit le plan du block-planner et cree le block (block.json + system-prompt.md).

### Type
Workflow background

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| plan | JSON | Le plan du block-planner |
| contractId | string | Pour tester le block |

### Outputs
| Output | Type | Description |
|--------|------|-------------|
| blockId | string | ID du block cree |
| blockPath | string | Chemin |
| fitness | number | Score fitness |
| testResults | string | Resultats des tests |

### Nodes du workflow

```
Node 1: INFERENCE (creer le block selon le plan)
  blockRef: inference
  inputs: plan
  prompt: "Suis ce plan pour creer un block Maestro.
           Produis :
           1. blockJson : le block.json complet
           2. systemPrompt : le system-prompt.md complet
           Reponds en JSON avec ces deux champs."
  output: blockDesign

Node 2: WRITE-BLOCK
  blockRef: write-block
  inputs: blockJson, systemPrompt
  output: blockId, blockPath

Node 3: CONTRACT-TEST
  blockRef: contract-test
  inputs: contractId, blockId
  output: fitness, testResults, passed

Node 4: OUTPUT
  blockId, blockPath, fitness, testResults
```

Pas de boucle interne. Si fitness insuffisant, le pipeline block-forge
renvoie a block-planner (node 3) avec les testResults comme feedback.

---

## Boucle planner ↔ creator dans block-forge

```
block-forge nodes (simplifie) :

  ... contract-definer → contract-creator ...

  Node: set iteration = 0

  Node: WHILE (fitness < target AND iteration < maxRetries)
    |
    +---> block-planner
    |       inputs: contractId, description, targetModel
    |       + si iteration > 0 : previousTestResults (feedback)
    |
    +---> block-creator
    |       inputs: plan (du planner), contractId
    |
    +---> iteration++
    |
    +---> condition: block-creator.passed == true ?
            OUI → break
            NON → continue (le planner recoit les resultats comme feedback)

  Node: check-fitness → publish
```

La boucle est au niveau du WORKFLOW, pas dans la tete du LLM.
Le planner VOIT les echecs precedents et ajuste son plan.
Le creator suit le plan sans se poser de questions.

---

## Blocks specialises a creer

### Lecture
| Block | Input | Output |
|-------|-------|--------|
| `read-contract` | contractId | contractJson |
| `read-test-suite` | contractId | testSuiteJson |

### Ecriture
| Block | Input | Output |
|-------|-------|--------|
| `write-contract` | contractJson | contractId, contractPath |
| `write-test-suite` | testSuiteJson, contractId | testSuitePath |
| `write-block` | blockJson, systemPrompt | blockId, blockPath |

### Validation
| Block | Input | Output |
|-------|-------|--------|
| `validate-contract` | contractJson | valid, errors |
| `validate-test-suite` | testSuiteJson, contractJson | valid, errors |

### Existants
| Block | Status |
|-------|--------|
| inference | OK |
| contract-test | OK |

---

## Pour /adapt (Phase 65)

```
block-forge avec contractId fourni :

  CONDITIONAL : contractId fourni ?
    OUI → skip contract-definer + contract-creator
           → read-contract existant
           → directement block-planner + block-creator en boucle
    NON → pipeline complet
```

Le contrat existe, on adapte le block pour un autre modele ou un autre contexte.
Meme boucle planner ↔ creator, meme contract-test.

---

## Resume du pipeline

| Etape | Nom | Input principal | Output principal | Interaction |
|-------|-----|-----------------|------------------|-------------|
| 1 | contract-definer | description | contractDefinition | Peut demander a l'utilisateur via maestro-assistant |
| 2 | contract-creator | contractDefinition | contract.json | Background |
| 3 | block-planner | contract.json + feedback | plan | Background |
| 4 | block-creator | plan | block.json + system-prompt.md | Background |
| 5 | check-fitness | fitness | publish decision | Background |

**5 etapes, chacune specialisee, zero outil generique.**
