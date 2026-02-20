# Plan B2 — Tool Blocks (Memory) : memory-read, memory-write, state-manager

**Objectif** : Creer les 3 tool blocks Memory/State du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/09-tool-blocks/spec.md`.
**Impact** : Creation de fichiers JSON + scripts Node.js dans `content/system/blocks/tools/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-memory.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier `docs/phases/PHASE-34/34-A/09-tool-blocks/`) : Contient les details de conception pour chaque tool block.
3. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 3 documents.**

---

## Contexte — Format reel des tool blocks dans le codebase

### Format reference (PAS le format du spec)

Le spec v4 utilise `config.command` et `config.parameters` — ce ne sont PAS les champs reels du codebase. **Le codebase fait foi.**

#### Tool block avec script (reference : `json-validator.tool.block.json`)

```
content/system/blocks/tools/<block-id>/
├── <block-id>.tool.block.json    <- Definition du bloc
└── script.js (ou autre)          <- Script execute par ToolBlockExecutor
```

```json
{
  "id": "<block-id>",
  "name": "<Display Name>",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "...",
  "inputs": [
    { "id": "inputName", "type": "string", "required": true, "description": "..." }
  ],
  "outputs": [
    { "id": "content", "type": "string", "description": "..." }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "script.js",
    "parseOutput": "json",
    "timeout": 30000
  },
  "metadata": {
    "category": "...",
    "tags": ["..."]
  }
}
```

#### Tool block filesystem (reference : `file-read.tool.block.json`)

```json
{
  "config": {
    "toolType": "filesystem",
    "operation": "read"
  }
}
```

#### Tool block shell (reference : `shell-execute.tool.block.json`)

```json
{
  "config": {
    "toolType": "shell",
    "timeout": 60000,
    "shell": true
  }
}
```

### Points critiques sur ToolBlockExecutor.cs

Le `ToolBlockExecutor` fait ceci dans l'ordre :
1. Si `config.executorType == "cli-bridge"` → route vers ICliExecutor
2. Si `config.toolType == "filesystem"` → operation filesystem (read/write/list)
3. Si `config.toolType == "shell"` → execute la commande depuis `inputs.command`
4. Si `config.command` est defini → execution directe du process
5. Sinon → utilise `config.scriptFile` ou `config.script` + `config.runtime`

Pour nos tool blocks, le chemin **5 (scriptFile + runtime)** est le bon pour la majorite.

**Mecanisme d'injection des inputs** : les inputs sont injectes comme variables d'environnement : `MAESTRO_INPUT_<KEY_UPPER>`. Par exemple, `inputs.url` → `process.env.MAESTRO_INPUT_URL`.

**Mecanisme de parsing des outputs** : si `config.parseOutput: "json"`, le stdout est parse comme JSON et chaque propriete de premier niveau devient un output. Si le parsing echoue, il essaie d'extraire un sous-string JSON entre `{` et `}`.

**Repertoire de travail du script** : le script est execute depuis le repertoire du bloc (via `metadata._sourcePath` qui est injecte automatiquement par `FileSystemBlockDiscoveryService`). L'env var `MAESTRO_BLOCK_DIR` est aussi disponible.

### Table de correspondance spec → codebase

| Champ spec | Champ reel codebase | Notes |
|------------|---------------------|-------|
| `config.command` | N/A (ne pas utiliser) | Le spec utilise `command`, le codebase utilise `scriptFile` + `runtime` |
| `config.parameters` | `inputs` (array au top level) | Les params sont declares dans `inputs`, pas dans `config` |
| N/A | `config.runtime` | Obligatoire : `"node"` pour les scripts JS |
| N/A | `config.scriptFile` | Obligatoire : nom du fichier script relatif au dossier du bloc |
| N/A | `config.parseOutput` | Obligatoire : `"json"` pour parser stdout comme JSON |
| N/A | `config.timeout` | Timeout en ms (par defaut dans ToolBlockExecutor) |

---

