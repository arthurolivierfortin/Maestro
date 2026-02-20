# 9. Tool Blocks — Specification

Les tool blocks sont des blocs atomiques qui encapsulent des operations generiques. Ils sont invocables par n'importe quel agent via le CLI (`maestro run <tool-id> --input key=value`).

---

## 9.1 playwright-screenshot

**ID** : `playwright-screenshot`
**Type** : tool
**Version** : 4.0.0
**Categorie** : browser

### Description

Capture un screenshot d'une page web a une URL donnee. Retourne le chemin vers l'image.

### Block definition

```json
{
  "id": "playwright-screenshot",
  "name": "Playwright Screenshot",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "browser",
    "description": "Capture a screenshot of a web page"
  },
  "config": {
    "command": "playwright-screenshot",
    "parameters": [
      { "name": "url", "type": "string", "required": true, "description": "URL to screenshot" },
      { "name": "output", "type": "string", "required": false, "description": "Output file path (default: auto-generated)" },
      { "name": "fullPage", "type": "boolean", "required": false, "description": "Capture full page (default: false)" },
      { "name": "viewport", "type": "string", "required": false, "description": "Viewport size 'WxH' (default: 1280x720)" }
    ]
  }
}
```

### Implementation technique

Le tool block encapsule une execution Playwright via un script Node.js :

```
1. Lancer un browser headless Chromium
2. Naviguer vers l'URL
3. Attendre le load complete (networkidle)
4. Capturer le screenshot (viewport ou full page)
5. Sauvegarder dans le chemin output
6. Fermer le browser
7. Retourner le chemin du fichier
```

### Invocation via CLI

```json
{"tool":"maestro_cli","args":{"command":"run playwright-screenshot --input url=http://localhost:5173 --input output=screenshot-01.png"}}
```

### Prerequis

- `playwright` npm package installe
- `npx playwright install chromium` execute pour telecharger le browser

---

## 9.2 playwright-accessibility

**ID** : `playwright-accessibility`
**Type** : tool
**Version** : 4.0.0
**Categorie** : browser

### Description

Lit l'arbre d'accessibilite d'une page web. Retourne une representation structuree de l'arbre.

### Block definition

```json
{
  "id": "playwright-accessibility",
  "name": "Playwright Accessibility Tree",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "browser",
    "description": "Read the accessibility tree of a web page"
  },
  "config": {
    "command": "playwright-accessibility",
    "parameters": [
      { "name": "url", "type": "string", "required": true, "description": "URL to analyze" },
      { "name": "selector", "type": "string", "required": false, "description": "CSS selector to scope (default: entire page)" }
    ]
  }
}
```

### Implementation technique

```
1. Lancer un browser headless Chromium
2. Naviguer vers l'URL
3. Attendre le load complete
4. Appeler page.accessibility.snapshot()
5. Serialiser l'arbre en JSON
6. Fermer le browser
7. Retourner l'arbre d'accessibilite
```

### Output format

```json
{
  "role": "WebArea",
  "name": "My App",
  "children": [
    {
      "role": "navigation",
      "name": "Main navigation",
      "children": [
        { "role": "link", "name": "Home", "href": "/" },
        { "role": "link", "name": "Users", "href": "/users" }
      ]
    },
    {
      "role": "main",
      "name": "Content",
      "children": [
        { "role": "heading", "name": "User List", "level": 1 },
        {
          "role": "list",
          "children": [
            { "role": "listitem", "name": "John Doe - john@example.com" }
          ]
        }
      ]
    }
  ]
}
```

### Avantages vs screenshots

| Critere | Accessibility tree | Screenshot |
|---------|-------------------|------------|
| Taille | 2-5KB JSON | 100-500KB image |
| Cout LLM | ~500 tokens | ~2000 tokens (vision) |
| Stabilite | Role/name persistent | Classes CSS changent |
| Vitesse | ~200ms | ~1000ms |
| Semantique | Structuree (role, name, state) | Pixel (interpretation necessaire) |

**Regle** : utiliser l'arbre d'accessibilite pour 90% des interactions. Utiliser les screenshots uniquement pour : layout/alignment visuel, animations, canvas/WebGL, bugs CSS.

---

## 9.3 playwright-interact

**ID** : `playwright-interact`
**Type** : tool
**Version** : 4.0.0
**Categorie** : browser

