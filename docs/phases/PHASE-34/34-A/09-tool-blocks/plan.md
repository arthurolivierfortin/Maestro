> **NOTE** : Ce plan a ete decoupe en sous-plans executables independamment :
> - [plan-playwright.md](plan-playwright.md) — playwright-screenshot, playwright-accessibility, playwright-interact
> - [plan-memory.md](plan-memory.md) — memory-read, memory-write, state-manager
> - [plan-utility.md](plan-utility.md) — web-search, compilation-check
> Les sous-plans sont auto-suffisants et incluent tout le contexte necessaire.

# Plan — Tool Blocks v4 : 8 blocs utilitaires

**Objectif** : Creer les 8 tool blocks necessaires au workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/09-tool-blocks/spec.md`.
**Impact** : Creation de fichiers JSON + scripts Node.js dans `content/system/blocks/tools/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient les details de conception pour chaque tool block.
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

---

## Bloc 1 : playwright-screenshot

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/playwright-screenshot/playwright-screenshot.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/playwright-screenshot/screenshot.js` | Script Playwright |

### Block definition JSON

```json
{
  "id": "playwright-screenshot",
  "name": "Playwright Screenshot",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Captures a screenshot of a web page at a given URL using Playwright. Returns the output file path and image dimensions.",
  "inputs": [
    { "id": "url", "type": "string", "required": true, "description": "URL to screenshot" },
    { "id": "output", "type": "string", "required": false, "description": "Output file path (default: auto-generated in OS temp dir)" },
    { "id": "fullPage", "type": "boolean", "required": false, "description": "Capture full scrollable page (default: false)" },
    { "id": "viewport", "type": "string", "required": false, "description": "Viewport size as 'WxH' e.g. '1280x720' (default: 1280x720)" }
  ],
  "outputs": [
    { "id": "filePath", "type": "string", "description": "Absolute path to the saved screenshot" },
    { "id": "width", "type": "number", "description": "Image width in pixels" },
    { "id": "height", "type": "number", "description": "Image height in pixels" },
    { "id": "success", "type": "boolean", "description": "Whether the screenshot was captured successfully" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "screenshot.js",
    "parseOutput": "json",
    "timeout": 30000
  },
  "metadata": {
    "category": "browser",
    "designation": "tool",
    "tags": ["playwright", "screenshot", "browser", "visual", "v4"]
  }
}
```

### Script : screenshot.js

```javascript
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

(async () => {
  const url = process.env.MAESTRO_INPUT_URL;
  const outputPath = process.env.MAESTRO_INPUT_OUTPUT || path.join(os.tmpdir(), `maestro-screenshot-${Date.now()}.png`);
  const fullPage = process.env.MAESTRO_INPUT_FULLPAGE === 'true';
  const viewportStr = process.env.MAESTRO_INPUT_VIEWPORT || '1280x720';

  if (!url) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: url', filePath: null, width: 0, height: 0 }));
    process.exit(0);
  }

  const [vw, vh] = viewportStr.split('x').map(Number);
  const viewport = { width: vw || 1280, height: vh || 720 };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

    await page.screenshot({ path: outputPath, fullPage });

    const size = page.viewportSize();
    console.log(JSON.stringify({
      success: true,
      filePath: path.resolve(outputPath),
      width: size.width,
      height: fullPage ? (await page.evaluate(() => document.documentElement.scrollHeight)) : size.height
    }));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, filePath: null, width: 0, height: 0 }));
  } finally {
    if (browser) await browser.close();
  }
})();
```

### Prerequis

- `npm install playwright` (dans le repertoire du projet ou globalement)
- `npx playwright install chromium`

### Verification

```bash
# Verifier la decouverte du bloc
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'playwright-screenshot'"
# Resultat attendu : playwright-screenshot  tool  4.0.0