## Bloc 1 : memory-read

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/memory-read/memory-read.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/memory-read/read-memory.js` | Script de lecture |

### Block definition JSON

```json
{
  "id": "memory-read",
  "name": "Memory Read",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Reads a memory file from .maestro/memory/ in the project directory. If 'file' is provided, reads that specific file. If 'topic' is provided, searches across all memory files. If neither, reads index.md.",
  "inputs": [
    { "id": "file", "type": "string", "required": false, "description": "File name to read (e.g. 'conventions.md'). Default: index.md" },
    { "id": "topic", "type": "string", "required": false, "description": "Topic to search for across all memory files" },
    { "id": "workingDir", "type": "string", "required": false, "description": "Project root directory containing .maestro/ (default: cwd)" }
  ],
  "outputs": [
    { "id": "content", "type": "string", "description": "File content or search results" },
    { "id": "file", "type": "string", "description": "The file that was read" },
    { "id": "exists", "type": "boolean", "description": "Whether the file/directory exists" },
    { "id": "success", "type": "boolean", "description": "Whether the read succeeded" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "read-memory.js",
    "parseOutput": "json",
    "timeout": 5000
  },
  "metadata": {
    "category": "memory",
    "designation": "tool",
    "tags": ["memory", "read", "persistence", "context", "v4"]
  }
}
```

### Script : read-memory.js

```javascript
const fs = require('fs');
const path = require('path');

const file = process.env.MAESTRO_INPUT_FILE || '';
const topic = process.env.MAESTRO_INPUT_TOPIC || '';
const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || process.cwd();

const memoryDir = path.join(workingDir, '.maestro', 'memory');

if (!fs.existsSync(memoryDir)) {
  console.log(JSON.stringify({
    success: true,
    content: '',
    file: file || 'index.md',
    exists: false
  }));
  process.exit(0);
}

if (topic) {
  // Search across all .md files for the topic
  const results = [];
  const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));

  for (const f of files) {
    const content = fs.readFileSync(path.join(memoryDir, f), 'utf-8');
    if (content.toLowerCase().includes(topic.toLowerCase())) {
      // Extract the relevant section (lines around the match)
      const lines = content.split('\n');
      const matchLines = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(topic.toLowerCase())) {
          const start = Math.max(0, i - 2);
          const end = Math.min(lines.length, i + 5);
          matchLines.push(`[${f}:${i + 1}]\n${lines.slice(start, end).join('\n')}`);
        }
      }
      if (matchLines.length > 0) {
        results.push(matchLines.join('\n---\n'));
      }
    }
  }

  console.log(JSON.stringify({
    success: true,
    content: results.length > 0 ? results.join('\n\n===\n\n') : `No results found for topic '${topic}'`,
    file: `search:${topic}`,
    exists: true
  }));
} else {
  // Read specific file
  const fileName = file || 'index.md';
  const filePath = path.join(memoryDir, fileName);

  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({
      success: true,
      content: '',
      file: fileName,
      exists: false
    }));
  } else {
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(JSON.stringify({
      success: true,
      content,
      file: fileName,
      exists: true
    }));
  }
}
```

### Prerequis

Aucune dependance externe. Utilise uniquement `fs` et `path` (modules Node.js natifs).

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'memory-read'"
# Resultat attendu : memory-read  tool  4.0.0

# Creer un fichier de test d'abord
powershell.exe -Command "New-Item -ItemType Directory -Force -Path C:\Meastro\.maestro\memory; Set-Content -Path C:\Meastro\.maestro\memory\index.md -Value '# Project Memory'"
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run memory-read --input workingDir=C:\Meastro"
# Resultat attendu : JSON avec success=true, content='# Project Memory', exists=true
```

---