### Description

Interagit avec le DOM d'une page web : navigation, clics, saisie de texte, scroll, attente.

### Block definition

```json
{
  "id": "playwright-interact",
  "name": "Playwright Interact",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "browser",
    "description": "Interact with a web page via Playwright"
  },
  "config": {
    "command": "playwright-interact",
    "parameters": [
      { "name": "action", "type": "string", "required": true, "description": "navigate|click|type|select|scroll|wait|evaluate" },
      { "name": "url", "type": "string", "required": false, "description": "URL for navigate action" },
      { "name": "selector", "type": "string", "required": false, "description": "Element selector (role-based preferred)" },
      { "name": "text", "type": "string", "required": false, "description": "Text for type action" },
      { "name": "value", "type": "string", "required": false, "description": "Value for select action" },
      { "name": "timeout", "type": "number", "required": false, "description": "Timeout in ms (default: 5000)" }
    ]
  }
}
```

### Actions supportees

| Action | Params requis | Description |
|--------|---------------|-------------|
| `navigate` | url | Naviguer vers une URL |
| `click` | selector | Cliquer sur un element |
| `type` | selector, text | Taper du texte dans un champ |
| `select` | selector, value | Selectionner dans un dropdown |
| `scroll` | selector (opt) | Scroller vers un element ou le bas de page |
| `wait` | selector | Attendre qu'un element soit visible |
| `evaluate` | text (JS code) | Executer du JavaScript dans la page |

### Selecteurs (priorite d'accessibilite)

```
1. role=button[name='Submit']     — par ARIA role
2. text=Submit                    — par texte visible
3. label=Email                    — par label associe
4. [data-testid='submit-btn']    — par test ID
5. #submit-btn                   — par ID
6. .btn-primary                  — par classe CSS (EVITER)
```

---

## 9.4 web-search

**ID** : `web-search`
**Type** : tool
**Version** : 4.0.0
**Categorie** : research

### Description

Effectue une recherche web et retourne les resultats structures.

### Block definition

```json
{
  "id": "web-search",
  "name": "Web Search",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "research",
    "description": "Search the web and return structured results"
  },
  "config": {
    "command": "web-search",
    "parameters": [
      { "name": "query", "type": "string", "required": true, "description": "Search query" },
      { "name": "maxResults", "type": "number", "required": false, "description": "Max results (default: 5)" }
    ]
  }
}
```

### Implementation technique

Deux options, par priorite :
1. **API de recherche** (SearXNG self-hosted, DuckDuckGo API) — plus rapide, plus fiable
2. **Playwright scraping** — naviguer vers un moteur de recherche, extraire les resultats

### Output format

```json
{
  "results": [
    {
      "title": "React Query v5 Documentation",
      "url": "https://tanstack.com/query/latest/docs",
      "snippet": "TanStack Query gives you declarative, automatic..."
    }
  ],
  "query": "React Query v5 cache invalidation",
  "totalResults": 5
}
```

---

## 9.5 compilation-check

**ID** : `compilation-check`
**Type** : tool
**Version** : 4.0.0
**Categorie** : validation

### Description

Build le projet et retourne les resultats de compilation (succes, erreurs, warnings).

### Block definition

```json
{
  "id": "compilation-check",
  "name": "Compilation Check",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "validation",
    "description": "Build the project and report compilation results"
  },
  "config": {
    "command": "compilation-check",
    "parameters": [
      { "name": "workingDir", "type": "string", "required": true, "description": "Project root directory" },
      { "name": "buildCommand", "type": "string", "required": false, "description": "Override build command (auto-detected if not provided)" }
    ]
  }
}
```

### Auto-detection du build command

| Fichier present | Build command |
|-----------------|--------------|
| `package.json` avec scripts.build | `npm run build` |
| `package.json` sans scripts.build | `npx tsc --noEmit` (si TypeScript) |
| `*.csproj` | `dotnet build` |
| `Cargo.toml` | `cargo build` |
| `go.mod` | `go build ./...` |
| `pyproject.toml` | `python -m py_compile` ou `mypy` |

---

## 9.6 memory-read

**ID** : `memory-read`
**Type** : tool
**Version** : 4.0.0
**Categorie** : memory

### Description

Lit un fichier de memoire depuis `.maestro/memory/`.

### Block definition

