# Plan d'implémentation : CLI Mode JSON

**Phase**: 12.2 - 12.3
**Effort estimé**: 3-4 jours
**Fichiers impactés**: 2 fichiers modifiés, 2 fichiers créés

---

## Objectif

Ajouter un mode `--json` au CLI Maestro pour que les agents LLM puissent envoyer des commandes structurées en JSON et recevoir des réponses JSON structurées, tout en préservant le mode texte actuel pour les humains.

---

## Analyse de l'existant

### CLI Architecture (tools/maestro-cli/index.js — 5845 lignes)

**Parser** : `minimist` (v1.2.8) — parsing basique, pas de validation de schéma
**Dispatch** : Chaîne `if/else` dans `executeWithArgv()` (ligne 4482+)
**Output** : `console.log()` + `console.table()` + emojis, pas d'abstraction
**API Client** : `tools/shared/api-client.js` — fetch-based, retourne du JSON brut
**Commandes** : 30+ primaires, 50+ sous-commandes

**Problèmes pour le mode JSON** :
1. Chaque commande fait ses propres `console.log()` — pas d'abstraction de sortie
2. Les emojis et le formatage ANSI sont mélangés avec les données
3. Pas de structure de réponse unifiée
4. L'erreur handling (`handleApiError` ligne 745) écrit directement sur stderr

### minimist argument parsing (ligne 4075-4078)

`--json` est déjà déclaré comme string dans les options minimist (ligne 4078), mais n'est pas utilisé comme flag global — il est seulement lu dans la commande `session vars` (ligne 4902).

---

## Work Packages

### WP1 : OutputFormatter — Abstraction de sortie

**Fichier** : `tools/maestro-cli/output-formatter.js` (NOUVEAU)

Créer une classe qui encapsule toute la sortie CLI :

```javascript
class OutputFormatter {
  constructor(jsonMode = false) {
    this.jsonMode = jsonMode;
    this._command = null;
  }

  setCommand(command) {
    this._command = command;
  }

  /**
   * Sortie principale — succès avec données
   * En mode texte : affiche le message + les données formatées
   * En mode JSON : écrit un objet JSON structuré sur stdout
   */
  success(data, message = null) {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data, message, command: this._command });
    } else {
      if (message) console.log(message);
      if (data !== undefined && data !== null) {
        if (Array.isArray(data)) {
          console.table(data);
        } else if (typeof data === 'object') {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(data);
        }
      }
    }
  }

  /**
   * Sortie d'erreur
   */
  error(message, code = null, details = null) {
    if (this.jsonMode) {
      this._writeJson({ status: 'error', code, message, details, command: this._command });
    } else {
      console.error(`❌ ${message}`);
      if (details) console.error(`   ${details}`);
    }
  }

  /**
   * Sortie informative (pas de données principales)
   */
  info(message) {
    if (this.jsonMode) {
      this._writeJson({ status: 'ok', data: null, message, command: this._command });
    } else {
      console.log(message);
    }
  }

  /**
   * Écriture JSON atomique sur stdout (une seule ligne, parseable)
   */
  _writeJson(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
  }
}

module.exports = { OutputFormatter };
```

**Schéma de réponse JSON** :

```jsonc
// Succès
{
  "status": "ok",
  "command": "session.create",
  "data": { "sessionId": "abc-123", "name": "Test", "type": "foundry" },
  "message": "Session created"      // optionnel, humain-lisible
}

// Erreur
{
  "status": "error",
  "command": "session.create",
  "code": "SESSION_NOT_FOUND",      // code machine-lisible
  "message": "Session 'xyz' does not exist",
  "details": null                    // optionnel, stack trace ou contexte
}
```

---

### WP2 : JSON Input Parser

**Fichier** : `tools/maestro-cli/json-parser.js` (NOUVEAU)

Parser qui transforme un input JSON en argv-like object compatible avec le dispatch existant :