## Bloc 2 : memory-write

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/memory-write/memory-write.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/memory-write/write-memory.js` | Script d'ecriture |

### Block definition JSON

```json
{
  "id": "memory-write",
  "name": "Memory Write",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Writes or appends to a memory file in .maestro/memory/. Creates the directory structure if it does not exist.",
  "inputs": [
    { "id": "file", "type": "string", "required": true, "description": "File name to write (e.g. 'conventions.md')" },
    { "id": "content", "type": "string", "required": true, "description": "Content to write" },
    { "id": "mode", "type": "string", "required": false, "description": "Write mode: 'write' (overwrite, default) or 'append'" },
    { "id": "workingDir", "type": "string", "required": false, "description": "Project root directory containing .maestro/ (default: cwd)" }
  ],
  "outputs": [
    { "id": "success", "type": "boolean", "description": "Whether the write succeeded" },
    { "id": "filePath", "type": "string", "description": "Absolute path to the written file" },
    { "id": "bytesWritten", "type": "number", "description": "Number of bytes written" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "write-memory.js",
    "parseOutput": "json",
    "timeout": 5000
  },
  "metadata": {
    "category": "memory",
    "designation": "tool",
    "tags": ["memory", "write", "persistence", "context", "v4"]
  }
}
```

### Script : write-memory.js

```javascript
const fs = require('fs');
const path = require('path');

const file = process.env.MAESTRO_INPUT_FILE || '';
const content = process.env.MAESTRO_INPUT_CONTENT || '';
const mode = process.env.MAESTRO_INPUT_MODE || 'write';
const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || process.cwd();

if (!file) {
  console.log(JSON.stringify({ success: false, error: 'Missing required input: file', filePath: '', bytesWritten: 0 }));
  process.exit(0);
}

if (!content) {
  console.log(JSON.stringify({ success: false, error: 'Missing required input: content', filePath: '', bytesWritten: 0 }));
  process.exit(0);
}

const memoryDir = path.join(workingDir, '.maestro', 'memory');
const filePath = path.join(memoryDir, file);

try {
  // Ensure directory exists
  fs.mkdirSync(memoryDir, { recursive: true });

  if (mode === 'append') {
    // Add a newline separator before appending
    const separator = fs.existsSync(filePath) ? '\n\n' : '';
    fs.appendFileSync(filePath, separator + content, 'utf-8');
  } else {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  const bytesWritten = Buffer.byteLength(content, 'utf-8');
  console.log(JSON.stringify({
    success: true,
    filePath: path.resolve(filePath),
    bytesWritten
  }));
} catch (err) {
  console.log(JSON.stringify({ success: false, error: err.message, filePath: '', bytesWritten: 0 }));
}
```

### Prerequis

Aucune dependance externe. Utilise uniquement `fs` et `path` (modules Node.js natifs).

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'memory-write'"
# Resultat attendu : memory-write  tool  4.0.0

powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run memory-write --input file=test.md --input content='# Test Memory' --input workingDir=C:\Meastro"
# Resultat attendu : JSON avec success=true, bytesWritten > 0

# Verifier le fichier cree
powershell.exe -Command "Get-Content C:\Meastro\.maestro\memory\test.md"
# Resultat attendu : # Test Memory
```

---

## Bloc 3 : state-manager

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/state-manager/state-manager.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/state-manager/state.js` | Script de gestion d'etat |

### Block definition JSON

```json
{
  "id": "state-manager",
  "name": "State Manager",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Manages shared state between the workflow and the interaction-handler. Reads/writes session variables via the Maestro REST API. Supports operations: get, set, transition, pause, resume, rewind, inject.",
  "inputs": [
    { "id": "operation", "type": "string", "required": true, "description": "Operation: get|set|transition|pause|resume|rewind|inject" },
    { "id": "path", "type": "string", "required": false, "description": "Dot-notation path for get/set (e.g. 'results.comprendre', 'currentPhase')" },
    { "id": "value", "type": "string", "required": false, "description": "Value for set/inject operations (JSON string)" },
    { "id": "phase", "type": "string", "required": false, "description": "Target phase for transition/rewind operations" },
    { "id": "sessionId", "type": "string", "required": false, "description": "Session ID (auto-detected from MAESTRO_SESSION_ID env var if not provided)" }
  ],
  "outputs": [
    { "id": "success", "type": "boolean", "description": "Whether the operation succeeded" },
    { "id": "value", "type": "string", "description": "Retrieved value for get operation (JSON string)" },
    { "id": "previousState", "type": "string", "description": "Previous state before mutation (for undo support)" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "state.js",
    "parseOutput": "json",
    "timeout": 10000
  },
  "metadata": {
    "category": "infrastructure",
    "designation": "tool",
    "tags": ["state", "manager", "session", "workflow", "v4"]
  }
}
```

### Script : state.js

Le state-manager utilise l'API REST Maestro pour lire/ecrire les variables de session. Cela garantit que le state est partage entre le workflow et l'interaction-handler (qui tournent potentiellement en parallele).

```javascript
const http = require('http');

const operation = process.env.MAESTRO_INPUT_OPERATION || '';
const dotPath = process.env.MAESTRO_INPUT_PATH || '';
const rawValue = process.env.MAESTRO_INPUT_VALUE || '';
const phase = process.env.MAESTRO_INPUT_PHASE || '';
// Session ID: try dedicated input, then env var set by session executor
const sessionId = process.env.MAESTRO_INPUT_SESSIONID || process.env.MAESTRO_SESSION_ID || '';
const API_BASE = process.env.MAESTRO_API_BASE || 'http://localhost:5000';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('API timeout')); });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Variable name for the shared workflow state
const STATE_VAR = '_workflowState';

async function getState() {
  const res = await apiRequest('GET', `/api/sessions/${sessionId}/variables/${STATE_VAR}`);
  if (res.status === 200) return res.data;
  return {};
}

async function setState(state) {
  await apiRequest('PUT', `/api/sessions/${sessionId}/variables/${STATE_VAR}`, { value: state });
}

function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : null, obj);
}

