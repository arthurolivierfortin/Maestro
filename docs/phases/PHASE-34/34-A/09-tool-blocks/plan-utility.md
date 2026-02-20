# Plan B3 — Tool Blocks (Utility) : web-search, compilation-check

**Objectif** : Creer les 2 tool blocks utilitaires du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/09-tool-blocks/spec.md`.
**Impact** : Creation de fichiers JSON + scripts Node.js dans `content/system/blocks/tools/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-utility.md`) : Lis ce fichier integralement avant de commencer
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

## Bloc 1 : web-search

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/web-search/web-search.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/web-search/search.js` | Script de recherche |

### Block definition JSON

```json
{
  "id": "web-search",
  "name": "Web Search",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Searches the web and returns structured results. Tries SearXNG API first (localhost:8888), falls back to DuckDuckGo HTML scraping via simple HTTPS request.",
  "inputs": [
    { "id": "query", "type": "string", "required": true, "description": "Search query" },
    { "id": "maxResults", "type": "number", "required": false, "description": "Maximum number of results to return (default: 5)" }
  ],
  "outputs": [
    { "id": "results", "type": "array", "description": "Array of {title, url, snippet}" },
    { "id": "query", "type": "string", "description": "The query that was executed" },
    { "id": "totalResults", "type": "number", "description": "Number of results returned" },
    { "id": "success", "type": "boolean", "description": "Whether the search succeeded" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "search.js",
    "parseOutput": "json",
    "timeout": 30000
  },
  "metadata": {
    "category": "research",
    "designation": "tool",
    "tags": ["web", "search", "research", "v4"]
  }
}
```

### Script : search.js

**Strategie** : le script essaie deux methodes dans l'ordre :
1. **SearXNG API** (si un SearXNG est disponible sur `localhost:8888`) — rapide, fiable, pas de rate limiting
2. **DuckDuckGo Lite** via HTTPS GET — pas de dependance externe, parsing HTML basique

```javascript
const https = require('https');
const http = require('http');

const query = process.env.MAESTRO_INPUT_QUERY || '';
const maxResults = parseInt(process.env.MAESTRO_INPUT_MAXRESULTS || '5', 10);

if (!query) {
  console.log(JSON.stringify({ success: false, error: 'Missing required input: query', results: [], query: '', totalResults: 0 }));
  process.exit(0);
}

function httpGet(urlStr, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    const req = mod.get(urlStr, { timeout, headers: { 'User-Agent': 'Maestro/4.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

async function trySearXNG() {
  const url = `http://localhost:8888/search?q=${encodeURIComponent(query)}&format=json&engines=google,duckduckgo&results=${maxResults}`;
  const res = await httpGet(url, 5000);
  if (res.status !== 200) throw new Error(`SearXNG returned ${res.status}`);
  const data = JSON.parse(res.data);
  return (data.results || []).slice(0, maxResults).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || ''
  }));
}

async function tryDuckDuckGoLite() {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await httpGet(url, 10000);
  if (res.status !== 200) throw new Error(`DuckDuckGo returned ${res.status}`);

  // Parse the HTML response to extract result links
  const results = [];
  const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  let match;
  while ((match = linkRegex.exec(res.data)) !== null && results.length < maxResults) {
    const resultUrl = match[1].replace(/&amp;/g, '&');
    const title = match[2].replace(/<[^>]*>/g, '').trim();
    results.push({ title, url: resultUrl, snippet: '' });
  }

  // Try to attach snippets
  let i = 0;
  while ((match = snippetRegex.exec(res.data)) !== null && i < results.length) {
    results[i].snippet = match[1].replace(/<[^>]*>/g, '').trim();
    i++;
  }

  if (results.length === 0) throw new Error('No results parsed from DuckDuckGo');
  return results;
}

(async () => {
  let results = [];
  let source = 'none';

  // Strategy 1: SearXNG
  try {
    results = await trySearXNG();
    source = 'searxng';
  } catch (e) {
    // Strategy 2: DuckDuckGo Lite
    try {
      results = await tryDuckDuckGoLite();
      source = 'duckduckgo-lite';
    } catch (e2) {
      console.log(JSON.stringify({
        success: false,
        error: `All search strategies failed. SearXNG: ${e.message}. DuckDuckGo: ${e2.message}`,
        results: [],
        query,
        totalResults: 0
      }));
      process.exit(0);
    }
  }

  console.log(JSON.stringify({
    success: true,
    results,
    query,
    totalResults: results.length,
    source
  }));
})();
```

### Prerequis

- **Option A (recommandee)** : SearXNG via Docker : `docker run -d -p 8888:8080 searxng/searxng`
- **Option B (fallback)** : aucune dependance — utilise DuckDuckGo Lite via HTTPS (pas toujours fiable, parsing HTML fragile)

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'web-search'"
# Resultat attendu : web-search  tool  4.0.0

powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run web-search --input query='React Query v5 cache invalidation'"
# Resultat attendu : JSON avec success=true, results=[{title, url, snippet}], totalResults > 0
```

---