```javascript
class JsonInputParser {
  /**
   * Parse un JSON command en objet compatible minimist (argv)
   *
   * Input:  {"command":"session.create","params":{"type":"foundry","name":"Test"}}
   * Output: { _: ['session', 'create'], type: 'foundry', name: 'Test', json: true }
   */
  static parse(jsonString) {
    const input = JSON.parse(jsonString);

    if (!input.command) {
      throw new Error('Missing required field: "command"');
    }

    // "session.create" → ['session', 'create']
    const parts = input.command.split('.');

    // Construire un objet compatible minimist
    const argv = {
      _: parts,
      json: true,  // Force le mode JSON pour la sortie
      ...(input.params || {})
    };

    return argv;
  }

  /**
   * Lit le JSON depuis stdin (pour les gros payloads)
   */
  static async parseFromStdin() {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => {
        try {
          resolve(JsonInputParser.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      process.stdin.on('error', reject);

      // Timeout après 5s si rien ne vient
      setTimeout(() => reject(new Error('Stdin timeout')), 5000);
    });
  }
}

module.exports = { JsonInputParser };
```

**Mapping des commandes JSON vers argv** :

| JSON command | argv._ | Params → flags |
|-------------|--------|----------------|
| `session.create` | `['session', 'create']` | `params.type → argv.type` |
| `session.invoke` | `['session', 'invoke']` | `params.id → argv._[2]`, `params.entryPoint → argv._[3]` |
| `session.set-var` | `['session', 'vars']` | `params.id → argv._[2]`, `'set' → argv._[3]`, `params.key → argv._[4]`, `params.value → argv._[5]` |
| `blocks` | `['blocks']` | — |
| `health` | `['health']` | — |
| `workspace.create` | `['workspace', 'create']` | `params.name → argv._[2]` |

**Cas spéciaux** : certaines commandes utilisent des positional args (argv._[2], argv._[3]) plutôt que des flags. Le parser doit gérer ce mapping via une table de correspondance :

```javascript
const POSITIONAL_MAPPINGS = {
  'session.invoke': { id: 2, entryPoint: 3 },
  'session.info': { id: 2 },
  'session.start': { id: 2 },
  'session.stop': { id: 2 },
  'session.exec': { id: 2, command: 3 },
  'session.vars.get': { id: 2, key: 4 },   // argv._[3] = 'get'
  'session.vars.set': { id: 2, key: 4, value: 5 },
  'monitor': { id: 1 },
  'workspace.info': { id: 2 },
  'block.info': { id: 2 },
};
```

---

### WP3 : Intégration dans le CLI principal

**Fichier modifié** : `tools/maestro-cli/index.js`

#### 3a. Point d'entrée — Détection du mode JSON

**Localisation** : Fin du fichier, section main (ligne ~5800+)

**Actuellement** :
```javascript
const argv = minimist(process.argv.slice(2), { ... });
// ... dispatch
```

**Changement** :
```javascript
const { OutputFormatter } = require('./output-formatter');
const { JsonInputParser } = require('./json-parser');

async function main() {
  let argv;
  let formatter;

  // Détecter le mode JSON
  const rawArgs = process.argv.slice(2);
  const hasJsonFlag = rawArgs.includes('--json');

  if (hasJsonFlag) {
    // Mode JSON : lire le JSON depuis l'argument suivant ou stdin
    const jsonArgIndex = rawArgs.indexOf('--json');
    const jsonValue = rawArgs[jsonArgIndex + 1];

    if (jsonValue && !jsonValue.startsWith('-')) {
      // --json '{"command":"session.create",...}'
      argv = JsonInputParser.parse(jsonValue);
    } else if (!process.stdin.isTTY) {
      // echo '{"command":...}' | node index.js --json
      argv = await JsonInputParser.parseFromStdin();
    } else {
      // --json sans valeur et pas de stdin → erreur
      console.error(JSON.stringify({
        status: 'error',
        code: 'MISSING_INPUT',
        message: 'Usage: --json \'{"command":"...","params":{...}}\' or pipe via stdin'
      }));
      process.exit(1);
    }
    formatter = new OutputFormatter(true);
  } else {
    // Mode texte classique (inchangé)
    argv = minimist(rawArgs, { boolean: [...], string: [...] });
    formatter = new OutputFormatter(false);
  }

  // Passer le formatter au dispatch
  await executeWithArgv(argv, formatter);
}
```

#### 3b. Modifier `executeWithArgv` pour accepter le formatter

**Localisation** : `executeWithArgv` (ligne ~4482)

**Changement** : Ajouter `formatter` comme deuxième paramètre et le passer aux fonctions de commande.

**Stratégie de migration progressive** :
1. Ajouter `formatter` comme paramètre optionnel avec défaut
2. Modifier d'abord les commandes les plus utilisées par les agents :
   - `session create` / `session list` / `session info`
   - `session invoke` / `session vars`
   - `session start` / `session stop`
   - `health`
   - `blocks` / `block info`
   - `workspace create` / `workspace list`
