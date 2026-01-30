# Guide de Création d'Agents et Tools

> **Prérequis** : Lire [MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md) pour comprendre l'idéologie du système.

## Table des Matières

1. [Comprendre la Hiérarchie](#comprendre-la-hiérarchie)
2. [Créer un Tool (Block Atomique)](#créer-un-tool)
3. [Créer un Agent (Block Composite)](#créer-un-agent)
4. [Créer un Workflow (Orchestration)](#créer-un-workflow)
5. [Entraîner et Améliorer](#entraîner-et-améliorer)
6. [Exemples Pratiques](#exemples-pratiques)

---

## Comprendre l'Architecture des Blocks

### Concept Clé : Interface vs Implémentation

**Le type d'un block définit son INTERFACE, pas son contenu.**

Un **tool** peut contenir des agents. Un **agent** peut contenir des workflows.
Tout block est une **boîte noire** - l'extérieur ne voit que l'interface.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BLOCK = BOÎTE NOIRE                            │
│                                                                     │
│   [ENTRÉE] ─────────────► [ ??? ] ─────────────► [SORTIE]          │
│                                                                     │
│   Ce qui est à l'intérieur peut être:                              │
│   - Un simple script                                                │
│   - Un agent avec un LLM                                           │
│   - Un workflow de 50 étapes                                       │
│   - 10 agents orchestrés                                           │
│   - N'importe quelle combinaison                                   │
│                                                                     │
│   L'appelant ne sait pas et n'a pas besoin de savoir!              │
└─────────────────────────────────────────────────────────────────────┘
```

### Les Types Définissent l'Interface

| Type | Interface | Ce que ça peut contenir |
|------|-----------|------------------------|
| **tool** | "Fais cette action" (input → output) | Tout: agents, workflows, scripts, autres tools |
| **agent** | "Réfléchis à cette tâche" (task → result) | Tout: tools, autres agents, workflows, atomiques |
| **workflow** | "Exécute ces étapes" (orchestration) | Tout: agents, tools, autres workflows |

### Exemple : La Puissance de l'Abstraction

```
┌─────────────────────────────────────────────────────────────────────┐
│ TOOL: "generate-commit-message"                                     │
│                                                                     │
│ Interface visible:                                                  │
│   Input:  { workingDir: string }                                   │
│   Output: { message: string }                                      │
│                                                                     │
│ Implémentation cachée:                                             │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Workflow interne:                                          │  │
│   │                                                             │  │
│   │  [Agent: diff-analyzer] → [Agent: message-writer]           │  │
│   │           │                        │                        │  │
│   │           ▼                        ▼                        │  │
│   │  [Tool: git-diff]          [Validator: format-check]        │  │
│   │                                    │                        │  │
│   │                                    ▼                        │  │
│   │                            [Tool: git-log] (pour style)     │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ Pour l'utilisateur: c'est UN tool simple                           │
│ En réalité: 2 agents, 2 tools, 1 validator orchestrés              │
└─────────────────────────────────────────────────────────────────────┘
```

### Quand Choisir Quel Type?

La question n'est pas "quelle complexité?" mais "quelle interface?"

| Je veux exposer... | Type |
|-------------------|------|
| Une action qu'on appelle (comme une fonction) | **tool** |
| Une capacité de réflexion/décision | **agent** |
| Un processus avec des étapes visibles | **workflow** |

**Exemples concrets :**

| Besoin | Choix | Pourquoi |
|--------|-------|----------|
| "Je veux un block pour générer des commits" | **tool** | L'appelant veut juste le résultat, pas les détails |
| "Je veux un développeur qui code des features" | **agent** | C'est une entité qui réfléchit et prend des décisions |
| "Je veux voir chaque étape du déploiement" | **workflow** | La visibilité du processus est importante |

### Composition Fractale

La vraie puissance vient de la composition récursive :

```
Tool "deploy-to-production"
    └── Workflow "deployment-pipeline"
            ├── Tool "run-tests"
            │       └── Agent "test-selector" (choisit quels tests)
            │               └── Tool "analyze-changes"
            ├── Agent "code-reviewer"
            │       ├── Tool "lint-code"
            │       └── Agent "security-auditor"
            └── Tool "deploy"
                    └── Workflow "blue-green-deploy"
                            ├── Agent "traffic-manager"
                            └── Validator "health-checker"
```

**De l'extérieur** : `deploy-to-production` est un simple tool.
**De l'intérieur** : Architecture complexe de ~10 composants.
**Pour l'utilisateur** : Il appelle juste `deploy-to-production` sans se soucier du reste.

---

## Créer un Tool

### Structure d'un Tool

```
blocks/tools/
└── mon-tool.tool.block.json
```

### Template de Base

```json
{
  "id": "mon-tool",
  "name": "Mon Tool",
  "version": "1.0.0",
  "blockType": "tool",
  "description": "Description claire de ce que fait le tool",

  "inputs": [
    {
      "name": "parametre1",
      "type": "string",
      "required": true,
      "description": "Description du paramètre"
    }
  ],

  "outputs": [
    {
      "name": "result",
      "type": "string",
      "description": "Le résultat de l'opération"
    }
  ],

  "config": {
    "command": "commande à exécuter",
    "workingDir": "${inputs.workingDir}",
    "timeout": 30000
  }
}
```

### Exemple : Tool de Lecture de Fichier

```json
{
  "id": "file-read",
  "name": "File Read",
  "version": "1.0.0",
  "blockType": "tool",
  "description": "Lit le contenu d'un fichier",

  "inputs": [
    {
      "name": "path",
      "type": "string",
      "required": true,
      "description": "Chemin du fichier à lire"
    },
    {
      "name": "encoding",
      "type": "string",
      "required": false,
      "default": "utf-8",
      "description": "Encodage du fichier"
    }
  ],

  "outputs": [
    {
      "name": "content",
      "type": "string",
      "description": "Contenu du fichier"
    },
    {
      "name": "size",
      "type": "number",
      "description": "Taille en bytes"
    }
  ],

  "config": {
    "type": "file-operation",
    "operation": "read"
  }
}
```

### Bonnes Pratiques pour les Tools

1. **Un tool = une action** : Pas de logique complexe
2. **Déterministe** : Même input → même output
3. **Erreurs claires** : Messages d'erreur explicites
4. **Timeout** : Toujours définir un timeout
5. **Validation** : Valider les inputs avant exécution

---

## Créer un Agent

### Structure d'un Agent

```
blocks/agents/
└── mon-agent.agent.block.json
```

### Template de Base

```json
{
  "id": "mon-agent",
  "name": "Mon Agent",
  "version": "1.0.0",
  "blockType": "agent",
  "description": "Description de la spécialisation de l'agent",

  "inputs": [
    {
      "name": "task",
      "type": "string",
      "required": true,
      "description": "La tâche à accomplir"
    },
    {
      "name": "workingDir",
      "type": "string",
      "required": true,
      "description": "Répertoire de travail"
    }
  ],

  "outputs": [
    {
      "name": "result",
      "type": "string",
      "description": "Résultat de l'exécution"
    },
    {
      "name": "success",
      "type": "boolean",
      "description": "Indicateur de succès"
    }
  ],

  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxTokens": 1024,
    "maxSteps": 10,
    "temperature": 0.7,

    "systemPrompt": "Tu es un agent spécialisé dans [DOMAINE]...",

    "tools": [
      "file-read",
      "file-write",
      "shell-execute"
    ]
  },

  "capabilities": ["coding", "file-operations"],
  "tags": ["development"]
}
```

### Le System Prompt : Clé de la Spécialisation

Le system prompt est **crucial** pour la performance d'un agent. Il doit :

1. **Définir le rôle clairement**
2. **Donner des instructions précises**
3. **Fournir des exemples**
4. **Spécifier le format de sortie**

#### Exemple de System Prompt Efficace

```
Tu es un agent spécialisé dans la génération de messages de commit Git.

RÈGLES:
1. Format: <type>(<scope>): <description>
2. Types valides: feat, fix, docs, style, refactor, test, chore
3. Description en anglais, impératif, < 72 caractères
4. Pas de point final

EXEMPLES:
- feat(auth): add OAuth2 login support
- fix(api): handle null response from server
- docs(readme): update installation instructions

PROCESSUS:
1. Analyser le diff fourni
2. Identifier le type de changement
3. Déterminer le scope (fichiers/modules affectés)
4. Rédiger une description concise

Tu dois TOUJOURS utiliser l'outil git-diff pour voir les changements avant de générer le message.
```

### Choix du Modèle

| Tâche | Modèle Recommandé | Raison |
|-------|-------------------|--------|
| Code simple | deepseek-coder-1.3b | Léger, rapide, bon pour code |
| Raisonnement | phi-3-mini | Bon pour logique |
| Texte général | llama-3.2-3b | Polyvalent |
| Tâches complexes | mistral-7b | Plus de capacité |

**Principe** : Commencer avec le plus petit modèle possible, augmenter seulement si nécessaire.

### Exemple : Agent Générateur de Commit

```json
{
  "id": "commit-message-generator",
  "name": "Commit Message Generator",
  "version": "1.0.0",
  "blockType": "agent",
  "description": "Génère des messages de commit conventionnels basés sur les changements",

  "inputs": [
    {
      "name": "workingDir",
      "type": "string",
      "required": true,
      "description": "Répertoire Git"
    }
  ],

  "outputs": [
    {
      "name": "message",
      "type": "string",
      "description": "Message de commit généré"
    },
    {
      "name": "type",
      "type": "string",
      "description": "Type de commit (feat, fix, etc.)"
    }
  ],

  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxTokens": 256,
    "maxSteps": 3,
    "temperature": 0.3,

    "systemPrompt": "Tu es un expert en messages de commit Git...[voir exemple ci-dessus]",

    "tools": [
      "git-diff",
      "git-status"
    ]
  },

  "capabilities": ["git", "commit-generation"],
  "tags": ["git", "automation"]
}
```

### Bonnes Pratiques pour les Agents

1. **Spécialisation étroite** : Un agent = un domaine
2. **Peu de tools** : 3-5 tools maximum
3. **System prompt détaillé** : Plus c'est précis, meilleur est le résultat
4. **Petit modèle d'abord** : Optimiser pour le coût
5. **Exemples dans le prompt** : Le LLM apprend par l'exemple
6. **maxSteps limité** : Éviter les boucles infinies

---

## Créer un Workflow

### Structure d'un Workflow

```
blocks/workflows/
└── mon-workflow.workflow.block.json
```

### Template de Base

```json
{
  "id": "mon-workflow",
  "name": "Mon Workflow",
  "version": "1.0.0",
  "blockType": "workflow",
  "description": "Description de ce que le workflow accomplit",

  "inputs": [
    {
      "name": "task",
      "type": "string",
      "required": true,
      "description": "Tâche à accomplir"
    }
  ],

  "outputs": [
    {
      "name": "result",
      "type": "object",
      "description": "Résultat final du workflow"
    }
  ],

  "config": {
    "nodes": [
      {
        "id": "step1",
        "blockRef": "agent-1",
        "name": "Étape 1"
      },
      {
        "id": "step2",
        "blockRef": "agent-2",
        "name": "Étape 2"
      }
    ],

    "connections": [
      {
        "from": "step1",
        "to": "step2"
      }
    ],

    "entryPoint": "step1"
  }
}
```

### Exemple : Workflow de Développement Autonome

```json
{
  "id": "autonomous-task",
  "name": "Autonomous Task Workflow",
  "version": "1.0.0",
  "blockType": "workflow",
  "description": "Exécute une tâche de développement de manière autonome",

  "inputs": [
    {
      "name": "task",
      "type": "string",
      "required": true
    },
    {
      "name": "workingDir",
      "type": "string",
      "required": true
    }
  ],

  "config": {
    "nodes": [
      {
        "id": "decompose",
        "blockRef": "task-decomposer",
        "name": "Décomposer la tâche",
        "inputs": {
          "task": "${workflow.inputs.task}"
        }
      },
      {
        "id": "develop",
        "blockRef": "code-developer",
        "name": "Développer",
        "inputs": {
          "subtask": "${decompose.outputs.subtasks[0]}",
          "workingDir": "${workflow.inputs.workingDir}"
        }
      },
      {
        "id": "validate",
        "blockRef": "result-validator",
        "name": "Valider le résultat",
        "inputs": {
          "code": "${develop.outputs.code}",
          "task": "${decompose.outputs.subtasks[0]}"
        }
      },
      {
        "id": "commit",
        "blockRef": "commit-message-generator",
        "name": "Générer commit",
        "inputs": {
          "workingDir": "${workflow.inputs.workingDir}"
        }
      }
    ],

    "connections": [
      { "from": "decompose", "to": "develop" },
      { "from": "develop", "to": "validate" },
      { "from": "validate", "to": "commit", "condition": "success" },
      { "from": "validate", "to": "develop", "condition": "failure" }
    ],

    "entryPoint": "decompose"
  }
}
```

### Patterns de Workflow

#### Pattern 1 : Séquentiel Simple
```
[A] → [B] → [C] → [Résultat]
```

#### Pattern 2 : Avec Validation
```
[Exécuter] → [Valider] → Success → [Finaliser]
                 │
                 └→ Failure → [Corriger] → [Valider]
```

#### Pattern 3 : Parallèle puis Fusion
```
     ┌→ [Agent A] ─┐
[Start] → [Agent B] ─┼→ [Fusionner] → [Résultat]
     └→ [Agent C] ─┘
```

#### Pattern 4 : Orchestrateur Central
```
              ┌→ [Agent Spécialisé 1]
[Orchestrateur] → [Agent Spécialisé 2] → [Orchestrateur] → ...
              └→ [Agent Spécialisé 3]
```

---

## Entraîner et Améliorer

### Cycle d'Entraînement

```
┌─────────────────────────────────────────────────────────┐
│  1. BASELINE                                            │
│     Exécuter l'agent/workflow sur des cas de test       │
│     Mesurer: succès, qualité, coût                      │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  2. ANALYSE                                             │
│     Identifier les échecs et faiblesses                 │
│     Comprendre pourquoi                                 │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  3. AMÉLIORATION                                        │
│     Ajuster system prompt, tools, ou structure          │
│     Créer nouvelle version                              │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  4. VALIDATION                                          │
│     Re-tester sur les mêmes cas                         │
│     Comparer avec baseline                              │
└────────────────────────┬────────────────────────────────┘
                         ▼
                   [Retour à 1 si besoin]
```

### Utiliser le Système de Training

```bash
# 1. Créer une configuration d'entraînement
maestro training configs create \
  --name "Train Commit Generator" \
  --workflow commit-message-generator \
  --iterations 10 \
  --goal quality

# 2. Lancer l'entraînement
maestro training start {CONFIG_ID}

# 3. Suivre la progression
maestro training runs {RUN_ID}

# 4. Analyser les métriques
maestro metrics training-run {RUN_ID}
```

### Critères d'Évaluation

| Critère | Description | Poids Suggéré |
|---------|-------------|---------------|
| Completion | Tâche terminée? | 30% |
| Quality | Qualité du résultat | 40% |
| Efficiency | Tokens/temps utilisés | 20% |
| Safety | Pas d'erreurs dangereuses | 10% |

---

## Exemples Pratiques

### Exemple 1 : Agent Simple (Débutant)

**Objectif** : Agent qui liste les fichiers TODO dans un projet

```json
{
  "id": "todo-finder",
  "name": "TODO Finder",
  "version": "1.0.0",
  "blockType": "agent",
  "description": "Trouve tous les TODO et FIXME dans le code",

  "inputs": [
    { "name": "directory", "type": "string", "required": true }
  ],

  "outputs": [
    { "name": "todos", "type": "array", "description": "Liste des TODO trouvés" }
  ],

  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxTokens": 512,
    "maxSteps": 5,

    "systemPrompt": "Tu recherches les TODO et FIXME dans le code. Utilise code-search pour chercher, puis formate les résultats en liste.",

    "tools": ["code-search", "file-read"]
  }
}
```

### Exemple 2 : Agent Intermédiaire

**Objectif** : Agent qui crée un test unitaire pour une fonction

```json
{
  "id": "test-generator",
  "name": "Test Generator",
  "version": "1.0.0",
  "blockType": "agent",
  "description": "Génère des tests unitaires pour une fonction donnée",

  "inputs": [
    { "name": "functionPath", "type": "string", "required": true },
    { "name": "testFramework", "type": "string", "default": "jest" }
  ],

  "outputs": [
    { "name": "testCode", "type": "string" },
    { "name": "testPath", "type": "string" }
  ],

  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxTokens": 1024,
    "maxSteps": 8,

    "systemPrompt": "Tu es un expert en tests unitaires. Tu analyses une fonction et génères des tests complets couvrant:\n- Cas nominal\n- Cas limites\n- Cas d'erreur\n\nFormat: Framework spécifié dans l'input.",

    "tools": ["file-read", "file-write", "code-search"]
  }
}
```

### Exemple 3 : Workflow Avancé

**Objectif** : Workflow complet de code review automatique

```json
{
  "id": "auto-code-review",
  "name": "Automatic Code Review",
  "version": "1.0.0",
  "blockType": "workflow",

  "config": {
    "nodes": [
      {
        "id": "analyze",
        "blockRef": "code-analyzer",
        "name": "Analyser le code"
      },
      {
        "id": "security",
        "blockRef": "security-checker",
        "name": "Vérifier sécurité"
      },
      {
        "id": "style",
        "blockRef": "style-checker",
        "name": "Vérifier style"
      },
      {
        "id": "synthesize",
        "blockRef": "review-synthesizer",
        "name": "Synthétiser"
      }
    ],

    "connections": [
      { "from": "analyze", "to": "security" },
      { "from": "analyze", "to": "style" },
      { "from": "security", "to": "synthesize" },
      { "from": "style", "to": "synthesize" }
    ]
  }
}
```

---

## Checklist de Création

### Pour un Tool
- [ ] ID unique et descriptif
- [ ] Description claire
- [ ] Inputs avec types et descriptions
- [ ] Outputs documentés
- [ ] Timeout défini
- [ ] Gestion d'erreurs

### Pour un Agent
- [ ] Spécialisation claire (un domaine)
- [ ] System prompt détaillé avec exemples
- [ ] Tools nécessaires seulement (3-5 max)
- [ ] Modèle approprié (petit d'abord)
- [ ] maxSteps raisonnable
- [ ] Tests de base effectués

### Pour un Workflow
- [ ] Étapes bien définies
- [ ] Connections logiques
- [ ] Gestion des erreurs (retry, fallback)
- [ ] Validations entre étapes
- [ ] EntryPoint défini
- [ ] Test end-to-end

---

## Ressources

- [MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md) - Comprendre la vision
- [blocks/](../../blocks/) - Exemples existants
- [API Documentation](../api/) - Référence technique

---

*Commencez simple, itérez souvent, spécialisez toujours.*
