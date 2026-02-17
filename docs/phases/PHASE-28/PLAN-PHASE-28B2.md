# Plan : Phase 28-B2 — Agent Creator

> Prérequis : Phase 28-A ✅ (Agent dev fonctionnel) + Phase 28-B ✅ (Mode maestro code + widgets)
> Effort estimé : ~2 jours
> But : Créer un agent qui crée des agents — automatiser le processus foundry qui était manuel en Phase 28-A.

---

## 1. Vision

En Phase 28-A, nous (les développeurs) avons créé `autonomous-dev-v3` manuellement : écrire les JSON, configurer les foundry sessions, tester, itérer, publier. Ce processus est long et nécessite des compétences de développeur.

L'Agent Creator automatise tout ça. Dans l'app finale :

```
L'utilisateur entre dans maestro code et sélectionne l'agent "creator" :

$ maestro code --agent agent-creator-v3

  > Create an agent that translates documents between languages

  🤖 Je comprends. Quelques questions :
  ┌─ option-select ─────────────────────────────────┐
  │ Quels formats de documents ?                      │
  │ [1] Markdown  [2] PDF  [3] DOCX  [4] Tous       │
  └───────────────────────────────────────────────────┘

  > 1 et 4

  🤖 OK. Je vais créer un agent de traduction avec les composants suivants :
  ┌─ plan-view ─────────────────────────────────────┐
  │ ✅ 1. document-reader    (lire le document)     │
  │ 🔄 2. content-splitter   (découper en sections) │
  │ ⬜ 3. translator-core    (traduire)             │
  │ ⬜ 4. format-preserver   (garder le formatage)  │
  │ ⬜ 5. quality-checker    (vérifier la qualité)  │
  │ ⬜ 6. document-writer    (écrire le résultat)   │
  │ ⬜ 7. translation-agent  (orchestrateur)        │
  └─────────────────────────────────────────────────┘

  🤖 Je crée chaque composant dans une foundry session, je les entraîne,
     et je publie quand le fitness est suffisant. Ça prend quelques minutes...

  ┌─ progress ──────────────────────────────────────┐
  │ document-reader     ████████████ 0.92 ✅ published │
  │ content-splitter    ████████░░░░ 0.78 🔄 training  │
  │ translator-core     ░░░░░░░░░░░░ ⬜ pending       │
  └─────────────────────────────────────────────────┘
```

L'utilisateur ne programme JAMAIS. Il décrit ce qu'il veut, l'Agent Creator fait le reste.

---

## 2. Architecture de l'Agent Creator

### Même pattern que autonomous-dev-v3

