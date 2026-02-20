## Plan B2 : Tool Blocks Memory/State
**Statut** : DONE
**Date** : 2026-02-19
**Blocs crees** : 3 / 3
  - memory-read : CREE / TESTE / PUBLIE
  - memory-write : CREE / TESTE / PUBLIE
  - state-manager : CREE / TESTE / PUBLIE
**Backend requis pour state-manager** : ACTIF (localhost:5000)
**Problemes** : Aucun bloquant. Un fix mineur applique a state.js (API renvoie `{key, value}` wrapper, extraction `.value` ajoutee dans `getState()`).

### Details des tests

#### memory-read
- Scenario 1: lecture index.md par defaut -> success=true, exists=true, content correct
- Scenario 2: lecture fichier inexistant -> exists=false, content vide
- Scenario 3: recherche par topic -> trouve les correspondances dans les fichiers .md

#### memory-write
- Scenario 1: ecriture nouveau fichier -> success=true, bytesWritten=12
- Scenario 2: mode append -> contenu concatene avec separateur
- Scenario 3: relecture chaine write->read -> contenu intact

#### state-manager
- Scenario 1: set currentPhase -> success=true, previousState={}
- Scenario 2: get currentPhase -> value="planifier" correct
- Scenario 3: transition -> previousPhase/currentPhase/history mis a jour
- Scenario 4: get full state -> objet complet avec history
- Scenario 5: erreur sans sessionId -> message clair

### Approvals
- memory-read: 80ecf11c-01d4-4c6b-90b6-0a76dcd32c97 (pending)
- memory-write: 33e10c77-3178-4601-9e66-8bce53e57f7e (pending)
- state-manager: 53f81d7c-646f-4c9b-9173-866a5d66d8a4 (pending)

### Fix applique
- **state.js getState()**: L'API GET `/api/sessions/{id}/variables/{key}` renvoie `{key: "...", value: {...}}`, pas directement la valeur. Le `getState()` initial renvoyait le wrapper, ce qui faisait echouer les `getByPath()`. Fix: extraire `.value` du response data.

---

## Plan B3 : Tool Blocks Utility
**Statut** : DONE
**Date** : 2026-02-20
**Blocs crees** : 2 / 2
  - compilation-check : CREE / TESTE / PUBLIE
  - web-search : CREE / TESTE / PUBLIE
**Prerequis SearXNG** : NON (fallback DuckDuckGo HTML disponible et fonctionnel)
**Problemes** : 2 fixes appliques (voir ci-dessous), aucun bloquant.

### Details des tests

#### compilation-check
- Scenario 1: Auto-detection npm build sur apps/desktop -> buildCommand="npm run build" detecte, exitCode=1 (electron-builder packaging), errorCount=0, warningCount=2 (Sass deprecation)
- Scenario 2: Override dotnet build sur apps/backend -> buildCommand="dotnet build", success=true, exitCode=0, errorCount=0, warningCount=0

#### web-search
- Scenario 1: query="React hooks tutorial" -> success=true, 5 results, source=duckduckgo-html, titles/urls/snippets correct
- Scenario 2: query="TypeScript generics best practices", maxResults=3 -> success=true, 3 results, maxResults respecte

### Approvals
- compilation-check: 015b89e4-1950-4de1-92c5-a5798ab02895 (pending)
- web-search: 327b472f-af1e-4bf0-8f02-44902d6bd6b4 (pending)

### Fixes appliques
1. **check.js countIssues()**: Le regex naive `/\berror\b/gi` comptait les lignes de resume ("0 Error(s)") comme des erreurs. Fix: fonction `countIssues()` qui ignore les lignes commencant par un chiffre suivi de "error"/"warning" (ex: "0 Error(s)", "0 Warning(s)").
2. **search.js DuckDuckGo strategy**: `lite.duckduckgo.com` sert un CAPTCHA (status 202, bot detection). Remplace par `html.duckduckgo.com/html/` avec User-Agent navigateur, parsing des classes `result__a` et `result__snippet`, extraction URL reelle depuis le parametre `uddg` des liens de redirection DDG.

---

## Plan B1 : Tool Blocks Playwright
**Statut** : DONE
**Date** : 2026-02-19
**Blocs crees** : 3 / 3
  - playwright-screenshot : CREE / TESTE / PUBLIE
  - playwright-accessibility : CREE / TESTE / PUBLIE
  - playwright-interact : CREE / TESTE / PUBLIE
**Prerequis Playwright** : INSTALLE (playwright 1.58.2 + chromium, installed in content/system/blocks/tools/node_modules/)
**Problemes** : 2 fixes appliques (voir ci-dessous), aucun bloquant.

### Details des tests

#### playwright-screenshot
- Scenario 1: url=https://example.com -> success=true, filePath=temp PNG, width=1280, height=720
- Scenario 2: url=https://example.com, fullPage=true, viewport=800x600 -> success=true, width=800, height=600

#### playwright-accessibility
- Scenario 1: url=https://example.com -> success=true, tree={role:"document", children:[heading, paragraph, link]}, nodeCount=6
- Scenario 2: url=https://example.com, selector=body -> success=true, tree scoped to body, nodeCount=5

#### playwright-interact
- Scenario 1: action=navigate, url=https://example.com -> success=true, pageTitle="Example Domain", currentUrl contains example.com
- Scenario 2: action=evaluate, url=https://example.com, text=document.title -> success=true, result="Example Domain"

### Approvals
- playwright-screenshot: d14481e1-2b07-45f8-a9c1-f749dd4dc135 (pending)
- playwright-accessibility: 8d08dfc3-c9dd-4b61-95a8-f699606378ac (pending)
- playwright-interact: d61dcb8e-ecb8-47ea-9434-1847d315cf83 (pending)

### Fixes appliques
1. **waitUntil strategy**: Plan used `networkidle` which timed out on example.com. Changed all 3 scripts to `waitUntil: 'load'` with 20s timeout. More reliable for general-purpose use.
2. **Playwright accessibility API**: `page.accessibility.snapshot()` does not exist in Playwright 1.58.2. Rewrote accessibility.js to use `page.locator(':root').ariaSnapshot()` with a custom parser that converts YAML-like aria snapshot text into structured JSON tree (handles document, heading, paragraph, link, /url property patterns).