# Execution (necessite un serveur web local)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run playwright-screenshot --input url=https://example.com"
# Resultat attendu : JSON avec success=true et filePath vers un fichier .png
```

---

## Bloc 2 : playwright-accessibility

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/playwright-accessibility/playwright-accessibility.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/playwright-accessibility/accessibility.js` | Script Playwright |

### Block definition JSON

```json
{
  "id": "playwright-accessibility",
  "name": "Playwright Accessibility Tree",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Reads the accessibility tree of a web page using Playwright. Returns a structured JSON tree with roles, names, and states. Much cheaper than screenshots for LLM consumption (~500 tokens vs ~2000 for vision).",
  "inputs": [
    { "id": "url", "type": "string", "required": true, "description": "URL to analyze" },
    { "id": "selector", "type": "string", "required": false, "description": "CSS selector to scope the tree (default: entire page)" }
  ],
  "outputs": [
    { "id": "tree", "type": "object", "description": "Accessibility tree as JSON (roles, names, children)" },
    { "id": "nodeCount", "type": "number", "description": "Total number of accessible nodes" },
    { "id": "success", "type": "boolean", "description": "Whether the tree was read successfully" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "accessibility.js",
    "parseOutput": "json",
    "timeout": 20000
  },
  "metadata": {
    "category": "browser",
    "designation": "tool",
    "tags": ["playwright", "accessibility", "a11y", "browser", "v4"]
  }
}
```

### Script : accessibility.js

```javascript
const { chromium } = require('playwright');

function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

(async () => {
  const url = process.env.MAESTRO_INPUT_URL;
  const selector = process.env.MAESTRO_INPUT_SELECTOR || null;

  if (!url) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: url', tree: null, nodeCount: 0 }));
    process.exit(0);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

    let root;
    if (selector) {
      const element = await page.$(selector);
      if (!element) {
        console.log(JSON.stringify({ success: false, error: `Selector '${selector}' not found`, tree: null, nodeCount: 0 }));
        await browser.close();
        process.exit(0);
      }
      // Snapshot from the element's perspective
      root = await page.accessibility.snapshot({ root: element });
    } else {
      root = await page.accessibility.snapshot();
    }

    const nodeCount = countNodes(root);
    console.log(JSON.stringify({ success: true, tree: root, nodeCount }));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, tree: null, nodeCount: 0 }));
  } finally {
    if (browser) await browser.close();
  }
})();
```

### Prerequis

Memes que playwright-screenshot (playwright + chromium).

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'playwright-accessibility'"
# Resultat attendu : playwright-accessibility  tool  4.0.0

powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run playwright-accessibility --input url=https://example.com"
# Resultat attendu : JSON avec success=true, tree={role:'WebArea',...}, nodeCount > 0
```

---

## Bloc 3 : playwright-interact

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/tools/playwright-interact/playwright-interact.tool.block.json` | Definition du bloc |
| `content/system/blocks/tools/playwright-interact/interact.js` | Script Playwright |

### Block definition JSON

```json
{
  "id": "playwright-interact",
  "name": "Playwright Interact",
  "blockType": "tool",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Interacts with a web page via Playwright: navigation, clicks, text input, scroll, wait, evaluate JavaScript. Supports accessibility-first selectors (role, text, label).",
  "inputs": [
    { "id": "action", "type": "string", "required": true, "description": "Action: navigate|click|type|select|scroll|wait|evaluate" },
    { "id": "url", "type": "string", "required": false, "description": "URL for navigate action" },
    { "id": "selector", "type": "string", "required": false, "description": "Element selector (role-based preferred, e.g. role=button[name='Submit'])" },
    { "id": "text", "type": "string", "required": false, "description": "Text for type action, or JS code for evaluate action" },
    { "id": "value", "type": "string", "required": false, "description": "Value for select action" },
    { "id": "timeout", "type": "number", "required": false, "description": "Timeout in ms (default: 5000)" }
  ],
  "outputs": [
    { "id": "success", "type": "boolean", "description": "Whether the action succeeded" },
    { "id": "result", "type": "string", "description": "Action result (page title after navigate, evaluate return value, etc.)" },
    { "id": "pageTitle", "type": "string", "description": "Current page title after action" },
    { "id": "currentUrl", "type": "string", "description": "Current page URL after action" }
  ],
  "config": {
    "runtime": "node",
    "scriptFile": "interact.js",
    "parseOutput": "json",
    "timeout": 30000
  },
  "metadata": {
    "category": "browser",
    "designation": "tool",
    "tags": ["playwright", "interact", "browser", "dom", "v4"]
  }
}
```

