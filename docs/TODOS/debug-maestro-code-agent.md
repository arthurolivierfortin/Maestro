# DEBUG PLAN: `maestro code` — Agent ne répond pas

## Contexte

L'utilisateur lance `maestro code` global, envoie "allo", et reste bloqué en "processing"
indéfiniment. Le problème persiste après plusieurs tentatives de fix.

## Ce qu'on sait déjà (session log `d1373d2c`)

La session s'exécute bien jusqu'au bloc `execute-agent`, puis :

```
14:56:57 - execute-agent: Starting blockRef 'system:maestro-assistant'...
[... 10 minutes de silence ...]
15:06:57 - LLM request failed (iteration 1): LLM-Provider returned InternalServerError:
15:06:57 - Reducing context window from 20 to 15...
15:06:57 - LLM request failed (iteration 2): LLM-Provider returned InternalServerError:
15:06:57 - Reducing context window from 15 to 11...
... (4 itérations)
15:06:57 - Agent wall-clock timeout reached (600s) during LLM call.
```

**Conclusion** : Le LLM Provider retourne 500 (vide) pour le modèle `claude-sonnet-4-6`.
Cause probable : `claude-sonnet-4-6` n'est pas dans la liste `Providers.ClaudeCode.Models`
du `appsettings.json`, donc `LLMProviderFactory.GetProviderForModelAsync` lève
`InvalidOperationException: No provider found...` → 500 vide.

Un fix a déjà été appliqué (ajout de `claude-sonnet-4-6` dans les 3 copies de
`appsettings.json`), mais le process LLM Provider tournait peut-être encore avec
l'ancienne config au moment du test suivant.

---

## Ce que l'agent doit faire (dans l'ordre)

### Étape 1 — Vérifier l'état actuel des processes

```powershell
powershell.exe -Command "Get-Process -Name 'LLMProvider*','Maestro*' -ErrorAction SilentlyContinue | Select-Object Id, Name, StartTime | Format-Table"
```

Noter les PIDs et heures de démarrage. Si les processes tournent depuis avant le fix,
ils ont l'ancienne config en mémoire.

### Étape 2 — Vérifier les 3 copies d'appsettings.json

Confirmer que `claude-sonnet-4-6` est présent dans :

1. `C:\Meastro\llm-provider\dotnet\src\LLMProvider.Web\appsettings.json`
2. `C:\Meastro\packages\maestro-cli\dist\win-x64\llm-provider\appsettings.json`
3. `C:\Users\arthu\AppData\Roaming\npm\node_modules\@maestro\cli\dist\win-x64\llm-provider\appsettings.json`

Chercher la ligne `claude-sonnet-4-6` dans chaque fichier :
```bash
grep "claude-sonnet-4-6" <path_to_appsettings.json>
```

Si absent dans le fichier #3 (global install), l'ajouter AVANT de continuer.

### Étape 3 — Tuer les processes existants

```powershell
powershell.exe -Command "Stop-Process -Name 'LLMProvider.Web','Maestro.Api' -Force -ErrorAction SilentlyContinue; Write-Host 'Processes killed'"
```

Puis tuer les process `node` qui tournent depuis longtemps (potentiellement le sidecar) :
```powershell
powershell.exe -Command "Get-Process node | Where-Object { \$_.StartTime -lt (Get-Date).AddHours(-1) } | Stop-Process -Force -ErrorAction SilentlyContinue"
```

### Étape 4 — Créer un script de test PTY pour le global `maestro code`

Créer `C:\Meastro\TODO\test-maestro-code-global.mjs` avec ce contenu :

```js
// test-maestro-code-global.mjs
// Spawn le maestro code GLOBAL via PTY, envoie "allo", capture le résultat.
// Exécuter : node C:\Meastro\TODO\test-maestro-code-global.mjs

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use node-pty from the maestro-code package
const require = createRequire(import.meta.url);

async function main() {
  const pty = require(join('C:/Meastro/packages/maestro-code/node_modules', 'node-pty'));
  const { Terminal } = require(join('C:/Meastro/packages/maestro-code/node_modules', '@xterm/headless'));

  console.log('[test] Spawning global maestro code via PTY...');

  const term = new Terminal({ cols: 120, rows: 40, allowProposedApi: true });

  // Spawn the GLOBAL maestro command
  const proc = pty.spawn('cmd.exe', ['/c', 'maestro', 'code', '--no-bell'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: 'C:/Users/arthu',
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' },
  });

  proc.onData(data => term.write(data));

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function captureFrame() {
    const buffer = term.buffer.active;
    const lines = [];
    for (let i = 0; i < 40; i++) {
      const line = buffer.getLine(i);
      lines.push(line ? line.translateToString(true) : '');
    }
    return lines.filter(l => l.trim()).join('\n');
  }

  function printFrame(label) {
    console.log(`\n=== ${label} ===`);
    console.log(captureFrame());
    console.log('=== END ===\n');
  }

  // Wait for TUI to render (box-drawing chars)
  console.log('[test] Waiting for TUI render (up to 30s)...');
  let rendered = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const text = captureFrame();
    if (/[┌┐└┘│─╭╮╰╯]/.test(text)) {
      rendered = true;
      break;
    }
  }

  printFrame(rendered ? 'TUI Rendered' : 'TUI NOT rendered (timeout)');

  if (!rendered) {
    console.error('[test] FAIL: TUI did not render. Backend not running?');
    proc.kill();
    return;
  }

  // Press / to focus input
  console.log('[test] Pressing / to focus input...');
  proc.write('/');
  await sleep(500);
  printFrame('After / (input focus)');

  // Type "allo"
  console.log('[test] Typing "allo"...');
  for (const ch of 'allo') {
    proc.write(ch);
    await sleep(30);
  }
  await sleep(300);
  printFrame('After typing allo');

  // Press Enter
  console.log('[test] Pressing Enter...');
  proc.write('\r');

  // Wait for evidence of processing (up to 30s)
  console.log('[test] Waiting for session/processing state (up to 30s)...');
  let processed = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const text = captureFrame();
    if (/session|processing|invoking|Creating|allo/i.test(text)) {
      processed = true;
      printFrame(`State at ${i * 500}ms`);
      break;
    }
  }

  if (!processed) {
    printFrame('State after 30s (no change detected)');
  }

  // Wait for agent response (up to 120s)
  console.log('[test] Waiting for agent response (up to 120s)...');
  let done = false;
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    const text = captureFrame();
    if (/completed|error|failed|agent:/i.test(text)) {
      done = true;
      printFrame(`DONE at ${i * 500}ms`);
      break;
    }
    if (i % 20 === 0 && i > 0) {
      printFrame(`Still waiting... (${i * 500}ms)`);
    }
  }

  if (!done) {
    printFrame('TIMEOUT after 120s — still in processing');
  }

  proc.kill();
  term.dispose();
  console.log('[test] Done.');
}

main().catch(err => {
  console.error('[test] Fatal:', err);
  process.exit(1);
});
```