function setByPath(obj, path, value) {
  if (!path) return value;  // replace root
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

(async () => {
  if (!sessionId) {
    console.log(JSON.stringify({ success: false, error: 'No sessionId provided. Set MAESTRO_SESSION_ID or pass sessionId input.', value: null, previousState: null }));
    process.exit(0);
  }

  if (!operation) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: operation', value: null, previousState: null }));
    process.exit(0);
  }

  try {
    const state = await getState();
    const previousState = JSON.stringify(state);

    let parsedValue;
    try {
      parsedValue = rawValue ? JSON.parse(rawValue) : rawValue;
    } catch {
      parsedValue = rawValue;
    }

    switch (operation) {
      case 'get': {
        const result = getByPath(state, dotPath);
        console.log(JSON.stringify({ success: true, value: JSON.stringify(result), previousState }));
        break;
      }

      case 'set': {
        const updated = setByPath(state, dotPath, parsedValue);
        await setState(updated);
        console.log(JSON.stringify({ success: true, value: JSON.stringify(parsedValue), previousState }));
        break;
      }

      case 'transition': {
        if (!phase) throw new Error('transition requires phase input');
        state.previousPhase = state.currentPhase;
        state.currentPhase = phase;
        state.history = state.history || [];
        state.history.push({ from: state.previousPhase, to: phase, time: new Date().toISOString() });
        await setState(state);
        console.log(JSON.stringify({ success: true, value: phase, previousState }));
        break;
      }

      case 'pause': {
        state.status = 'paused';
        state.pausedAt = new Date().toISOString();
        await setState(state);
        console.log(JSON.stringify({ success: true, value: 'paused', previousState }));
        break;
      }

      case 'resume': {
        state.status = 'running';
        state.resumedAt = new Date().toISOString();
        await setState(state);
        console.log(JSON.stringify({ success: true, value: 'running', previousState }));
        break;
      }

      case 'rewind': {
        if (!phase) throw new Error('rewind requires phase input');
        state.currentPhase = phase;
        state.status = 'running';
        // Clear results from the rewound phase onwards
        state.rewoundTo = phase;
        state.rewoundAt = new Date().toISOString();
        state.history = state.history || [];
        state.history.push({ action: 'rewind', to: phase, time: new Date().toISOString() });
        await setState(state);
        console.log(JSON.stringify({ success: true, value: phase, previousState }));
        break;
      }

      case 'inject': {
        if (!dotPath) throw new Error('inject requires path input');
        const updated2 = setByPath(state, dotPath, parsedValue);
        updated2.userOverrides = updated2.userOverrides || {};
        updated2.userOverrides[dotPath] = parsedValue;
        await setState(updated2);
        console.log(JSON.stringify({ success: true, value: JSON.stringify(parsedValue), previousState }));
        break;
      }

      default:
        console.log(JSON.stringify({ success: false, error: `Unknown operation: ${operation}`, value: null, previousState }));
    }
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, value: null, previousState: null }));
  }
})();
```

### Prerequis

- Le backend Maestro doit etre en cours d'execution sur `localhost:5000`
- Une session active doit exister (le `sessionId` doit etre fourni)

### Points d'attention

1. **Le state-manager est un tool block, pas du code C#** — il appelle l'API REST comme n'importe quel client externe. Cela respecte le principe "CLI-first" et "generic infrastructure".
2. **Le state est stocke dans `_workflowState`** — une variable de session unique. Les operations `get`/`set` utilisent un dot-path pour naviguer dans l'objet (par ex. `results.comprendre.project`).
3. **Le `sessionId` doit etre injecte** — soit via l'input, soit via `MAESTRO_SESSION_ID` (env var a ajouter dans `EntryPointExecutor` quand il lance les child processes). Si absent, le bloc echoue avec un message clair.
4. **Pas de mutex** — la v4 initiale fonctionne en "last write wins". Si le workflow et l'interaction-handler ecrivent en meme temps, le dernier ecrit gagne. Un mutex via session variable ("_stateLock") pourrait etre ajoute en 34-E si necessaire.

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'state-manager'"
# Resultat attendu : state-manager  tool  4.0.0

# Test (necessite backend + session active)
# 1. Creer une session
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session create --type project --name 'State Test' --repo C:\Meastro --template project-autonomous --start"
# 2. Recuperer le session ID, puis:
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run state-manager --input operation=set --input path=currentPhase --input value='\"comprendre\"' --input sessionId=<FULL-UUID>"
# Resultat attendu : JSON avec success=true
```

---

## Pipeline de creation et publication (OBLIGATOIRE)