### Script : interact.js

```javascript
const { chromium } = require('playwright');

// Resolve Playwright-style selectors: role=button[name='Submit'], text=Submit, label=Email
function resolveSelector(sel) {
  if (!sel) return null;
  if (sel.startsWith('role=')) {
    const match = sel.match(/^role=(\w+)\[name='(.+)'\]$/);
    if (match) return `role=${match[1]}[name="${match[2]}"]`;
    return sel;  // pass through for Playwright to interpret
  }
  if (sel.startsWith('text=')) return sel;
  if (sel.startsWith('label=')) return sel;
  // CSS selectors pass through directly
  return sel;
}

(async () => {
  const action = process.env.MAESTRO_INPUT_ACTION;
  const url = process.env.MAESTRO_INPUT_URL || '';
  const selector = process.env.MAESTRO_INPUT_SELECTOR || '';
  const text = process.env.MAESTRO_INPUT_TEXT || '';
  const value = process.env.MAESTRO_INPUT_VALUE || '';
  const timeout = parseInt(process.env.MAESTRO_INPUT_TIMEOUT || '5000', 10);

  if (!action) {
    console.log(JSON.stringify({ success: false, error: 'Missing required input: action', result: null, pageTitle: '', currentUrl: '' }));
    process.exit(0);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // If url is provided for non-navigate actions, navigate first
    if (action !== 'navigate' && url) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    }

    let result = '';
    const resolved = resolveSelector(selector);

    switch (action) {
      case 'navigate':
        if (!url) throw new Error('navigate action requires url input');
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        result = `Navigated to ${url}`;
        break;

      case 'click':
        if (!resolved) throw new Error('click action requires selector input');
        await page.locator(resolved).click({ timeout });
        result = `Clicked ${selector}`;
        break;

      case 'type':
        if (!resolved) throw new Error('type action requires selector input');
        if (!text) throw new Error('type action requires text input');
        await page.locator(resolved).fill(text, { timeout });
        result = `Typed "${text}" into ${selector}`;
        break;

      case 'select':
        if (!resolved) throw new Error('select action requires selector input');
        if (!value) throw new Error('select action requires value input');
        await page.locator(resolved).selectOption(value, { timeout });
        result = `Selected "${value}" in ${selector}`;
        break;

      case 'scroll':
        if (resolved) {
          await page.locator(resolved).scrollIntoViewIfNeeded({ timeout });
          result = `Scrolled to ${selector}`;
        } else {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          result = 'Scrolled to bottom of page';
        }
        break;

      case 'wait':
        if (!resolved) throw new Error('wait action requires selector input');
        await page.locator(resolved).waitFor({ state: 'visible', timeout });
        result = `Element ${selector} is visible`;
        break;

      case 'evaluate':
        if (!text) throw new Error('evaluate action requires text input (JS code)');
        const evalResult = await page.evaluate(text);
        result = typeof evalResult === 'object' ? JSON.stringify(evalResult) : String(evalResult);
        break;

      default:
        throw new Error(`Unknown action: ${action}. Supported: navigate, click, type, select, scroll, wait, evaluate`);
    }

    console.log(JSON.stringify({
      success: true,
      result,
      pageTitle: await page.title(),
      currentUrl: page.url()
    }));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message, result: null, pageTitle: '', currentUrl: '' }));
  } finally {
    if (browser) await browser.close();
  }
})();
```

