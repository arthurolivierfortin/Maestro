# Issue P1-B : Fix Ink Memory Leaks (6 Issues)

**Priorite** : P1 (stability)
**Estimation** : 3-4 heures
**Bloque** : Rien
**Bloque par** : Rien

---

## Probleme

Le TUI monitor Ink (Maestro) a 6 fuites memoire confirmees. Sur des sessions longues (>10 minutes), le monitor devient lent et peut crasher.

---

## Issue 1 : useMouse event listener leak (HIGH)

**Fichier** : `shared/tui/hooks/useMouse.ts:39-44`

**Cause** : La closure `onData` est recreee a chaque render. `stdin.on('data', onData)` ajoute un nouveau listener a chaque render, mais `stdin.off('data', onData)` dans le cleanup ne retire pas l'ancien car la reference a change.

**Fix** : Utiliser `useRef` pour stocker la callback :

```typescript
const onDataRef = useRef<(data: Buffer) => void>();

useEffect(() => {
  onDataRef.current = (data: Buffer) => {
    // ... mouse handling logic
  };
}, [/* dependencies that change the behavior */]);

useEffect(() => {
  const handler = (data: Buffer) => onDataRef.current?.(data);
  stdin.on('data', handler);
  return () => { stdin.off('data', handler); };
}, [stdin]); // Only re-subscribe if stdin changes
```

La reference `handler` ne change jamais → `stdin.off` retire effectivement le bon listener.

---

## Issue 2 : Stale data timer recreation (HIGH)

**Fichier** : `maestro-cli/monitor/ink/components/SessionMonitor.ts:668-680`

**Cause** : Le timer `setInterval(2000)` dans le `useEffect` de detection de donnees perimees est recree a chaque changement de `lastRefresh`. Si `lastRefresh` change toutes les 2 secondes (polling normal), le timer est recree toutes les 2 secondes — allocation rapide d'intervalles.

**Fix** : Deplacer la verification de peremption DANS le timer existant, ou utiliser `useRef` pour `lastRefresh` afin de ne pas recreer le timer :

```typescript
const lastRefreshRef = useRef(lastRefresh);
lastRefreshRef.current = lastRefresh;

useEffect(() => {
  const timer = setInterval(() => {
    const elapsed = Date.now() - lastRefreshRef.current;
    setIsStale(elapsed > 10000);
  }, 2000);
  return () => clearInterval(timer);
}, []); // Timer cree une seule fois
```

---

## Issue 3 : usePolling circular dependencies (MEDIUM)

**Fichier** : `shared/app/hooks/usePolling.ts:34-63`

**Cause** : Le tableau de dependances du `useCallback` pour `refresh` est sur-specifie, causant des recreations d'intervalle inutiles. Le `fetchFnRef` change a chaque render si `fetchFn` est une closure anonyme.

**Fix** : Simplifier les dependances. `fetchFnRef` est un ref — il n'a pas besoin d'etre dans le tableau de dependances car les refs sont mutables :

```typescript
const refresh = useCallback(async () => {
  // use fetchFnRef.current, not fetchFn directly
}, []); // No dependencies needed — ref is mutable
```

---

## Issue 4 : prevCursorRef unbounded growth (MEDIUM)

**Fichier** : `maestro-cli/monitor/ink/components/SessionMonitor.ts:545-546`

**Cause** : `prevCursorRef.current[focusedPanel] = cur;` accumule des entrees pour chaque panel visite. Le dictionnaire grandit sans limite et n'est jamais nettoye.

**Fix** : Limiter aux panels connus ou reset periodiquement :

```typescript
// Option 1: Only track known panels
const KNOWN_PANELS = ['tree', 'log', 'phases', 'llm', 'detail'] as const;
// In the effect:
if (!KNOWN_PANELS.includes(focusedPanel)) return;
```

**Note** : Severite reduite car le nombre de panels est en pratique fini. Mais le principe reste : un ref qui grandit sans borne est un probleme.

---

## Issue 5 : useScroll maxOffsetsRef growth (MEDIUM)

**Fichier** : `shared/tui/hooks/useScroll.ts:17-20`

**Cause** : `maxOffsetsRef.current[panel] = Math.max(0, max)` accumule des entrees sans nettoyage. Meme logique que Issue 4.

**Fix** : Meme approche — limiter aux panels connus ou ajouter un reset.

---

## Issue 6 : navStack unbounded (LOW)

**Fichier** : `maestro-cli/monitor/ink/App.ts:72-122`

**Cause** : La navigation profonde sans "back" accumule des entrees dans `navStack`. En pratique, la profondeur est limitee (3-4 niveaux max), mais il n'y a pas de limite explicite.

**Fix** : Ajouter une profondeur maximale :

```typescript
const MAX_NAV_DEPTH = 20;
setNavStack(prev => {
  const next = [...prev, currentScreen];
  return next.length > MAX_NAV_DEPTH ? next.slice(-MAX_NAV_DEPTH) : next;
});
```

---

## Criteres de completion

- [ ] useMouse : Un seul listener actif a la fois, verifie via `stdin.listenerCount('data')` en debug
- [ ] Stale timer : Timer cree une seule fois, pas recree a chaque poll
- [ ] usePolling : Pas de churn d'intervalle visible dans les logs
- [ ] prevCursorRef : Taille bornee
- [ ] maxOffsetsRef : Taille bornee
- [ ] navStack : Profondeur bornee
- [ ] Test global : Lancer le monitor 10+ minutes, verifier que la memoire RSS ne croit pas lineairement