Chaque bloc DOIT passer par ce pipeline complet. **Creer les fichiers ne suffit PAS** — le bloc doit etre teste et publie via le CLI.

### Pre-requis
Verifier que le backend est accessible :
```bash
curl -s http://localhost:5000/api/health
```
Si le backend n'est pas actif, le documenter dans `docs/phases/PHASE-34/irritations.md`. Les tests d'execution seront impossibles mais la creation des fichiers et la validation JSON restent possibles.

### Pour chaque bloc :
1. **Creer les fichiers** dans le dossier approprie (`content/system/blocks/tools/<block-id>/`)
2. **Verifier la decouverte** par le backend :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String '<block-id>'"
   ```
   Si le bloc n'apparait pas → verifier le format JSON, le nom de fichier, le chemin. Corriger avant de continuer.
3. **Tester l'execution** avec **minimum 2 scenarios** distincts :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run <block-id> --input key=value"
   ```
   Verifier que la sortie est du JSON valide.
4. **Iterer si la qualite est insuffisante** : modifier le script, ajuster la config. **Minimum 2 tentatives, maximum 5.**
5. **Publier le bloc** une fois les tests satisfaisants :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block publish <block-id>"
   ```
6. **Verifier la publication** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js approvals list"
   ```
   Le bloc doit apparaitre dans la liste des approbations en attente.
7. **Documenter le score P/W** dans le checkpoint (voir section Criteres de qualite).
8. **Si bloque apres 5 iterations** : documenter dans `docs/phases/PHASE-34/irritations.md`, noter la raison du blocage, et passer au bloc suivant.

> **RAPPEL** : Un bloc cree mais non publie via `block publish` n'est PAS considere comme termine. Le statut DONE requiert la publication.

---

## Ordre d'execution

Les blocs sont ordonnes par difficulte/risque croissant :

1. **memory-read** — simple filesystem, aucune dependance externe
2. **memory-write** — simple filesystem, aucune dependance externe
3. **state-manager** — necessite backend actif + session, complexite API REST

### Workflow de test chaine memory-read + memory-write

```bash
# 1. Ecrire un fichier memoire
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run memory-write --input file=test-chain.md --input content='# Chain Test' --input workingDir=C:\Meastro"

# 2. Relire le fichier ecrit
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run memory-read --input file=test-chain.md --input workingDir=C:\Meastro"
# Verifier que content == '# Chain Test'

# 3. Append au fichier
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run memory-write --input file=test-chain.md --input content='## Section 2' --input mode=append --input workingDir=C:\Meastro"

# 4. Relire et verifier le contenu complet
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run memory-read --input file=test-chain.md --input workingDir=C:\Meastro"
# Verifier que content contient les deux sections
```

---

## Criteres de qualite (QualityScore)

| Bloc | Test | Seuil |
|------|------|-------|
| memory-read | Lecture d'un fichier cree manuellement | content non vide, exists=true |
| memory-write | Ecriture + relecture | bytesWritten > 0, fichier present sur disque |
| state-manager | set + get via session active | success=true pour les deux operations |

---

## Erreurs courantes a eviter

1. **Utiliser `config.command` et `config.parameters`** comme dans le spec — ce ne sont PAS les champs reels. Utiliser `config.runtime`, `config.scriptFile`, `config.parseOutput`.
2. **Oublier `config.parseOutput: "json"`** — sans ca, le stdout brut est retourne comme string, pas parse en outputs structures.
3. **Oublier que les inputs arrivent via env vars** — `process.env.MAESTRO_INPUT_URL`, pas des arguments CLI.
4. **Mettre les scripts au mauvais endroit** — le script DOIT etre dans le meme repertoire que le `.block.json` (ou dans le `blockSourceDir`).
5. **Pas de `require('playwright')` disponible** — il faut que le package soit installe quelque part dans la chaine `node_modules`.
6. **Ne pas tester** — creer le fichier JSON + script ne suffit pas, il faut verifier que le backend decouvre le bloc ET que l'execution produit un resultat valide.
7. **Oublier `isAtomic: true`** — les tool blocks sont TOUJOURS atomiques.
8. **Oublier `metadata.designation: "tool"`** — necessaire pour le filtrage par type.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan B2 — TOOLS Memory] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan B2 : Tool Blocks Memory/State
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 3
  - memory-read : CREE / TESTE / PUBLIE / VALIDE
  - memory-write : CREE / TESTE / PUBLIE / VALIDE
  - state-manager : CREE / TESTE / PUBLIE / VALIDE
**Backend requis pour state-manager** : ACTIF / NON
**Problemes** : [si BLOQUE]
```