### Étape 5 — Lancer le test PTY

```bash
node C:/Meastro/TODO/test-maestro-code-global.mjs
```

Ce script va :
1. Spawner `maestro code` global via PTY avec node-pty
2. Attendre que le TUI rende (box-drawing chars)
3. Appuyer `/` pour focus l'input
4. Taper "allo" + Enter
5. Capturer tous les frames pertinents et les afficher

**L'agent doit rapporter exactement ce que le script affiche**, notamment :
- Est-ce que le TUI rend ?
- Est-ce que l'input reçoit "allo" ?
- Est-ce que quelque chose se passe après Enter ?
- Est-ce qu'une réponse arrive ?

### Étape 6 — Si ça échoue encore : lire les logs LLM Provider en temps réel

Pendant que le test PTY tourne, ouvrir une autre console et chercher les logs :

```powershell
# Trouver le répertoire de travail du LLM Provider process
powershell.exe -Command "(Get-Process -Name 'LLMProvider.Web' -ErrorAction SilentlyContinue).MainModule.FileName"
```

Chercher le dossier `logs/` à côté du binaire :
```bash
find "/c/Users/arthu/AppData/Roaming/npm/node_modules/@maestro/cli/dist/win-x64/llm-provider" -name "*.log" 2>/dev/null
```

Lire les logs récents :
```bash
tail -50 <log_file_path>
```

Le log devrait montrer :
- L'heure de démarrage
- Les modèles chargés (liste ClaudeCode)
- Les requêtes reçues
- L'erreur exacte pour `claude-sonnet-4-6`

### Étape 7 — Analyser et fixer

Selon ce que les logs montrent :

**Cas A — "No provider found for model claude-sonnet-4-6"** :
→ Le `appsettings.json` du process global n'a pas le fix.
→ Vérifier l'Étape 2 à nouveau. Peut-être qu'il y a PLUSIEURS copies du binaire.
→ Chercher : `find /c/Users/arthu -name "appsettings.json" -path "*/llm-provider/*"`

**Cas B — "Claude CLI failed (exit X): ..."** :
→ Le routing marche, mais la commande `claude --model claude-sonnet-4-6 ...` échoue.
→ Le fix dans `ClaudeCodeLLMProvider.ResolveModel()` mappe déjà `claude-sonnet-4-6` → `"sonnet"`.
→ Vérifier si le binaire `LLMProvider.Web.exe` contient ce mapping (c'est dans le code compilé).
→ Chercher si le mapping est bien dans le binaire publié (chercher dans les sources).

**Cas C — Le TUI ne rend pas / "Backend Not Available"** :
→ Backend ou LLM Provider n'a pas démarré.
→ Vérifier que le sidecar n'est pas bloqué : chercher les process node récents.
→ Vérifier les ports : `netstat -ano | grep "5000\|5010"`

**Cas D — Le TUI rend mais rien ne se passe après Enter** :
→ Problème dans le SessionManager ou l'API client.
→ Vérifier la console node du maestro code process pour des erreurs JS.
→ Chercher si `ensureSession` lève une exception silencieuse.

---

## Contraintes importantes

- **NE PAS utiliser curl** pour tester l'API directement — le test doit passer par le TUI
- **NE PAS** modifier le code source C# sans avoir d'abord observé l'erreur exacte
- **Rapporter les frames TUI** exactement tels qu'ils apparaissent
- **Rapporter les logs LLM Provider** mot pour mot

---

## Résultat attendu

Après le fix :
```
=== TUI Rendered ===
  MAESTRO  ...
  Agent: Bonjour ! Je suis l'assistant Maestro. Comment puis-je vous aider ?
=== END ===
```
