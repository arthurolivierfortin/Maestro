# Guide Complet de Création et Optimisation d'Agents Maestro

## Table des Matières

1. [Introduction](#1-introduction)
2. [Architecture Fondamentale](#2-architecture-fondamentale)
3. [Création de Tools](#3-création-de-tools)
   - [3.4 Principe Fondamental: Tools = Commandes Shell](#34-principe-fondamental-tools--commandes-shell)
4. [Création d'Agents](#4-création-dagents)
5. [Pipeline d'Entraînement](#5-pipeline-dentraînement)
6. [Sandbox et Tests](#6-sandbox-et-tests)
7. [Quantification et Métriques](#7-quantification-et-métriques)
8. [Anti-Patterns - CE QU'IL NE FAUT PAS FAIRE](#8-anti-patterns---ce-quil-ne-faut-pas-faire)
   - [8.8 Anti-Pattern #8: Implémenter les Tools dans le Backend](#88-anti-pattern-8-implémenter-les-tools-dans-le-backend)
9. [Workflow Complet CLI](#9-workflow-complet-cli)
10. [Optimisation Continue](#10-optimisation-continue)

---

## 1. Introduction

### 1.1 Philosophie Maestro

Maestro suit une philosophie de **composition déclarative** où chaque fonctionnalité est un **bloc réutilisable, versionné et mesurable**. L'objectif est de créer un écosystème où:

- **Tools** sont des unités atomiques spécialisées
- **Agents** orchestrent les tools pour accomplir des objectifs complexes
- **Workflows** composent agents et tools en pipelines
- **Métriques** quantifient tout pour l'amélioration continue

### 1.2 Hiérarchie des Composants

```
┌─────────────────────────────────────────────────────────────┐
│                     WORKFLOWS                                │
│    (Composent agents et tools en pipelines complexes)       │
├─────────────────────────────────────────────────────────────┤
│                      AGENTS                                  │
│  (Orchestrateurs autonomes qui utilisent tools + décisions) │
├─────────────────────────────────────────────────────────────┤
│                       TOOLS                                  │
│     (Unités atomiques avec schémas stricts d'I/O)           │
├─────────────────────────────────────────────────────────────┤
│                       BLOCKS                                 │
│    (Fondation: prompt, inference, command, decision...)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Fondamentale

### 2.1 Types de Blocs Disponibles

| Type | Atomique | Description | Cas d'Usage |
|------|----------|-------------|-------------|
| `prompt` | Oui | Template de prompt avec variables | Prompts réutilisables |
| `instruction` | Oui | Charge du contenu depuis fichiers | Instructions système |
| `command` | Oui | Exécute bash/git/filesystem | Opérations système |
| `decision` | Oui | Branchement conditionnel | Logique de contrôle |
| `validator` | Oui | Valide outputs (schema/regex/LLM) | Qualité des résultats |
| `trigger` | Oui | Déclenche workflows | Webhooks, schedules |
| `inference` | Oui | Appels LLM bas niveau | Génération de texte |
| `script` | Oui | Code arbitraire | Logique custom |
| `workflow` | Non | Conteneur de blocs | Pipelines complexes |
| `task` | Non | Sous-tâche avec validation | Étapes validées |

### 2.2 Tool vs Agent - Distinctions Clés

| Aspect | Tool | Agent |
|--------|------|-------|
| **Autonomie** | Basse - tâche unique | Haute - prend des décisions |
| **Input** | Schéma strict (JSON Schema) | Flexible (objectifs) |
| **État** | Stateless | Peut maintenir un état |
| **Usage** | Utilisé PAR agents | UTILISE tools + agents |
| **Scoring** | Succès, vitesse, coût | Complétion, efficacité, qualité |
| **Exemple** | `git-status`, `file-read` | `code-developer`, `task-decomposer` |

---

## 3. Création de Tools

### 3.1 Structure d'un Tool

Un tool est un bloc avec:
- **Schéma d'entrée strict** (JSON Schema)
- **Schéma de sortie strict** (JSON Schema)
- **Une seule responsabilité**
- **Métriques automatiques**

### 3.2 Exemple: Créer un Tool de Génération LLM

**Fichier**: `blocks/tools/llm-generate.tool.block.json`

```json
{
  "id": "llm-generate",
  "name": "LLM Generate",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Génère du texte via LLM avec paramètres configurables",

  "inputs": [
    {
      "id": "prompt",
      "name": "Prompt",
      "type": "string",
      "required": true,
      "description": "Le prompt à envoyer au modèle"
    },
    {
      "id": "maxTokens",
      "name": "Max Tokens",
      "type": "number",
      "required": false,
      "default": 800
    },
    {
      "id": "temperature",
      "name": "Temperature",
      "type": "number",
      "required": false,
      "default": 0.7
    },
    {
      "id": "systemPrompt",
      "name": "System Prompt",
      "type": "string",
      "required": false
    }
  ],

  "outputs": [
    {
      "id": "generatedText",
      "name": "Generated Text",
      "type": "string"
    },
    {
      "id": "tokensUsed",
      "name": "Tokens Used",
      "type": "number"
    },
    {
      "id": "success",
      "name": "Success",
      "type": "boolean"
    },
    {
      "id": "error",
      "name": "Error",
      "type": "string"
    }
  ],

  "config": {
    "toolType": "llm",
    "operation": "generate",
    "endpoint": "http://localhost:8000/v1/generate"
  },

  "metadata": {
    "category": "llm",
    "tags": ["llm", "generation", "inference"],
    "author": "maestro-team",
    "createdAt": "2026-01-28T00:00:00Z",
    "updatedAt": "2026-01-28T00:00:00Z"
  }
}
```

### 3.3 Créer un Tool via CLI

```bash
# Créer un nouveau tool
maestro tools create \
  --name "Code Extractor" \
  --block inference-block-id \
  --description "Extrait du code depuis des réponses LLM" \
  --category "parsing" \
  --tags "code,extraction,parsing"

# Vérifier la création
maestro tools info code-extractor

# Voir les métriques (initialement vides)
maestro tools metrics code-extractor
```

### 3.4 Principe Fondamental: Tools = Commandes Shell

**⚠️ RÈGLE CRITIQUE**: Les tools doivent utiliser des **commandes shell** (PowerShell/bash) plutôt que du code backend personnalisé.

#### Pourquoi?

| Approche | Avantages | Inconvénients |
|----------|-----------|---------------|
| **Commandes Shell** ✅ | Portable, testable, pas de compilation, facile à débugger | Syntaxe shell à connaître |
| **Code Backend** ❌ | Typage fort | Compilation requise, couplage fort, difficile à modifier |

#### Comment ça fonctionne?

Les tools utilisent le format `command` + `args` avec **substitution de templates** `{{inputName}}`:

```json
{
  "id": "directory-list",
  "name": "Directory List",
  "blockType": "tool",
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Name"],
    "timeout": 30000
  }
}
```

Le backend remplace automatiquement `{{path}}` par la valeur de l'input `path`.

#### Exemples de Tools avec Shell

**1. Lister un répertoire (PowerShell)**:
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Name | ForEach-Object { $_ }"]
  }
}
```

**2. Recherche de code (PowerShell)**:
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Recurse -File | Select-String -Pattern '{{pattern}}' | ForEach-Object { $_.Path + ':' + $_.LineNumber + ': ' + $_.Line }"]
  }
}
```

**3. Exécuter des tests (PowerShell)**:
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "Set-Location '{{workingDir}}'; npm test -- --run"]
  }
}
```

**4. Appel API REST (PowerShell)**:
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "$body = @{ prompt = '{{prompt}}'; max_new_tokens = 800 } | ConvertTo-Json; Invoke-RestMethod -Uri 'http://localhost:8000/v1/generate' -Method Post -Body $body -ContentType 'application/json' | Select-Object -ExpandProperty generated_text"]
  }
}
```

**5. Commande Git (bash/PowerShell)**:
```json
{
  "config": {
    "command": "git",
    "args": ["diff", "--stat", "{{branch}}"]
  }
}
```

#### Templates Disponibles

| Syntaxe | Description |
|---------|-------------|
| `{{inputName}}` | Remplacé par la valeur de l'input correspondant |
| Valeurs imbriquées | Non supportées (utiliser des inputs séparés) |

#### Bonnes Pratiques Shell

1. **Utiliser PowerShell sur Windows** - Plus puissant que cmd.exe
2. **Gérer les espaces dans les chemins** - Toujours utiliser des quotes: `'{{path}}'`
3. **Éviter les caractères spéciaux** - Échapper ou utiliser des quotes appropriées
4. **Tester la commande manuellement** - Vérifier dans un terminal avant de créer le tool
5. **Utiliser `-ErrorAction SilentlyContinue`** - Pour éviter les erreurs non critiques

#### Anti-Pattern: Implémenter dans le Backend

**❌ MAUVAIS** - Ajouter du code C# pour chaque tool:
```csharp
// NE PAS FAIRE - Code backend personnalisé
if (toolType == "myCustomTool")
{
    return HandleMyCustomToolAsync(inputs);
}
```

**✅ BON** - Définir le tool avec une commande shell:
```json
{
  "config": {
    "command": "powershell",
    "args": ["-Command", "... commande shell ..."]
  }
}
```

### 3.5 Tools Existants à Réutiliser

Avant de créer un nouveau tool, vérifiez les existants:

```bash
# Lister tous les tools
maestro tools

# Filtrer par catégorie
maestro tools --category git
maestro tools --category filesystem
```

**Tools Git**: `git-status`, `git-diff`, `git-log`, `git-commit`
**Tools Filesystem**: `file-read`, `file-write`
**Tools Shell**: `shell-execute`

---

## 4. Création d'Agents

### 4.1 Structure d'un Agent

```json
{
  "id": "my-agent",
  "name": "Mon Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Description de ce que fait l'agent",

  "inputs": [
    {
      "id": "task",
      "name": "Task",
      "type": "string",
      "required": true,
      "description": "L'objectif à accomplir"
    },
    {
      "id": "workingDir",
      "name": "Working Directory",
      "type": "string",
      "required": true
    },
    {
      "id": "context",
      "name": "Context",
      "type": "string",
      "required": false
    }
  ],

  "outputs": [
    {
      "id": "result",
      "name": "Result",
      "type": "string"
    },
    {
      "id": "success",
      "name": "Success",
      "type": "boolean"
    },
    {
      "id": "filesModified",
      "name": "Files Modified",
      "type": "array"
    }
  ],

  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxSteps": 10,
    "maxTokens": 10000,
    "temperature": 0.7,
    "timeoutMs": 300000,
    "requireApproval": false,
    "tools": ["file-read", "file-write", "shell-execute", "git-status"],
    "systemPrompt": "Tu es un développeur expert. Ta tâche: {{task}}\n\nOutils disponibles:\n- file-read: Lire des fichiers\n- file-write: Écrire des fichiers\n- shell-execute: Exécuter des commandes\n- git-status: Vérifier l'état git\n\nApproche méthodique:\n1. Analyser la tâche\n2. Lire les fichiers nécessaires\n3. Planifier les modifications\n4. Exécuter les changements\n5. Valider le résultat"
  },

  "capabilities": ["code-generation", "file-manipulation", "git-operations"],

  "metadata": {
    "category": "development",
    "tags": ["agent", "code", "autonomous"],
    "author": "maestro-team"
  }
}
```

### 4.2 Créer un Agent via CLI

```bash
# Créer un agent
maestro agents create \
  --name "UI Developer" \
  --block workflow-id \
  --description "Développe des interfaces utilisateur" \
  --version "1.0.0" \
  --category "development" \
  --capabilities "ui-development,css,html,typescript" \
  --tools "file-read,file-write,shell-execute" \
  --tags "ui,frontend,agent"

# Vérifier
maestro agents info ui-developer

# Voir les tools disponibles pour cet agent
maestro agents tools ui-developer
```

### 4.3 Fonctions d'Agent Prédéfinies

Maestro propose des templates de rôles:

| Fonction | Catégorie | Capabilities | Tools Requis |
|----------|-----------|--------------|--------------|
| **Planner** | Development | planning, task-decomposition | file-read, search |
| **Coder** | Development | code-generation, refactoring | file-read, file-write, search |
| **Reviewer** | QA | code-review, security-review | file-read, search |
| **Tester** | QA | test-generation, test-execution | file-read, file-write, bash |
| **Debugger** | Development | bug-diagnosis, fix-generation | file-read, file-write, bash |
| **Documenter** | Development | documentation, api-docs | file-read, file-write |
| **Researcher** | Research | research, analysis | web-search, file-read |
| **Deployer** | Operations | deployment, configuration | bash, docker |

---

## 5. Pipeline d'Entraînement

### 5.1 Vue d'Ensemble du Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                    PIPELINE D'ENTRAÎNEMENT                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. CRÉER          2. CONFIGURER      3. EXÉCUTER                │
│  ┌─────────┐       ┌─────────┐       ┌─────────┐                 │
│  │  Tool/  │  ──►  │Training │  ──►  │ Runs    │                 │
│  │  Agent  │       │ Config  │       │ Batch   │                 │
│  └─────────┘       └─────────┘       └─────────┘                 │
│                          │                │                       │
│                          ▼                ▼                       │
│                    4. ANALYSER       5. OPTIMISER                 │
│                    ┌─────────┐       ┌─────────┐                 │
│                    │Metrics &│  ──►  │ Ajuster │                 │
│                    │ Scores  │       │ Prompts │                 │
│                    └─────────┘       └─────────┘                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Étape 1: Créer le Tool/Agent

```bash
# Créer le tool de base
maestro tools create --name "Code Generator" --block inference-001 \
  --category "generation"

# Ou créer l'agent
maestro agents create --name "Dev Agent" --block workflow-001 \
  --tools "file-read,file-write,code-generator" \
  --category "development"
```

### 5.3 Étape 2: Créer une Configuration d'Entraînement

```bash
# Créer une config d'entraînement
maestro training create \
  --name "Quality Optimization" \
  --workflow autonomous-task-workflow \
  --iterations 100 \
  --parallel 5 \
  --goal quality \
  --delay 1000 \
  --description "Optimisation de la qualité du code généré" \
  --tags "quality,code-generation,optimization"

# Vérifier la config
maestro training info cfg-001
```

**Options de goal**:
- `quality` - Optimise le score de qualité
- `cost` - Minimise le coût en tokens
- `speed` - Minimise le temps d'exécution

### 5.4 Étape 3: Lancer l'Entraînement

```bash
# Démarrer l'entraînement
maestro training start cfg-001 \
  --name "Run 2026-01-28" \
  --inputs '{"task": "Implémenter une fonction de tri", "projectPath": "/test/sandbox"}'

# Suivre la progression
maestro training runs --config cfg-001

# Détails d'un run spécifique
maestro training run run-001
```

### 5.5 Étape 4: Contrôler l'Exécution

```bash
# Pause si nécessaire
maestro training pause run-001

# Reprendre
maestro training resume run-001

# Annuler si problème
maestro training cancel run-001
```

### 5.6 Étape 5: Analyser les Résultats

```bash
# Voir les métriques globales
maestro metrics summary --from 2026-01-01 --to 2026-01-28

# Métriques par workflow
maestro metrics --workflow autonomous-task-workflow

# Métriques de l'agent
maestro agents metrics dev-agent

# Métriques du tool
maestro tools metrics code-generator

# Leaderboard
maestro foundry leaderboard --limit 20
```

---

## 6. Sandbox et Tests

### 6.1 Principe du Sandbox

Un sandbox est un **environnement isolé** pour tester agents et tools sans affecter les vrais projets:

```
┌────────────────────────────────────────────────┐
│                   SANDBOX                       │
├────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐  │
│  │  Projet Cloné / Mock Repository          │  │
│  │  - Fichiers de test                      │  │
│  │  - Git initialisé                        │  │
│  │  - Environnement isolé                   │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │    Agent     │  │    Tool      │            │
│  │   en test    │  │   en test    │            │
│  └──────────────┘  └──────────────┘            │
│                                                 │
│  Métriques: temps, tokens, succès, qualité     │
└────────────────────────────────────────────────┘
```

### 6.2 Créer un Environnement Sandbox

```bash
# Créer un projet sandbox
maestro projects create \
  --name "test-sandbox" \
  --path "C:/test-sandbox" \
  --runtime process \
  --description "Environnement de test isolé"

# Initialiser avec des fichiers de test
mkdir C:/test-sandbox/src
echo "// Test file" > C:/test-sandbox/src/main.ts
cd C:/test-sandbox && git init && git add . && git commit -m "Initial"
```

### 6.3 Exécuter des Tests en Sandbox

```bash
# Exécuter un workflow dans le sandbox
maestro execute autonomous-task \
  --input task="Ajouter une fonction hello world" \
  --input projectPath="C:/test-sandbox" \
  --working-dir "C:/test-sandbox"

# Exécuter un tool spécifique
maestro run file-read \
  --input path="C:/test-sandbox/src/main.ts"

# Test avec mock (offline)
maestro execute my-workflow --mock
```

### 6.4 Valider les Résultats

```bash
# Vérifier les changements
cd C:/test-sandbox && git diff

# Exécuter des validateurs
maestro run validator-block \
  --input content="$(cat C:/test-sandbox/src/main.ts)" \
  --input schema='{"type": "string", "minLength": 10}'
```

### 6.5 Automatiser les Tests

Créez un workflow de test:

```json
{
  "id": "tool-test-workflow",
  "name": "Tool Test Suite",
  "blockType": "workflow",
  "config": {
    "nodes": [
      {
        "id": "setup",
        "blockRef": "tools/shell-execute",
        "inputs": {
          "command": "mkdir -p /tmp/test && echo 'test' > /tmp/test/file.txt"
        }
      },
      {
        "id": "test-read",
        "blockRef": "tools/file-read",
        "inputs": {
          "path": "/tmp/test/file.txt"
        }
      },
      {
        "id": "validate",
        "blockRef": "blocks/validator",
        "inputs": {
          "content": "{{test-read.content}}",
          "expected": "test"
        }
      },
      {
        "id": "cleanup",
        "blockRef": "tools/shell-execute",
        "inputs": {
          "command": "rm -rf /tmp/test"
        }
      }
    ]
  }
}
```

---

## 7. Quantification et Métriques

### 7.1 Métriques des Tools

| Métrique | Description | Formule |
|----------|-------------|---------|
| **Success Rate** | % d'exécutions réussies | successful / total * 100 |
| **Avg Execution Time** | Temps moyen en ms | sum(time) / count |
| **Avg Token Cost** | Coût moyen en tokens | sum(tokens) / count |
| **Avg Score** | Score qualité moyen (0-100) | sum(scores) / count |
| **Overall Score** | Score pondéré | (success*0.4)+(speed*0.2)+(cost*0.2)+(quality*0.2) |

### 7.2 Métriques des Agents

| Métrique | Description | Formule |
|----------|-------------|---------|
| **Completion Rate** | % de tâches complétées | completed / total * 100 |
| **Avg Steps Per Run** | Étapes moyennes | sum(steps) / count |
| **Avg Tools Used** | Tools utilisés en moyenne | sum(tools_used) / count |
| **Task Completion Score** | Score de complétion (0-100) | évaluation qualitative |
| **Efficiency Score** | Efficacité | optimal_steps / actual_steps * 100 |
| **Quality Score** | Qualité du résultat (0-100) | évaluation qualitative |
| **Overall Score** | Score pondéré | (completion*0.35)+(task*0.20)+(efficiency*0.25)+(quality*0.20) |

### 7.3 Consulter les Métriques via CLI

```bash
# Vue d'ensemble Foundry
maestro foundry

# Leaderboard global
maestro foundry leaderboard --limit 10

# Métriques d'un agent spécifique
maestro agents metrics my-agent

# Métriques d'un tool spécifique
maestro tools metrics my-tool

# Historique des exécutions
maestro runs --limit 50

# Détail d'une exécution
maestro runs info exec-123

# Résumé des métriques avec filtres
maestro metrics summary \
  --from 2026-01-01 \
  --to 2026-01-28 \
  --workflow my-workflow
```

### 7.4 Interpréter les Scores

| Score | Interprétation | Action |
|-------|----------------|--------|
| 90-100 | Excellent | Maintenir |
| 70-89 | Bon | Optimisation mineure |
| 50-69 | Acceptable | Améliorer prompts/tools |
| 30-49 | Insuffisant | Revoir l'architecture |
| 0-29 | Critique | Reconstruire |

### 7.5 Benchmarking de Performance

```bash
# Vérifier le statut LLM
maestro llm

# Les benchmarks sont disponibles via l'API Performance
# GET /api/performance/benchmarks
# POST /api/performance/benchmarks/{modelId}
```

**Métriques de benchmark**:
- **Tokens/second** - Débit du modèle
- **Time to First Token (TTFT)** - Latence initiale
- **Total Time** - Temps total de génération

---

## 8. Anti-Patterns - CE QU'IL NE FAUT PAS FAIRE

### 8.1 Anti-Pattern #1: Script Monolithique avec Fonctions

**MAUVAIS** - Ce que Cantante a fait:

```python
# autonomous-dev.py - NE PAS FAIRE
def generate_code(prompt, max_tokens=800):
    """Fonction directe au lieu d'un tool"""
    response = requests.post(LLM_URL, json={...})
    return response.json()

def read_file(path):
    """Duplique file-read tool existant"""
    with open(path) as f:
        return f.read()

def write_file(path, content):
    """Duplique file-write tool existant"""
    with open(path, 'w') as f:
        f.write(content)

def task_add_feature():
    """Logique d'orchestration codée en dur"""
    content = read_file("src/main.ts")
    response = generate_code(f"Modify: {content}")
    write_file("src/main.ts", response)
```

**Problèmes**:
- ❌ Pas de métriques (succès, temps, coût)
- ❌ Pas découvrable par les agents
- ❌ Pas versionné
- ❌ Duplique les tools existants
- ❌ Pas réutilisable
- ❌ Pas testable en isolation

**BON** - L'approche Maestro:

```bash
# 1. Utiliser les tools existants
maestro tools  # Voir file-read, file-write existent déjà

# 2. Créer un tool pour la génération
maestro tools create --name "code-generator" --block inference-001

# 3. Créer un agent qui utilise ces tools
maestro agents create --name "feature-adder" \
  --tools "file-read,file-write,code-generator" \
  --capabilities "code-modification"
```

### 8.2 Anti-Pattern #2: Hardcoder les Chemins et Configurations

**MAUVAIS**:
```python
LLM_URL = "http://localhost:8000/v1/generate"  # Hardcodé
file_path = "C:/Projects/myproject/src/main.ts"  # Hardcodé
```

**BON**:
```json
{
  "inputs": [
    {"id": "workingDir", "type": "string", "required": true},
    {"id": "filePath", "type": "string", "required": true}
  ],
  "config": {
    "llmEndpoint": "{{env.LLM_PROVIDER_URL}}"
  }
}
```

### 8.3 Anti-Pattern #3: Ignorer les Schémas d'I/O

**MAUVAIS**:
```python
def process(data):  # Entrée non typée
    result = do_something(data)
    return result  # Sortie non typée
```

**BON**:
```json
{
  "inputs": [
    {
      "id": "data",
      "type": "object",
      "required": true,
      "schema": {
        "type": "object",
        "properties": {
          "content": {"type": "string"},
          "options": {"type": "object"}
        },
        "required": ["content"]
      }
    }
  ],
  "outputs": [
    {"id": "result", "type": "string"},
    {"id": "success", "type": "boolean"},
    {"id": "error", "type": "string"}
  ]
}
```

### 8.4 Anti-Pattern #4: Agent Monolithique

**MAUVAIS** - Un agent qui fait tout:
```json
{
  "name": "Super Agent",
  "capabilities": ["tout", "absolument-tout"],
  "tools": ["tous-les-tools-existants"]
}
```

**BON** - Agents spécialisés composables:
```bash
# Agent décomposeur
maestro agents create --name "task-decomposer" \
  --capabilities "planning,decomposition"

# Agent exécuteur
maestro agents create --name "task-executor" \
  --capabilities "code-execution" \
  --tools "file-read,file-write,shell-execute"

# Agent validateur
maestro agents create --name "result-validator" \
  --capabilities "validation,quality-check"
```

### 8.5 Anti-Pattern #5: Pas de Validation

**MAUVAIS**:
```python
result = agent.execute(task)
# Utiliser directement sans validation
save_to_production(result)
```

**BON**:
```json
{
  "nodes": [
    {"id": "execute", "blockRef": "agents/executor"},
    {
      "id": "validate",
      "blockRef": "blocks/validator",
      "inputs": {
        "content": "{{execute.result}}",
        "rules": ["non-empty", "valid-syntax", "no-errors"]
      }
    },
    {
      "id": "decide",
      "blockRef": "blocks/decision",
      "inputs": {
        "condition": "{{validate.valid}}"
      }
    }
  ]
}
```

### 8.6 Anti-Pattern #6: Ignorer les Métriques

**MAUVAIS**:
- Exécuter sans mesurer
- Ne pas suivre les performances
- Pas de comparaison avant/après

**BON**:
```bash
# Avant modification
maestro agents metrics my-agent > before.json

# Faire les modifications...

# Après modification - comparer
maestro agents metrics my-agent > after.json
diff before.json after.json

# Utiliser l'entraînement pour comparaison A/B
maestro training create --name "A/B Test" --workflow test-workflow \
  --iterations 50
```

### 8.7 Anti-Pattern #7: Dépendances Circulaires

**MAUVAIS**:
```
Agent A utilise Tool B
Tool B dépend de Agent A  ← CIRCULAIRE
```

**BON**: Hiérarchie claire
```
Agents → utilisent → Tools
Tools → N'utilisent PAS → Agents
```

### 8.8 Anti-Pattern #8: Implémenter les Tools dans le Backend

**MAUVAIS** - Ajouter du code backend pour chaque nouveau tool:

```csharp
// ToolBlockExecutor.cs - NE PAS FAIRE
public async Task<BlockExecutionResult> ExecuteAsync(...)
{
    var toolType = GetConfigString(config, "toolType");

    // Chaque tool nécessite du code personnalisé
    if (toolType == "directoryList")
    {
        return await HandleDirectoryListAsync(inputs);
    }
    else if (toolType == "codeSearch")
    {
        return await HandleCodeSearchAsync(inputs);
    }
    else if (toolType == "testRunner")
    {
        return await HandleTestRunnerAsync(inputs);
    }
    // ... 50 autres tools = 50 méthodes backend
}
```

**Problèmes**:
- ❌ Chaque tool nécessite une recompilation du backend
- ❌ Couplage fort entre tools et infrastructure
- ❌ Difficile à tester et débugger
- ❌ Les utilisateurs ne peuvent pas créer de nouveaux tools
- ❌ Duplication de logique (ex: ls existe déjà dans le système)

**BON** - Utiliser des commandes shell avec substitution de templates:

```json
{
  "id": "directory-list",
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Name"]
  }
}
```

```json
{
  "id": "code-search",
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem -Path '{{path}}' -Recurse -File | Select-String -Pattern '{{pattern}}'"]
  }
}
```

```json
{
  "id": "test-runner",
  "config": {
    "command": "powershell",
    "args": ["-Command", "Set-Location '{{workingDir}}'; {{testCommand}}"]
  }
}
```

**Avantages**:
- ✅ Pas de recompilation - modifier le JSON suffit
- ✅ Testable indépendamment dans un terminal
- ✅ Les utilisateurs peuvent créer leurs propres tools
- ✅ Réutilise les commandes système existantes
- ✅ Portable (adapter la commande selon l'OS)

### 8.9 Tableau Récapitulatif

| Anti-Pattern | Problème | Solution |
|--------------|----------|----------|
| Script monolithique | Pas de métriques, pas réutilisable | Tools + Agents déclaratifs |
| Chemins hardcodés | Pas portable | Inputs dynamiques |
| Pas de schéma I/O | Erreurs runtime | JSON Schema strict |
| Agent monolithique | Difficile à optimiser | Spécialisation |
| Pas de validation | Résultats non fiables | Validators + Decision |
| Ignorer métriques | Pas d'amélioration | Training + Metrics |
| Dépendances circulaires | Deadlocks, confusion | Hiérarchie claire |
| **Tools dans backend** | Recompilation, couplage | **Commandes shell** |

---

## 9. Workflow Complet CLI

### 9.1 Scénario: Créer un Agent de Développement

```bash
# ==========================================
# ÉTAPE 1: Vérifier l'environnement
# ==========================================
maestro health
maestro llm

# ==========================================
# ÉTAPE 2: Lister les tools existants
# ==========================================
maestro tools
maestro tools --category filesystem
maestro tools --category git

# ==========================================
# ÉTAPE 3: Créer les tools manquants
# ==========================================

# Tool d'extraction de code
cat > blocks/tools/code-extractor.tool.block.json << 'EOF'
{
  "id": "code-extractor",
  "name": "Code Extractor",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Extrait les blocs de code depuis du texte",
  "inputs": [
    {"id": "text", "type": "string", "required": true},
    {"id": "language", "type": "string", "required": false, "default": "typescript"}
  ],
  "outputs": [
    {"id": "code", "type": "string"},
    {"id": "found", "type": "boolean"}
  ],
  "config": {"toolType": "parsing", "operation": "extract"},
  "metadata": {"category": "parsing", "tags": ["code", "extraction"]}
}
EOF

# Enregistrer le tool
maestro tools create --name "Code Extractor" --block code-extractor \
  --category "parsing"

# ==========================================
# ÉTAPE 4: Créer l'agent
# ==========================================

cat > blocks/agents/feature-developer.agent.block.json << 'EOF'
{
  "id": "feature-developer",
  "name": "Feature Developer",
  "blockType": "agent",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Développe des features de manière autonome",
  "inputs": [
    {"id": "feature", "type": "string", "required": true},
    {"id": "projectPath", "type": "string", "required": true}
  ],
  "outputs": [
    {"id": "success", "type": "boolean"},
    {"id": "filesModified", "type": "array"},
    {"id": "summary", "type": "string"}
  ],
  "config": {
    "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "maxSteps": 15,
    "maxTokens": 15000,
    "temperature": 0.5,
    "timeoutMs": 600000,
    "tools": ["file-read", "file-write", "git-status", "git-diff", "code-extractor"],
    "systemPrompt": "Tu es un développeur expert..."
  },
  "capabilities": ["feature-development", "code-generation", "testing"],
  "metadata": {"category": "development", "tags": ["agent", "feature", "autonomous"]}
}
EOF

# Enregistrer l'agent
maestro agents create --name "Feature Developer" --block feature-developer \
  --tools "file-read,file-write,git-status,git-diff,code-extractor" \
  --capabilities "feature-development,code-generation" \
  --category "development"

# ==========================================
# ÉTAPE 5: Créer un sandbox de test
# ==========================================

mkdir -p C:/test-project/src
echo "export function main() { console.log('Hello'); }" > C:/test-project/src/index.ts
echo '{"name": "test-project", "version": "1.0.0"}' > C:/test-project/package.json
cd C:/test-project && git init && git add . && git commit -m "Initial commit"

maestro projects create --name "test-project" --path "C:/test-project" \
  --runtime process

# ==========================================
# ÉTAPE 6: Tester l'agent
# ==========================================

# Test simple
maestro execute feature-developer \
  --input feature="Ajouter une fonction de calcul de somme" \
  --input projectPath="C:/test-project" \
  --working-dir "C:/test-project"

# Vérifier les résultats
maestro runs --limit 1
maestro runs info <run-id>

# ==========================================
# ÉTAPE 7: Entraîner l'agent
# ==========================================

# Créer config d'entraînement
maestro training create \
  --name "Feature Developer Training" \
  --workflow feature-developer \
  --iterations 20 \
  --parallel 2 \
  --goal quality \
  --delay 2000

# Lancer l'entraînement
maestro training start cfg-feature-dev \
  --inputs '{"feature": "Ajouter validation des entrées", "projectPath": "C:/test-project"}'

# Suivre la progression
watch -n 5 'maestro training run run-feature-dev'

# ==========================================
# ÉTAPE 8: Analyser et optimiser
# ==========================================

# Voir les métriques
maestro agents metrics feature-developer
maestro tools metrics code-extractor

# Comparer avec le leaderboard
maestro foundry leaderboard

# Exporter les métriques
maestro metrics summary --from 2026-01-01 > metrics-report.json
```

### 9.2 Script d'Automatisation Complet

```bash
#!/bin/bash
# maestro-train.sh - Script d'entraînement automatisé

AGENT_ID=$1
ITERATIONS=${2:-50}
GOAL=${3:-quality}

echo "=== Entraînement de $AGENT_ID ==="
echo "Iterations: $ITERATIONS, Goal: $GOAL"

# Vérifier que l'agent existe
maestro agents info $AGENT_ID || {
  echo "Agent $AGENT_ID non trouvé"
  exit 1
}

# Métriques avant
echo "=== Métriques AVANT ==="
maestro agents metrics $AGENT_ID

# Créer config
CONFIG_ID="train-$AGENT_ID-$(date +%s)"
maestro training create \
  --name "$CONFIG_ID" \
  --workflow $AGENT_ID \
  --iterations $ITERATIONS \
  --goal $GOAL

# Lancer
RUN_ID=$(maestro training start $CONFIG_ID | grep "Run ID" | awk '{print $3}')
echo "Run démarré: $RUN_ID"

# Attendre la fin
while true; do
  STATUS=$(maestro training run $RUN_ID | grep "Status" | awk '{print $2}')
  if [ "$STATUS" == "completed" ] || [ "$STATUS" == "failed" ]; then
    break
  fi
  echo "Status: $STATUS"
  sleep 10
done

# Métriques après
echo "=== Métriques APRÈS ==="
maestro agents metrics $AGENT_ID

echo "=== Entraînement terminé ==="
```

---

## 10. Optimisation Continue

### 10.1 Cycle d'Amélioration

```
┌─────────────────────────────────────────────────────────┐
│                CYCLE D'OPTIMISATION                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐       │
│    │ Mesurer  │ ──► │ Analyser │ ──► │ Ajuster  │       │
│    └──────────┘     └──────────┘     └──────────┘       │
│         ▲                                  │             │
│         │                                  │             │
│         └──────────────────────────────────┘             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Checklist d'Optimisation

**Pour les Tools**:
- [ ] Success rate > 90%
- [ ] Temps d'exécution acceptable
- [ ] Coût en tokens optimisé
- [ ] Schémas I/O complets
- [ ] Tests de régression

**Pour les Agents**:
- [ ] Completion rate > 80%
- [ ] Efficiency score > 70
- [ ] Tools bien choisis pour chaque tâche
- [ ] Prompts système clairs
- [ ] Gestion des erreurs

### 10.3 Techniques d'Optimisation

1. **Optimisation de Prompts**
   - Être spécifique et concis
   - Donner des exemples (few-shot)
   - Structurer avec des étapes numérotées

2. **Optimisation de Tools**
   - Découper en unités plus petites
   - Ajouter des validations
   - Gérer les cas d'erreur

3. **Optimisation d'Agents**
   - Réduire le nombre de tools
   - Améliorer le système prompt
   - Ajuster maxSteps et temperature

4. **A/B Testing**
   ```bash
   # Comparer deux versions
   maestro training create --name "Version A" --workflow agent-v1 --iterations 30
   maestro training create --name "Version B" --workflow agent-v2 --iterations 30

   # Comparer les résultats
   maestro agents metrics agent-v1
   maestro agents metrics agent-v2
   ```

### 10.4 Monitoring Continu

```bash
# Script de monitoring
while true; do
  clear
  echo "=== MAESTRO MONITORING $(date) ==="
  echo ""
  echo "=== Top Agents ==="
  maestro foundry leaderboard --limit 5
  echo ""
  echo "=== Runs Récents ==="
  maestro runs --limit 5
  echo ""
  echo "=== Métriques du Jour ==="
  maestro metrics summary --from $(date +%Y-%m-%d)
  sleep 60
done
```

---

## Conclusion

La création et l'optimisation d'agents Maestro suivent un processus rigoureux:

1. **Commencer par les Tools** - Créer des unités atomiques bien définies
2. **Composer des Agents** - Orchestrer les tools avec des prompts clairs
3. **Tester en Sandbox** - Valider dans un environnement isolé
4. **Entraîner avec le CLI** - Exécuter des itérations multiples
5. **Mesurer et Analyser** - Utiliser les métriques pour guider
6. **Optimiser en Continu** - Améliorer prompts, tools, et architecture

**Règle d'Or**: Si vous écrivez du code Python/JS pour faire une tâche, demandez-vous d'abord: "Est-ce que ça devrait être un Tool Maestro?"

La réponse est presque toujours OUI.
