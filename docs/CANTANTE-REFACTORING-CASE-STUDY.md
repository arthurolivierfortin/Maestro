# Étude de Cas: Refactorisation de Cantante

## Le Problème

Le fichier `C:\Cantante\.maestro\autonomous-dev.py` est un **exemple parfait de ce qu'il ne faut PAS faire** avec Maestro.

## Analyse du Code Problématique

### Structure Actuelle (Anti-Pattern)

```
autonomous-dev.py
├── generate_code()      ← Devrait être un Tool
├── extract_code()       ← Devrait être un Tool
├── read_file()          ← DUPLIQUE file-read Tool existant
├── write_file()         ← DUPLIQUE file-write Tool existant
├── create_run()         ← Appel API direct (pas de retry, pas de metrics)
├── task_add_player_controls()  ← Devrait être un Agent subtask
├── task_add_player_styles()    ← Devrait être un Agent subtask
└── task_add_player_logic()     ← Devrait être un Agent subtask
```

### Problèmes Identifiés

| Fonction | Problème | Impact |
|----------|----------|--------|
| `generate_code()` | Appel HTTP direct, hardcodé | Pas de metrics, pas de retry |
| `extract_code()` | Logique custom non réutilisable | Duplication à chaque projet |
| `read_file()` | Duplique `file-read` tool | Pas de tracking, pas de validation |
| `write_file()` | Duplique `file-write` tool | Pas de tracking |
| `task_*()` | Logique d'orchestration hardcodée | Pas d'optimisation possible |

### Code Actuel (Extrait)

```python
# autonomous-dev.py - MAUVAIS EXEMPLE

LLM_URL = "http://localhost:8000/v1/generate"  # Hardcodé!
PROJECT_PATH = "C:/Cantante"  # Hardcodé!

def generate_code(prompt, max_tokens=800):
    """Appel HTTP direct - pas de metrics, pas de retry"""
    response = requests.post(LLM_URL, json={
        "prompt": prompt,
        "max_new_tokens": max_tokens,
        "temperature": 0.2
    })
    if response.status_code == 200:
        return response.json().get("generated_text", "")
    return None  # Pas de gestion d'erreur détaillée

def read_file(path):
    """DUPLIQUE le tool file-read existant!"""
    full_path = os.path.join(PROJECT_PATH, path)
    with open(full_path, 'r') as f:
        return f.read()

def task_add_player_controls():
    """Orchestration hardcodée - impossible à optimiser"""
    current_html = read_file("src/renderer/index.html")
    prompt = f"""..."""  # Prompt hardcodé
    response = generate_code(prompt, 1000)
    code = extract_code(response, "html")
    write_file("src/renderer/index.html", code)
```

---

## La Solution: Architecture Maestro

### Nouvelle Structure

```
blocks/
├── tools/
│   ├── llm-generate.tool.block.json     ← Remplace generate_code()
│   ├── code-extractor.tool.block.json   ← Remplace extract_code()
│   ├── file-read.tool.block.json        ← Déjà existant
│   └── file-write.tool.block.json       ← Déjà existant
│
└── agents/
    └── ui-feature-developer.agent.block.json  ← Remplace les task_*()
```

### Tool 1: LLM Generate

**Fichier**: `blocks/tools/llm-generate.tool.block.json`

```json
{
  "id": "llm-generate",
  "name": "LLM Generate",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,

  "inputs": [
    {"id": "prompt", "type": "string", "required": true},
    {"id": "maxTokens", "type": "number", "default": 800},
    {"id": "temperature", "type": "number", "default": 0.7}
  ],

  "outputs": [
    {"id": "generatedText", "type": "string"},
    {"id": "totalTokens", "type": "number"},
    {"id": "success", "type": "boolean"},
    {"id": "error", "type": "string"}
  ],

  "config": {
    "endpoint": "{{env.LLM_PROVIDER_URL}}/v1/generate",
    "timeout": 120000,
    "retries": 2
  }
}
```

**Avantages**:
- ✅ Endpoint configurable via env
- ✅ Retry automatique
- ✅ Métriques de tokens
- ✅ Gestion d'erreur structurée
- ✅ Réutilisable par tous les agents

### Tool 2: Code Extractor

**Fichier**: `blocks/tools/code-extractor.tool.block.json`

```json
{
  "id": "code-extractor",
  "name": "Code Extractor",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,

  "inputs": [
    {"id": "text", "type": "string", "required": true},
    {"id": "language", "type": "string", "default": "typescript"}
  ],

  "outputs": [
    {"id": "code", "type": "string"},
    {"id": "found", "type": "boolean"},
    {"id": "extractionMethod", "type": "string"}
  ],

  "config": {
    "cleanupPatterns": [
      {"pattern": "</think>", "replacement": ""}
    ]
  }
}
```

**Avantages**:
- ✅ Logique centralisée
- ✅ Patterns de cleanup configurables
- ✅ Support multi-langage
- ✅ Testable en isolation