3. Les commandes non migrées continuent de fonctionner en mode texte (le formatter est ignoré si non utilisé)

#### 3c. Migration d'une commande type — `session create`

**Localisation** : `createSession()` (ligne ~818)

**Avant** :
```javascript
async function createSession(options) {
  // ...
  const session = await client.createSession(request);
  console.log('\n✅ Session created!\n');
  console.log(`  ID:        ${session.id}`);
  console.log(`  Name:      ${session.name}`);
  // ...
}
```

**Après** :
```javascript
async function createSession(options, formatter) {
  try {
    // ... build request (inchangé)
    const session = await client.createSession(request);

    formatter.success(
      { sessionId: session.id, name: session.name, type: session.type, status: session.status },
      `✅ Session created: ${session.id}`
    );
  } catch (error) {
    formatter.error(
      error.message || 'Failed to create session',
      error.code || 'CREATE_FAILED',
      error.details
    );
    if (!formatter.jsonMode) process.exit(1);
  }
}
```

#### 3d. Migration de `handleApiError`

**Localisation** : `handleApiError` (ligne ~745)

**Avant** :
```javascript
function handleApiError(error, action) {
  if (error.statusCode === 404) {
    console.error(`❌ Not found while ${action}`);
  } else if (...) { ... }
}
```

**Après** :
```javascript
function handleApiError(error, action, formatter) {
  const code = error.statusCode === 404 ? 'NOT_FOUND'
    : error.statusCode === 400 ? 'BAD_REQUEST'
    : error.statusCode === 409 ? 'CONFLICT'
    : 'API_ERROR';

  formatter.error(
    `Error ${action}: ${error.message}`,
    code,
    error.statusCode ? `HTTP ${error.statusCode}` : null
  );
}
```

---

### WP4 : Commande `--schema`

**Fichier modifié** : `tools/maestro-cli/index.js`

Ajouter une commande qui expose le schéma des commandes disponibles :

```javascript
if (cmd === '--schema' || argv.schema) {
  const schema = {
    version: '1.0',
    commands: {
      'health': {
        description: 'Check backend health',
        params: {}
      },
      'session.list': {
        description: 'List all sessions',
        params: {
          status: { type: 'string', enum: ['created', 'active', 'paused', 'ended'], required: false },
          project: { type: 'string', required: false },
          limit: { type: 'number', required: false, default: 50 }
        }
      },
      'session.create': {
        description: 'Create a new session',
        params: {
          type: { type: 'string', enum: ['foundry', 'project'], required: true },
          name: { type: 'string', required: true },
          project: { type: 'string', required: false, description: 'Project ID (required for project sessions)' },
          'repo-path': { type: 'string', required: false, description: 'Repository path to bind' },
          authority: { type: 'string', enum: ['human', 'agent', 'ai'], default: 'human' }
        }
      },
      'session.info': {
        description: 'Get session details',
        params: {
          id: { type: 'string', required: true }
        }
      },
      'session.start': {
        description: 'Start a session',
        params: {
          id: { type: 'string', required: true }
        }
      },
      'session.stop': {
        description: 'Stop a session',
        params: {
          id: { type: 'string', required: true }
        }
      },
      'session.invoke': {
        description: 'Invoke a session entry point',
        params: {
          id: { type: 'string', required: true },
          entryPoint: { type: 'string', required: true }
        }
      },
      'session.set-var': {
        description: 'Set a session variable',
        params: {
          id: { type: 'string', required: true },
          key: { type: 'string', required: true },
          value: { type: 'any', required: true }
        }
      },
      'session.get-var': {
        description: 'Get a session variable',
        params: {
          id: { type: 'string', required: true },
          key: { type: 'string', required: true }
        }
      },
      'blocks': {
        description: 'List all blocks',
        params: {
          type: { type: 'string', required: false }
        }
      },
      'block.info': {
        description: 'Get block details',
        params: {
          id: { type: 'string', required: true }
        }
      },
      'workspace.list': {
        description: 'List all workspaces',
        params: {}
      },
      'workspace.create': {
        description: 'Create a workspace',
        params: {
          name: { type: 'string', required: true },
          type: { type: 'string', enum: ['Research', 'Training', 'Staging', 'Production', 'Custom'], default: 'Custom' },
          'repo-path': { type: 'string', required: false, description: 'Repository path to bind' }
        }
      },
      'workspace.info': {
        description: 'Get workspace details',
        params: {
          id: { type: 'string', required: true }
        }
      },
      'monitor': {
        description: 'Open session monitor',
        params: {
          id: { type: 'string', required: true }
        }
      }
    }
  };

  formatter.success(schema);
  return;
}
```

