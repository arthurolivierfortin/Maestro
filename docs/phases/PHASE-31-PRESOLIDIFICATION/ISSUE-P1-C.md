# Issue P1-C : Fix LLM-Provider Monitor (6 Issues)

**Priorite** : P1 (broken functionality)
**Estimation** : 2-3 heures
**Bloque** : Rien
**Bloque par** : Rien
**Projet** : `C:\LLM-Provider\monitor\`

---

## Probleme

Le monitor separe du LLM-Provider (`C:\LLM-Provider\monitor\`) a 6 problemes identifies, dont un CRITIQUE qui empeche le monitor de fonctionner par defaut.

---

## Issue 1 : Wrong default port (CRITICAL)

**Fichier** : `C:\LLM-Provider\monitor\src\cli.ts:8`

**Code actuel** :
```typescript
const DEFAULT_URL = 'http://localhost:5000';
```

**Probleme** : Le LLM-Provider .NET API tourne sur le port **5010**, pas 5000. Le port 5000 est celui du backend Maestro. Le monitor se connecte au mauvais service par defaut.

**Fix** :
```typescript
const DEFAULT_URL = 'http://localhost:5010';
```

**Impact** : Sans `--url http://localhost:5010` explicite, le monitor ne fonctionne jamais. C'est probablement la cause principale des rapports "le monitor crash".

---

## Issue 2 : fs.watch fallback timer leak (HIGH)

**Fichier** : `C:\LLM-Provider\monitor\src\log-streamer.ts:41`

**Cause** : Quand `fs.watch` echoue, le fallback cree un `setInterval(1000)` mais ne stocke PAS la reference du timer. La methode `stop()` ne peut donc pas l'arreter.

**Fix** :
```typescript
private fallbackTimer: ReturnType<typeof setInterval> | null = null;

// In the fallback:
this.fallbackTimer = setInterval(() => { ... }, 1000);

// In stop():
if (this.fallbackTimer) {
  clearInterval(this.fallbackTimer);
  this.fallbackTimer = null;
}
```

---

## Issue 3 : Promise.all render storm (HIGH)

**Fichier** : `C:\LLM-Provider\monitor\src\hooks\use-api-polling.ts`

**Cause** : Le hook lance 6 appels API en parallele via `Promise.all` toutes les 2 secondes. Quand la connexion est coupee, les 6 requetes retournent `null` → 6 appels `setState` separees → cascade de re-renders.

**Fix** : Battre les mises a jour d'etat dans un seul setState :

```typescript
const [apiState, setApiState] = useState({
  health: null, models: null, queue: null,
  stats: null, conversations: null, providers: null
});

// After Promise.all:
setApiState({ health, models, queue, stats, conversations, providers });
```

Un seul `setState` au lieu de 6 → un seul re-render.

---

## Issue 4 : SIGTERM on Windows (MEDIUM)

**Fichier** : `C:\LLM-Provider\monitor\src\process-manager.ts`

**Cause** : `process.kill('SIGTERM')` ne fonctionne pas correctement pour les processus .NET sur Windows. Le processus peut ne pas se terminer proprement.

**Fix** : Utiliser `taskkill` sur Windows :

```typescript
import { platform } from 'os';

function stopProcess(pid: number) {
  if (platform() === 'win32') {
    execSync(`taskkill /F /PID ${pid} /T`);
  } else {
    process.kill(pid, 'SIGTERM');
  }
}
```

---

## Issue 5 : Nested null access (MEDIUM)

**Fichier** : `C:\LLM-Provider\monitor\src\app.tsx:62`

**Code actuel** :
```typescript
stats?.totalTokens.totalTokens
```

**Probleme** : L'optional chain `?.` est sur `stats` mais pas sur `totalTokens`. Si `stats.totalTokens` est `null` ou `undefined`, ca crash.

**Fix** :
```typescript
stats?.totalTokens?.totalTokens
```

---

## Issue 6 : lineCallbacks accumulation (LOW)

**Fichier** : `C:\LLM-Provider\monitor\src\log-streamer.ts`

**Cause** : `onLine()` push dans le tableau `lineCallbacks` sans moyen de retirer des listeners. Si le composant se mount/unmount plusieurs fois, les anciennes callbacks s'accumulent.

**Fix** : Retourner une fonction de nettoyage :

```typescript
onLine(callback: (line: string) => void): () => void {
  this.lineCallbacks.push(callback);
  return () => {
    const idx = this.lineCallbacks.indexOf(callback);
    if (idx >= 0) this.lineCallbacks.splice(idx, 1);
  };
}
```

---

## Backend-side (LLM-Provider .NET)

En plus des 6 issues du monitor, deux problemes backend :

### HealthEndpoints.cs sans try-catch

**Fichier** : `C:\LLM-Provider\dotnet\src\LLMProvider.Web\Endpoints\HealthEndpoints.cs`

Les appels a `provider.IsAvailableAsync()` ne sont pas entoures de try-catch. Si un provider throw (ex: `ClaudeCodeLLMProvider` quand `claude` n'est pas installe), le endpoint `/api/v1/health/` retourne 500 au lieu de `{ "provider": "unhealthy" }`.

### Zombie claude processes

`ClaudeCodeLLMProvider` peut laisser des processus `claude` zombies si `process.Kill()` echoue silencieusement. Ajouter un timeout et verifier que le processus est bien mort.

---

## Criteres de completion

- [ ] Le monitor se connecte au port 5010 par defaut (sans `--url`)
- [ ] Le fallback timer est nettoyable dans `stop()`
- [ ] Un seul re-render par cycle de polling (pas 6)
- [ ] Le processus .NET se termine proprement sur Windows
- [ ] Pas de crash sur `stats.totalTokens` null
- [ ] Les lineCallbacks ne s'accumulent pas au fil des mount/unmount
- [ ] Le endpoint health retourne un statut par provider, meme si un provider throw