## Bloc 2 : compilation-check

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/compilation-check/compilation-check.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/compilation-check/check.js` | Script d'auto-detection et execution |

### Block definition JSON

```json
{
  "id": "compilation-check",
  "name": "Compilation Check",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Builds the project and reports compilation results. Auto-detects the build command from project files (package.json, *.csproj, Cargo.toml, go.mod, pyproject.toml). Returns success/failure, errors, and warnings.",
  "inputs": [
    { "id": "workingDir", "type": "string", "required": true, "description": "Project root directory" },
    { "id": "buildCommand", "type": "string", "required": false, "description": "Override build command (auto-detected if not provided)" }
  ],
  "outputs": [
    { "id": "success", "type": "boolean", "description": "Whether the build succeeded" },
    { "id": "buildCommand", "type": "string", "description": "The build command that was executed" },
    { "id": "stdout", "type": "string", "description": "Build stdout (truncated to 10KB)" },
    { "id": "stderr", "type": "string", "description": "Build stderr (truncated to 10KB)" },
    { "id": "errorCount", "type": "number", "description": "Number of detected errors" },
    { "id": "warningCount", "type": "number", "description": "Number of detected warnings" },
    { "id": "exitCode", "type": "number", "description": "Build process exit code" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "check.js",
    "parseOutput": "json",
    "timeout": 120000
  },
  "metadata": {
    "category": "validation",
    "designation": "tool",
    "tags": ["compilation", "build", "validation", "check", "v4"]
  }
}
```

### Script : check.js

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || process.cwd();
const buildCommandOverride = process.env.MAESTRO_INPUT_BUILDCOMMAND || '';

function detectBuildCommand(dir) {
  // Check package.json
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.build) return 'npm run build';
      // Check for TypeScript
      const tsconfigPath = path.join(dir, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) return 'npx tsc --noEmit';
    } catch {}
    return 'npm run build';
  }

  // Check .csproj
  const csprojFiles = fs.readdirSync(dir).filter(f => f.endsWith('.csproj'));
  if (csprojFiles.length > 0) return 'dotnet build';

  // Check for .sln
  const slnFiles = fs.readdirSync(dir).filter(f => f.endsWith('.sln'));
  if (slnFiles.length > 0) return 'dotnet build';

  // Check Cargo.toml
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) return 'cargo build';

  // Check go.mod
  if (fs.existsSync(path.join(dir, 'go.mod'))) return 'go build ./...';

  // Check pyproject.toml
  if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'python -m py_compile';

  return null;
}

const buildCommand = buildCommandOverride || detectBuildCommand(workingDir);

if (!buildCommand) {
  console.log(JSON.stringify({
    success: false,
    buildCommand: null,
    stdout: '',
    stderr: 'Could not auto-detect build command. No package.json, *.csproj, Cargo.toml, go.mod, or pyproject.toml found.',
    errorCount: 0,
    warningCount: 0,
    exitCode: -1
  }));
  process.exit(0);
}

try {
  const stdout = execSync(buildCommand, {
    cwd: workingDir,
    encoding: 'utf-8',
    timeout: 100000,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const truncatedStdout = stdout.length > 10000 ? stdout.slice(-10000) + '\n--truncated--' : stdout;

  // Count errors/warnings in output
  const errorCount = (truncatedStdout.match(/\berror\b/gi) || []).length;
  const warningCount = (truncatedStdout.match(/\bwarning\b/gi) || []).length;

  console.log(JSON.stringify({
    success: true,
    buildCommand,
    stdout: truncatedStdout,
    stderr: '',
    errorCount,
    warningCount,
    exitCode: 0
  }));
} catch (err) {
  const stdout = (err.stdout || '').toString();
  const stderr = (err.stderr || '').toString();
  const truncStdout = stdout.length > 10000 ? stdout.slice(-10000) : stdout;
  const truncStderr = stderr.length > 10000 ? stderr.slice(-10000) : stderr;
  const combined = truncStdout + '\n' + truncStderr;

  const errorCount = (combined.match(/\berror\b/gi) || []).length;
  const warningCount = (combined.match(/\bwarning\b/gi) || []).length;

  console.log(JSON.stringify({
    success: false,
    buildCommand,
    stdout: truncStdout,
    stderr: truncStderr,
    errorCount,
    warningCount,
    exitCode: err.status || 1
  }));
}
```

### Prerequis

Aucune dependance externe. Utilise uniquement `child_process`, `fs`, et `path` (modules Node.js natifs). Le build tool du projet cible (npm, dotnet, cargo, go, python) doit etre installe sur la machine.

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'compilation-check'"
# Resultat attendu : compilation-check  tool  4.0.0

# Test sur un projet avec package.json
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run compilation-check --input workingDir=C:\Meastro\apps\desktop"
# Resultat attendu : JSON avec buildCommand='npm run build', success=true ou false avec errorCount

# Test avec override
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run compilation-check --input workingDir=C:\Meastro\apps\backend --input buildCommand='dotnet build'"
# Resultat attendu : JSON avec buildCommand='dotnet build'
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

Les blocs sont independants l'un de l'autre. L'ordre recommande est par difficulte/risque croissant :

1. **compilation-check** — shell execution + auto-detection, pas de dependance externe reseau
2. **web-search** — necessite SearXNG ou fallback DuckDuckGo, risque de rate limiting ou parsing HTML fragile

---

## Criteres de qualite (QualityScore)

| Bloc | Test | Seuil |
|------|------|-------|
| web-search | Recherche "React hooks" | results.length > 0 |
| compilation-check | Build du desktop Maestro | buildCommand detecte, exitCode dans le JSON |

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

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs, problemes de rate limiting DuckDuckGo.

Format par entree :
```
### [Plan B3 — TOOLS Utility] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan B3 : Tool Blocks Utility
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 2
  - web-search : CREE / TESTE / PUBLIE / VALIDE
  - compilation-check : CREE / TESTE / PUBLIE / VALIDE
**Prerequis SearXNG** : INSTALLE / NON (fallback DuckDuckGo disponible)
**Problemes** : [si BLOQUE]
```
