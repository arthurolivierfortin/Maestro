# Plan B1 — Tool Blocks (Playwright) : playwright-screenshot, playwright-accessibility, playwright-interact

**Objectif** : Creer les 3 tool blocks Playwright du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/09-tool-blocks/spec.md`.
**Impact** : Creation de fichiers JSON + scripts Node.js dans `content/system/blocks/tools/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-playwright.md`) : Lis ce fichier integralement avant de commencer
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

## Installation Playwright (prealable aux 3 blocs)

Les 3 blocs de ce plan necessitent Playwright + Chromium. Installer **avant** de creer les blocs :

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

Les 3 blocs partagent la meme dependance (Playwright + Chromium). L'ordre recommande est :

1. **playwright-screenshot** — le plus simple, une seule action (screenshot)
2. **playwright-accessibility** — similaire, une seule action (snapshot)
3. **playwright-interact** — le plus complexe (7 actions differentes)

Tous les 3 necessitent que Playwright + Chromium soient installes (voir section "Installation Playwright" ci-dessus).

---

## Criteres de qualite (QualityScore)

| Bloc | Test | Seuil |
|------|------|-------|
| playwright-screenshot | Capture d'un site public (example.com) | Fichier .png cree, taille > 0 |
| playwright-accessibility | Arbre d'un site public | JSON avec role='WebArea', nodeCount > 0 |
| playwright-interact | Navigate + click sur example.com | success=true, pageTitle non vide |

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
### [Plan B1 — TOOLS Playwright] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan B1 : Tool Blocks Playwright
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 3
  - playwright-screenshot : CREE / TESTE / PUBLIE / VALIDE
  - playwright-accessibility : CREE / TESTE / PUBLIE / VALIDE
  - playwright-interact : CREE / TESTE / PUBLIE / VALIDE
**Prerequis Playwright** : INSTALLE / NON
**Problemes** : [si BLOQUE]
```