---

### WP5 : Tests CLI JSON mode

**Fichier** : `tools/maestro-cli/tests/json-mode.test.js` (NOUVEAU)

Tests à écrire (Node.js, peut utiliser le test runner natif ou un framework simple) :

```
JsonInputParser Tests:
├── parse_ValidCommand_ReturnsArgv
├── parse_CommandWithParams_MapsToFlags
├── parse_PositionalParams_MappedCorrectly
├── parse_MissingCommand_ThrowsError
├── parse_InvalidJson_ThrowsError
├── parse_NestedObjectParam_Preserved
├── parse_DotNotation_SplitsToSubcommand

OutputFormatter Tests:
├── success_JsonMode_WritesStructuredJson
├── success_TextMode_WritesConsoleLog
├── error_JsonMode_WritesStructuredError
├── error_TextMode_WritesConsoleError
├── info_JsonMode_WritesWithNullData
├── success_ArrayData_TextMode_WritesTable

Integration Tests (spawn CLI as subprocess):
├── cli_JsonFlag_WithInlineJson_ReturnsJsonResponse
├── cli_JsonFlag_WithStdin_ReturnsJsonResponse
├── cli_SchemaFlag_ReturnsCommandSchema
├── cli_JsonFlag_InvalidCommand_ReturnsJsonError
├── cli_NoJsonFlag_ReturnsTextOutput
```

**Pattern de test d'intégration CLI** :
```javascript
const { execSync } = require('child_process');

function runCli(args) {
  const result = execSync(
    `node index.js ${args}`,
    { cwd: __dirname + '/..', encoding: 'utf8', timeout: 10000 }
  );
  return result;
}

function runCliJson(command) {
  const result = runCli(`--json '${JSON.stringify(command)}'`);
  return JSON.parse(result);
}

// Test
const response = runCliJson({ command: 'health' });
assert.strictEqual(response.status, 'ok');
assert.ok(response.data);
```

---

## Ordre d'implémentation

```
WP1 (OutputFormatter) ──┐
                         ├──> WP3 (Intégration CLI) ──> WP5 (Tests)
WP2 (JsonInputParser) ──┘
                              WP4 (--schema) ──────────>
```

WP1 et WP2 sont indépendants et peuvent être faits en parallèle. WP3 dépend des deux. WP4 peut être fait en parallèle avec WP3. WP5 en dernier.

---

## Commandes prioritaires à migrer (WP3)

Migrer en premier les commandes que les agents utilisent le plus :

| Priorité | Commande | Raison |
|----------|----------|--------|
| 1 | `health` | Vérification de base, simple |
| 2 | `session create` | Création de session |
| 3 | `session list` / `session info` | Découverte |
| 4 | `session start` / `session stop` | Lifecycle |
| 5 | `session invoke` | Exécution de workflow |
| 6 | `session vars` (get/set) | Lecture/écriture de state |
| 7 | `blocks` / `block info` | Découverte de blocks |
| 8 | `workspace create` / `workspace list` | Gestion de workspace |
| 9 | `monitor` | Le monitor TUI ne supporte pas JSON — skip |

Les commandes non migrées continuent de fonctionner normalement en mode texte. En mode `--json`, elles retournent `{ "status": "error", "code": "NOT_JSON_SUPPORTED", "message": "..." }`.

---

## Critères de succès

- [ ] `node index.js --json '{"command":"health"}'` retourne `{"status":"ok","data":{...}}`
- [ ] `node index.js --json '{"command":"session.create","params":{"type":"foundry","name":"Test","project":"p1"}}'` crée une session et retourne son ID en JSON
- [ ] `echo '{"command":"session.list"}' | node index.js --json` fonctionne via stdin
- [ ] `node index.js --schema` retourne le schéma des commandes
- [ ] `node index.js health` continue de fonctionner en mode texte (non-régression)
- [ ] Les erreurs en mode JSON retournent `{"status":"error","code":"...","message":"..."}`
- [ ] Tous les tests passent