```json
{
  "id": "memory-read",
  "name": "Memory Read",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "memory",
    "description": "Read a memory file from .maestro/memory/"
  },
  "config": {
    "command": "memory-read",
    "parameters": [
      { "name": "file", "type": "string", "required": false, "description": "File name (default: index.md)" },
      { "name": "topic", "type": "string", "required": false, "description": "Search for a topic across all memory files" }
    ]
  }
}
```

### Comportement

- Si `file` est fourni : lire `.maestro/memory/{file}` et retourner le contenu
- Si `topic` est fourni : chercher dans tous les fichiers `.maestro/memory/*.md` pour le topic
- Si aucun : lire `.maestro/memory/index.md` (fichier principal)

---

## 9.7 memory-write

**ID** : `memory-write`
**Type** : tool
**Version** : 4.0.0
**Categorie** : memory

### Description

Ecrit ou met a jour un fichier de memoire dans `.maestro/memory/`.

### Block definition

```json
{
  "id": "memory-write",
  "name": "Memory Write",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "memory",
    "description": "Write a memory file to .maestro/memory/"
  },
  "config": {
    "command": "memory-write",
    "parameters": [
      { "name": "file", "type": "string", "required": true, "description": "File name to write (e.g., conventions.md)" },
      { "name": "content", "type": "string", "required": true, "description": "Content to write" },
      { "name": "mode", "type": "string", "required": false, "description": "write (overwrite) or append (default: write)" }
    ]
  }
}
```

### Structure de `.maestro/memory/`

```
.maestro/memory/
├── index.md          — Fichier principal : resume du projet, liens vers topics
├── conventions.md    — Conventions decouvertes (naming, imports, patterns)
├── architecture.md   — Architecture decouvertes (structure, patterns)
├── learnings.md      — Lecons apprises (erreurs, corrections, insights)
└── history.md        — Historique des sessions precedentes
```

---

## 9.8 state-manager

**ID** : `state-manager`
**Type** : tool
**Version** : 4.0.0
**Categorie** : infrastructure

Deja documente en detail dans [02-interaction-handler.md](02-interaction-handler.md#state-manager--specification-complete).

### Block definition (rappel)

```json
{
  "id": "state-manager",
  "name": "State Manager",
  "version": "4.0.0",
  "blockType": "tool",
  "isAtomic": true,
  "metadata": {
    "designation": "tool",
    "category": "infrastructure",
    "description": "Gestion de l'etat partage entre le workflow et l'interaction-handler"
  },
  "config": {
    "command": "state-manager",
    "operations": ["get", "set", "transition", "pause", "resume", "rewind", "inject"]
  }
}
```

### Invocation via CLI

```json
{"tool":"maestro_cli","args":{"command":"run state-manager --input-json {\"operation\":\"get\",\"path\":\"currentPhase\"}"}}

{"tool":"maestro_cli","args":{"command":"run state-manager --input-json {\"operation\":\"set\",\"path\":\"results.comprendre\",\"value\":{...}}"}}

{"tool":"maestro_cli","args":{"command":"run state-manager --input-json {\"operation\":\"pause\"}"}}

{"tool":"maestro_cli","args":{"command":"run state-manager --input-json {\"operation\":\"rewind\",\"toPhase\":\"planifier\"}"}}
```

---

## Prerequis d'installation

| Tool block | Prerequis | Commande d'installation |
|-----------|-----------|------------------------|
| playwright-* | Node.js + playwright | `npm install playwright && npx playwright install chromium` |
| web-search | SearXNG ou Playwright | SearXNG: Docker / Playwright: deja installe |
| compilation-check | Aucun (detecte le build tool du projet) | N/A |
| memory-* | Aucun (fichiers locaux) | `mkdir -p .maestro/memory` |
| state-manager | API Maestro backend en cours d'execution | N/A |

---

## Principes de conception des tool blocks

1. **Generiques** : invocables par n'importe quel agent, n'importe quel modele
2. **Atomiques** : une seule operation par invocation
3. **Idempotents** quand possible : re-executer ne cause pas d'effets secondaires
4. **Self-describing** : le block.json contient tous les parametres avec descriptions
5. **Error-propagating** : les erreurs remontent clairement (pas de fallback silencieux)
6. **CLI-first** : invocables via `maestro run <tool-id> --input key=value`