L'Agent Creator est lui-même un bloc agent composite (`blockType: "agent"`) avec :
- Un **state manager** (état de la création : quels blocs, quel fitness, quel statut)
- Un **workflow interne** (pipeline déterministe : comprendre → planifier → créer → entraîner → publier)
- Un **interaction agent** (pour questionner l'utilisateur et gérer les interventions)

```
agent-creator-v3 (blockType: "agent", isAtomic: false)
│
├── State Manager (même workflow-state-manager, réutilisé)
│
├── Workflow interne (config.nodes)
│   ├── understand-request     ← Comprendre ce que l'utilisateur veut
│   ├── design-architecture    ← Concevoir l'architecture de l'agent (sous-blocs, flux)
│   ├── validate-design        ← Vérifier la faisabilité (modèles dispo, blocs existants)
│   ├── create-workspace       ← Créer le workspace foundry
│   ├── for-each-block         ← Pour chaque bloc à créer :
│   │   ├── generate-block-json    ← Générer le JSON du bloc
│   │   ├── create-foundry-session ← Créer la session foundry
│   │   ├── train-block            ← Invoquer le training (agent-improvement-loop)
│   │   ├── evaluate-fitness       ← Vérifier le fitness
│   │   ├── iterate-if-needed      ← Si fitness insuffisant → ajuster et réessayer
│   │   └── publish-block          ← Publier quand fitness OK
│   ├── compose-agent          ← Assembler l'agent final (orchestrateur)
│   ├── test-e2e               ← Tester l'agent complet
│   └── publish-agent          ← Publier l'agent final
│
└── Interaction Agent (réutilise interaction-handler-v3 ou variante)
    ├── Questionne l'utilisateur sur les exigences
    ├── Montre la progression via widgets
    └── Permet d'ajuster le design en cours de route
```

### Réutilisation des workflows foundry existants

L'Agent Creator ne réinvente PAS le processus foundry. Il ORCHESTRE les workflows existants :

| Workflow existant | Utilisé pour |
|-------------------|-------------|
| `foundry:agent-improvement-loop` | Entraîner chaque sous-bloc (itérations création/optimisation) |
| `foundry:tool-creation` | Créer les tool blocks |
| `foundry:block-validation` | Valider chaque bloc avant publication |
| `foundry:training-run` | Exécuter des runs de test |

---

## 3. Workflow interne — Phase par phase

### Phase 1 : Comprendre la requête (`understand-request`)

```
Agent composite (workflow interne) :
  ├── analyze-request (inference: classifier le type d'agent demandé)
  ├── identify-domain (inference: quel domaine — code, docs, traduction, data, etc.)
  ├── ask-requirements (ask-user: questions sur les détails)
  │     "Quels formats de documents ?"
  │     "Quels langages cibles ?"
  │     "Le résultat doit-il être validé par un humain ?"
  └── synthesize-requirements (inference: produire un JSON structuré)

Output dans le state :
{
  "request": {
    "type": "translator",
    "domain": "document-translation",
    "requirements": {
      "inputFormats": ["markdown"],
      "targetLanguages": ["fr", "es", "de"],
      "qualityCheck": true,
      "humanValidation": false
    }
  }
}
```

### Phase 2 : Designer l'architecture (`design-architecture`)

```
Agent composite :
  ├── identify-components (inference: quels sous-blocs sont nécessaires)
  ├── check-existing-blocks (tool: list-blocks — réutiliser des blocs existants si possible)
  ├── design-flow (inference: comment les sous-blocs se chaînent)
  ├── select-models (inference: quel modèle pour chaque bloc)
  └── produce-plan (inference: plan final avec ordre de création bottom-up)

Output dans le state :
{
  "design": {
    "blocks": [
      {
        "id": "document-reader",
        "blockType": "agent",
        "isNew": true,
        "existingRef": null,
        "nodes": ["detect-format", "read-content", "extract-sections"],
        "model": "claude-haiku",
        "estimatedComplexity": "low"
      },
      {
        "id": "translator-core",
        "blockType": "agent",
        "isNew": true,
        "nodes": ["split-into-chunks", "translate-chunk", "reassemble"],
        "model": "claude-sonnet",
        "estimatedComplexity": "high"
      }
      // ...
    ],
    "orchestrator": {
      "id": "translation-agent-v1",
      "flow": ["document-reader", "content-splitter", "translator-core",
               "format-preserver", "quality-checker", "document-writer"],
      "hasInteractionAgent": true
    },
    "creationOrder": ["document-reader", "content-splitter", "translator-core",
                      "format-preserver", "quality-checker", "document-writer",
                      "interaction-handler", "translation-agent-v1"],
    "reusableBlocks": ["file-read", "file-write", "llm-generate"]
  }
}
```

### Phase 3 : Valider le design (`validate-design`)

```
Agent composite :
  ├── check-models (tool: model-detector — les modèles sont-ils disponibles ?)
  ├── check-tools (tool: list-blocks — les outils référencés existent-ils ?)
  ├── estimate-effort (inference: combien de temps/tokens pour entraîner chaque bloc)
  ├── ask-confirmation (ask-user: montrer le plan et demander validation)
  │     Widget plan-view avec les blocs, modèles, et estimation
  │     "Voulez-vous procéder avec ce design ?"
  └── adjust-if-needed (conditional: si l'utilisateur veut des changements → rewind à design)
```

### Phase 4 : Créer le workspace (`create-workspace`)

```
Agent composite :
  ├── create-workspace (tool: maestro_cli "workspace create --name ...")
  └── log-workspace (state: enregistrer l'ID du workspace)
```

### Phase 5 : Créer chaque bloc (`for-each-block`)

C'est le cœur de l'Agent Creator. Pour chaque bloc dans `design.creationOrder` :

```
for-each sur design.creationOrder :
│
├── generate-block-json (inference)
│     Le LLM génère le block JSON complet :
│     - id, name, blockType, version
│     - inputs, outputs
│     - config.nodes (avec les nœuds internes détaillés)
│     - Prompts des nœuds inference
│     Le LLM utilise le design comme guide et les blocs existants comme exemples
│
├── write-block-file (tool: file-write)
│     Écrire le .block.json dans .maestro/blocks/
│
├── create-foundry-session (tool: maestro_cli)
│     "session create --type foundry --name train-<block-id> --start"
│     "workspace add-session <ws-id> <sid>"
│
├── train-block (invoke workflow)
│     Invoquer foundry:agent-improvement-loop sur la session foundry
│     Le workflow de training existant gère les itérations :
│     - Phase création : générer une première version
│     - Phase optimisation : raffiner les prompts
│     - Évaluation du fitness à chaque itération
│
├── evaluate-fitness (tool: read session variable currentFitness)
│     Si fitness >= seuil → continuer
│     Si fitness < seuil après max iterations → signaler
│
├── iterate-if-needed (conditional)
│     Si fitness insuffisant :
│     ├── Analyser les erreurs (inference: qu'est-ce qui ne marche pas ?)
│     ├── Ajuster le bloc (inference: modifier prompts, architecture, modèle)
│     ├── Réécrire le block JSON
│     └── Relancer le training
│     Maximum 3 tentatives majeures par bloc
│     Si toujours insuffisant → ask-user "Le bloc X n'atteint pas le seuil.
│       Score: 0.65/0.80. Voulez-vous: [1] Continuer quand même [2] Simplifier
│       [3] Changer de modèle [4] Abandonner ce bloc"
│
├── publish-block (tool: maestro_cli)
│     "block publish <block-id> --version 1.0.0"
│
└── update-progress (widget: progress)
      Mettre à jour le widget progress avec le statut de chaque bloc
```

### Phase 6 : Assembler l'agent final (`compose-agent`)

```
Agent composite :
  ├── generate-orchestrator-json (inference)
  │     Générer le block JSON de l'orchestrateur :
  │     - blockType: "agent"
  │     - config.stateManager → workflow-state-manager
  │     - config.interactionAgent → interaction-handler (créé ou réutilisé)
  │     - config.nodes → chaîner les blocs publiés dans l'ordre du flow
  │
  ├── write-orchestrator (tool: file-write)
  └── validate-orchestrator (invoke: foundry:block-validation)
```

### Phase 7 : Test E2E (`test-e2e`)

```
Agent composite :
  ├── ask-test-input (ask-user: "Donnez-moi un exemple d'input pour tester")
  │     Widget text-input
  ├── run-agent (invoke: exécuter l'agent créé avec l'input de test)
  ├── show-result (widget: message type=info avec le résultat)
  ├── ask-satisfaction (ask-user: "Le résultat est-il satisfaisant ?")
  │     Widget confirmation
  └── iterate-or-publish (conditional)
        Si satisfaisant → phase 8 (publish)
        Si non → ask-user "Qu'est-ce qui ne va pas ?" → rewind à design ou iterate
```

### Phase 8 : Publier (`publish-agent`)

```
Agent composite :
  ├── publish-orchestrator (tool: maestro_cli "block publish ...")
  ├── generate-manifest (inference: créer le manifeste de publication)
  ├── show-summary (widget: table avec tous les blocs, fitness, modèles)
  └── show-usage (widget: message
        "Votre agent est prêt ! Utilisez-le avec :
         maestro code --agent translation-agent-v1")
```

---

## 4. Modèles et intelligence

### Quel modèle pour l'Agent Creator ?

L'Agent Creator doit être capable de :
1. Comprendre des requêtes complexes en langage naturel
2. Designer des architectures de blocs multi-nœuds
3. Générer du JSON valide et complexe (block definitions)
4. Analyser les erreurs de training et proposer des corrections

**Modèle recommandé** : Claude Sonnet minimum, idéalement Claude Opus pour les phases de design et de correction. Les phases mécaniques (create-workspace, publish) n'ont pas besoin de LLM.

### Exemples de blocs existants comme contexte

Quand l'Agent Creator génère un nouveau block JSON, il devrait inclure des **exemples de blocs existants** dans le prompt pour guider le LLM. Le prompt de `generate-block-json` pourrait être :

```
Tu crées un bloc Maestro. Voici des exemples de blocs existants :

Exemple 1 — bloc agent composite (context-analyzer-v3) :
{json}

Exemple 2 — bloc agent avec boucle agentique (implement-single-step) :
{json}

Exemple 3 — bloc inference simple (code-reviewer-v3) :
{json}

Maintenant, crée le bloc suivant basé sur le design :
- ID: document-reader
- Type: agent composite
- Nœuds: detect-format → read-content → extract-sections
...
```

---

## 5. Réutilisation et généricité

### Ce que l'Agent Creator réutilise

| Composant | Source | Usage |
|-----------|--------|-------|
| `workflow-state-manager` | Phase 28-A | État partagé workflow ↔ interaction agent |
| `interaction-handler-v3` | Phase 28-A | Interaction utilisateur (ou variante simplifiée) |
| `foundry:agent-improvement-loop` | Existant | Entraîner chaque sous-bloc |
| `foundry:tool-creation` | Existant | Créer les tool blocks |
| `foundry:block-validation` | Existant | Valider avant publication |
| Widgets (`plan-view`, `progress`, etc.) | Phase 28-B | Affichage dans le mode `maestro code` |
| `model-detector` | Phase 28-INFRA | Vérifier la disponibilité des modèles |

### Ce que l'Agent Creator crée de nouveau

| Composant | Description |
|-----------|-------------|
| `understand-request` | Agent composite qui analyse la requête utilisateur |
| `design-architecture` | Agent composite qui conçoit l'architecture des blocs |
| `block-generator` | Agent composite qui génère les block JSON |
| `training-orchestrator` | Agent composite qui orchestre le training foundry |
| `agent-assembler` | Agent composite qui assemble l'agent final |

### L'Agent Creator n'est PAS spécifique au code

Il crée des agents pour N'IMPORTE QUEL domaine :
- Agent de traduction
- Agent de documentation
- Agent de data processing
- Agent de code (comme `autonomous-dev-v3`)

Le design est guidé par le LLM, pas par du code hardcodé. Litmus test : l'Agent Creator peut-il créer un agent de recettes de cuisine ? Si oui, correct.

---

## 6. Étapes d'implémentation

| # | Étape | Détail | Vérification | Statut |
|---|-------|--------|--------------|--------|
| 1 | `understand-request` bloc | Agent composite : analyze → identify-domain → ask-requirements → synthesize | JSON de requirements valide | ⬜ |
| 2 | `design-architecture` bloc | Agent composite : identify-components → check-existing → design-flow → produce-plan | Design JSON avec blocs, flow, modèles | ⬜ |
| 3 | `validate-design` bloc | check-models + check-tools + estimate-effort + ask-confirmation | Design validé par l'utilisateur | ⬜ |
| 4 | `block-generator` bloc | Génère le block JSON complet à partir du design | JSON valide avec config.nodes | ⬜ |
| 5 | `training-orchestrator` bloc | Orchestre la création de foundry session + training + evaluation | Bloc entraîné et publié | ⬜ |
| 6 | `agent-assembler` bloc | Assemble l'orchestrateur final + state manager + interaction agent | Agent complet assemblé | ⬜ |
| 7 | `agent-creator-v3` orchestrateur | Assemblage de tous les blocs ci-dessus | Agent creator fonctionnel | ⬜ |
| 8 | Test : créer un agent simple | "Create an agent that summarizes text files" | Agent créé, testé, publié | ⬜ |
| 9 | Test : créer un agent complexe | "Create an agent that translates documents" (multi-bloc) | Agent multi-bloc créé | ⬜ |
| 10 | Test : recréer autonomous-dev-v3 | Donner la Part 1 du plan 28-A à l'Agent Creator | Résultat comparable à la version manuelle | ⬜ |

---

## 7. Impact sur le flux utilisateur final

### Avant l'Agent Creator (Phase 28-A)

```
Développeur → écrit JSON → foundry manuelle → test → publish
(nécessite des compétences de développeur Maestro)
```

### Après l'Agent Creator (Phase 28-B2)

```
Utilisateur → maestro code --agent agent-creator-v3
           → "Je veux un agent qui fait X"
           → L'Agent Creator questionne, design, crée, entraîne, publie
           → "Votre agent est prêt ! Utilisez : maestro code --agent mon-agent"
(aucune compétence de programmation requise)
```

### L'Agent Creator crée des agents qui créent

Méta-niveau : l'Agent Creator pourrait se créer lui-même. C'est la composition fractale ultime. En pratique, le premier Agent Creator est créé manuellement (Phase 28-B2), mais ses versions futures pourraient être améliorées par... l'Agent Creator lui-même.

---

## 8. Gate 28-B2

| Critère | Vérification | Statut |
|---------|--------------|--------|
| `agent-creator-v3` publié | `list-blocks` montre le bloc | ⬜ |
| Design automatique fonctionne | Requête → architecture → blocs identifiés | ⬜ |
| Génération de block JSON | JSON valide avec config.nodes pour chaque bloc | ⬜ |
| Training orchestré | Foundry sessions créées et training exécuté automatiquement | ⬜ |
| Publication automatique | Blocs publiés quand fitness >= seuil | ⬜ |
| Test agent simple | "Summarize text files" → agent créé et fonctionnel | ⬜ |
| Test agent complexe | "Translate documents" → agent multi-bloc créé | ⬜ |
| Interaction utilisateur | Questions posées, design montré, confirmation demandée | ⬜ |
| Widgets utilisés | plan-view, progress, option-select pendant la création | ⬜ |
| Litmus test générique | Peut créer un agent de recettes de cuisine | ⬜ |
| Zéro logique domain-spécifique | `grep -r "code\|translate\|recipe" agent-creator-v3/` → 0 dans l'infra | ⬜ |