### Agent: UI Feature Developer

**Fichier**: `blocks/agents/ui-feature-developer.agent.block.json`

```json
{
  "id": "ui-feature-developer",
  "name": "UI Feature Developer",
  "blockType": "agent",
  "version": "1.0.0",

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
    "tools": [
      "file-read",
      "file-write",
      "llm-generate",
      "code-extractor",
      "git-status"
    ],
    "systemPrompt": "Tu es un développeur UI expert...",
    "maxSteps": 20
  }
}
```

**Avantages**:
- ✅ Tools déclarés explicitement
- ✅ Prompt système configurable
- ✅ Limite d'étapes
- ✅ Métriques automatiques
- ✅ Optimisable via training

---

## Migration: Avant/Après

### Avant (Python Script)

```python
def task_add_player_controls():
    current_html = read_file("src/renderer/index.html")
    prompt = f"""Current HTML: {current_html}
    Task: Add player controls..."""
    response = generate_code(prompt, 1000)
    code = extract_code(response, "html")
    write_file("src/renderer/index.html", code)
```

**Problèmes**:
- ❌ Pas de métriques
- ❌ Pas de gestion d'erreur
- ❌ Prompt hardcodé
- ❌ Impossible à tester en isolation
- ❌ Pas d'historique des runs

### Après (Maestro CLI)

```bash
# Exécuter l'agent
maestro execute ui-feature-developer \
  --input feature="Add music player controls" \
  --input projectPath="C:/Cantante" \
  --working-dir "C:/Cantante"

# Voir les métriques
maestro agents metrics ui-feature-developer

# Entraîner pour améliorer
maestro training create --name "UI Dev Training" \
  --workflow ui-feature-developer \
  --iterations 30 \
  --goal quality

maestro training start <config-id>
```

**Avantages**:
- ✅ Métriques automatiques (temps, tokens, succès)
- ✅ Historique des runs
- ✅ Entraînement possible
- ✅ Testable en sandbox
- ✅ Découvrable dans le leaderboard

---

## Comparaison des Métriques

| Métrique | Script Python | Agent Maestro |
|----------|--------------|---------------|
| Success Rate | ❓ Inconnu | ✅ Tracké automatiquement |
| Temps Exécution | ❓ Inconnu | ✅ Tracké automatiquement |
| Coût Tokens | ❓ Inconnu | ✅ Tracké automatiquement |
| Historique | ❌ Aucun | ✅ Complet |
| Optimisation | ❌ Manuelle | ✅ Training automatisé |
| Tests | ❌ Ad-hoc | ✅ Sandbox intégré |
| Réutilisation | ❌ Copy-paste | ✅ Composable |

---

## Plan de Migration

### Étape 1: Créer les Tools (immédiat)

```bash
# Les tools sont déjà créés dans:
# - blocks/tools/llm-generate.tool.block.json
# - blocks/tools/code-extractor.tool.block.json

# Vérifier qu'ils sont chargés
maestro tools
```

### Étape 2: Créer l'Agent (immédiat)

```bash
# L'agent est déjà créé dans:
# - blocks/agents/ui-feature-developer.agent.block.json

# L'enregistrer
maestro agents create --name "UI Feature Developer" \
  --block ui-feature-developer \
  --tools "file-read,file-write,llm-generate,code-extractor,git-status" \
  --category "development"
```

### Étape 3: Tester en Sandbox

```bash
# Créer un sandbox
mkdir C:/test-cantante
cp -r C:/Cantante/src C:/test-cantante/

# Tester
maestro execute ui-feature-developer \
  --input feature="Add volume slider" \
  --input projectPath="C:/test-cantante"

# Vérifier
maestro runs --limit 1
```

### Étape 4: Entraîner

```bash
# Créer config
maestro training create --name "Cantante UI Training" \
  --workflow ui-feature-developer \
  --iterations 50 \
  --goal quality

# Lancer
maestro training start cantante-ui-training

# Suivre
maestro training runs --config cantante-ui-training
```

### Étape 5: Déprécier le Script Python

```bash
# Renommer l'ancien fichier
mv C:/Cantante/.maestro/autonomous-dev.py \
   C:/Cantante/.maestro/autonomous-dev.py.DEPRECATED

# Documenter la migration
echo "Use: maestro execute ui-feature-developer" > \
  C:/Cantante/.maestro/README.md
```

---

## Résumé

| Aspect | Avant (Script) | Après (Maestro) |
|--------|---------------|-----------------|
| **Architecture** | Monolithique | Composable |
| **Métriques** | Aucune | Automatiques |
| **Réutilisation** | Copy-paste | Registry |
| **Optimisation** | Manuelle | Training |
| **Tests** | Ad-hoc | Sandbox |
| **Maintenance** | Complexe | Simple |

**Règle d'or**: Si vous écrivez une fonction Python pour une tâche, demandez-vous:
> "Est-ce que ça devrait être un Tool ou Agent Maestro?"

La réponse est presque toujours **OUI**.