### Points d'attention

1. **Chaque invocation lance un nouveau browser** — c'est voulu. Les tool blocks sont atomiques et stateless. Un agent qui veut enchainer plusieurs actions devra invoquer le bloc plusieurs fois. Une future optimisation pourrait maintenir un browser context via le state-manager, mais c'est hors scope v4.
2. **Les selecteurs role-based sont preferes** par le spec (voir section "Selecteurs" dans le spec). Le script les passe directement a Playwright qui les supporte nativement.

### Verification

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'playwright-interact'"
# Resultat attendu : playwright-interact  tool  4.0.0

powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run playwright-interact --input action=navigate --input url=https://example.com"
# Resultat attendu : JSON avec success=true, pageTitle='Example Domain'
```

---

## Bloc 4 : web-search

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

## Bloc 5 : compilation-check

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

## Bloc 6 : memory-read

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

## Bloc 7 : memory-write

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

## Bloc 8 : state-manager

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

Les blocs sont independants les uns des autres. L'ordre recommande est par difficulte/risque croissant :

1. **memory-read** et **memory-write** — simple filesystem, aucune dependance externe
2. **compilation-check** — shell execution + auto-detection, pas de dependance externe
3. **web-search** — necessite SearXNG ou fallback DuckDuckGo, risque de rate limiting
4. **state-manager** — necessite backend actif + session, complexite API REST
5. **playwright-screenshot**, **playwright-accessibility**, **playwright-interact** — necessitent playwright + chromium installes

### Installation Playwright (prealable aux blocs 5-6-7)

```bash
# Installer playwright dans le repertoire tools (ou globalement)
cd C:\Meastro\content\system\blocks\tools
npm init -y
npm install playwright
npx playwright install chromium
```

**Alternative** : installer playwright globalement avec `npm install -g playwright` si on veut eviter un `node_modules/` dans le repertoire tools.

**Point d'attention** : le `ToolBlockExecutor` resout les scripts relativement au repertoire du bloc (`blockSourceDir`). Le script `require('playwright')` cherchera dans `node_modules` en remontant l'arborescence. Il faut donc que `playwright` soit installe soit dans le repertoire du bloc, soit dans un parent, soit globalement.

---

## Criteres de qualite

| Bloc | Test | Seuil |
|------|------|-------|
| playwright-screenshot | Capture d'un site public (example.com) | Fichier .png cree, taille > 0 |
| playwright-accessibility | Arbre d'un site public | JSON avec role='WebArea', nodeCount > 0 |
| playwright-interact | Navigate + click sur example.com | success=true, pageTitle non vide |
| web-search | Recherche "React hooks" | results.length > 0 |
| compilation-check | Build du desktop Maestro | buildCommand detecte, exitCode dans le JSON |
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

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, Playwright qui ne s'installe pas, bugs backend/CLI, doc manquante, temps excessifs, problemes npm/node_modules.

Format par entree :
```
### [Plan 09 — TOOL BLOCKS] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan — Tool Blocks v4
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 8
  - playwright-screenshot : CREE / TESTE / PUBLIE / VALIDE
  - playwright-accessibility : CREE / TESTE / PUBLIE / VALIDE
  - playwright-interact : CREE / TESTE / PUBLIE / VALIDE
  - web-search : CREE / TESTE / PUBLIE / VALIDE
  - compilation-check : CREE / TESTE / PUBLIE / VALIDE
  - memory-read : CREE / TESTE / PUBLIE / VALIDE
  - memory-write : CREE / TESTE / PUBLIE / VALIDE
  - state-manager : CREE / TESTE / PUBLIE / VALIDE
**Prerequis Playwright** : INSTALLE / NON
**Prerequis SearXNG** : INSTALLE / NON (fallback DuckDuckGo disponible)
**Problemes** : [si BLOQUE]
```
