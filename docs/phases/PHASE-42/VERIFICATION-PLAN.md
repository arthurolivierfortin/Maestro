# Phase 42 Verification & Finalization — Using the Visual Gate

## Context

Phase 42 (restructuration maestro-code) est "EN COURS" dans le git status — dizaines de fichiers ajoutes/supprimes/modifies, mais jamais verifie contre le rendu reel. Phase 43 (Visual Gate) est maintenant DONE et fournit le pipeline de verification.

**Objectif** : Utiliser le visual gate pour verifier Phase 42, fixer le bug clavier detecte, enrichir les assertions structurelles, et declarer Phase 42 DONE.

**Bug detecte par le visual gate** : Les golden files montrent `> hs`, `> hsf`, `> hsfc`, `> hsfcm` dans le TaskInputBar — chaque touche de navigation est aussi capturee comme texte dans l'input bar.

---

## Sous-phases

| Phase | Titre | Effort | Dependance |
|-------|-------|--------|------------|
| A | Fix TaskInputBar keyboard conflict | 45-60 min | — |
| B | Enrichir les assertions du visual gate | 30-45 min | A (golden files changent apres fix) |
| C | Regenerer golden files + verifier Phase 42 | 20-30 min | A + B |

**Total : ~2 heures**

---

## Regles

1. **Ne PAS modifier `@maestro/tui`** (le design system partage)
2. **Ne PAS toucher au backend C#**
3. **Lire `docs/system/AGENT-PROTOCOL.md`** avant d'executer
4. **Ecrire checkpoint** apres chaque sous-phase
5. **Tous les tests existants doivent continuer a passer**

---

## A : Fix TaskInputBar Keyboard Conflict

### Probleme

Ink's `useInput` envoie TOUS les keystrokes a TOUS les hooks montes. TaskInputBar.useInput et les useKeyboard des pages (AgentScreen, HomeScreen, etc.) recoivent les memes touches. Resultat : presser 'h' navigate vers Home ET tape 'h' dans l'input.

### Solution

Ink's `useInput` supporte `{ isActive?: boolean }` (confirme dans `node_modules/ink/build/hooks/use-input.d.ts:107`). Quand `isActive=false`, le hook est completement desactive.

**Modele d'interaction** : slash-to-focus (comme Vi insert mode)
- Par defaut : `captureInput=false` → touches vont aux pages (navigation)
- User tape `/` ou `Enter` → `captureInput=true` → touches vont au TaskInputBar
- `Escape` → retour en mode navigation

### Fichiers a modifier

| Fichier | Changement |
|---------|------------|
| `components/TaskInputBar.ts` | Ajouter prop `captureInput?: boolean`, passer `{ isActive: !!captureInput }` a `useInput` |
| `hooks/useKeyboard.ts` | Ajouter parametre `options?: { isActive?: boolean }`, passer a `useInput` |
| `App.ts` | Ajouter state `inputFocused`, `useInput` pour `/`→focus et `Escape`→unfocus, passer `keyboardActive={!inputFocused}` aux pages et `captureInput={inputFocused}` au TaskInputBar |
| `components/AgentScreen.ts` | Ajouter prop `keyboardActive?: boolean`, passer `{ isActive: keyboardActive !== false }` a `useKeyboard` |
| `components/HomeScreen.ts` | Idem |
| `components/SpacesScreen.ts` | Idem |
| `components/FoundryScreen.ts` | Idem |
| `components/CatalogScreen.ts` | Idem |
| `components/ModelsScreen.ts` | Idem |
| `tests/TaskInputBar.test.ts` | Tests: `captureInput=false` ne capture pas, `captureInput=true` capture |

### Detail de l'implementation

**TaskInputBar.ts** — ajouter le prop et le passer a useInput :
```typescript
export interface TaskInputBarProps {
  // ... existing ...
  captureInput?: boolean;  // NEW
}

const TaskInputBar = ({ ..., captureInput, ... }) => {
  useInput((input, key) => {
    if (disabled) return;
    // ... existing handler unchanged ...
  }, { isActive: !!captureInput });  // KEY CHANGE
  // ... rest unchanged ...
};
```

**useKeyboard.ts** — ajouter options :
```typescript
const useKeyboard = (handlers: KeyboardHandlers = {}, options?: { isActive?: boolean }): void => {
  useInput((input: string, key) => {
    // ... existing handler logic unchanged ...
  }, { isActive: options?.isActive !== false });
};
```

**App.ts** — gerer le focus :
```typescript
const [inputFocused, setInputFocused] = useState(false);

// Activation hook — runs alongside page hooks
useInput((input, key) => {
  if (!inputFocused && (input === '/' || key.return)) {
    setInputFocused(true);
    return;
  }
  if (inputFocused && key.escape) {
    setInputFocused(false);
    return;
  }
}, { isActive: true });

// In pageProps: add keyboardActive: !inputFocused
// In TaskInputBar: pass captureInput={inputFocused}
```

**Chaque screen** (6 fichiers) — meme pattern :
```typescript
const XxxScreen = ({ ..., keyboardActive, ... }) => {
  useKeyboard({ ... }, { isActive: keyboardActive !== false });
  // ...
};
```

### Verification A
```bash
cd packages/maestro-code && npx vitest run tests/TaskInputBar.test.ts
cd packages/maestro-code && npx vitest run tests/App.test.ts
cd packages/maestro-code && node tests/real-demo-check.cjs
```

---

## B : Enrichir les Assertions du Visual Gate

### Ce qui manque actuellement

Les pages Spaces, Foundry, Catalog, Models n'ont que des assertions minimales (NavBar + tab indicator + TaskBar + bordures). Il manque :
- Titres de panels specifiques a chaque page
- Contenu des donnees demo (nombre de blocks, modeles, sessions)
- Assertions positionnelles (NavBar en haut, StatusBar en bas)
- Verification anti-regression du bug clavier

### Fichier a modifier

`tests/visual-gate.test.ts` — enrichir les tableaux d'assertions :

**NAVBAR_ASSERTION** — ajouter contrainte positionnelle :
```typescript
{ label: 'NavBar with MAESTRO title', pattern: 'MAESTRO', maxLine: 3 }
```

**TASKBAR_ASSERTION** — ajouter contrainte positionnelle :
```typescript
{ label: 'TaskInputBar visible', pattern: /Describe your task|Send|>/, minLine: 33 }
```

**Nouvelle assertion STATUS_BAR** — verifier la position :
```typescript
{ label: 'StatusBar at bottom', pattern: /page.*quit|select.*quit/, minLine: 37 }
```

**SPACES_PAGE_ASSERTIONS** — ajouter :
- Tab selector : `/Repos.*Workspaces.*Sessions/`
- Filter controls : `/Filter.*All.*Running/` ou `/\[a\].*All.*\[r\].*Running/`
- Session count : `/5 session/`
- Panel title : `'SESSIONS'`

**FOUNDRY_PAGE_ASSERTIONS** — ajouter :
- `'MY BLOCKS'`
- `/12 block/`
- `/workflow.*agent.*tool/`

**CATALOG_PAGE_ASSERTIONS** — ajouter :
- `'BLOCK CATALOG'`
- `/All.*Workflows.*Agents.*Tools/`
- `/12 block/`
- `/\d+%/` (fitness)

**MODELS_PAGE_ASSERTIONS** — ajouter :
- `'MODEL STATUS'`
- `'AVAILABLE MODELS'`
- `/claude-sonnet/`
- `/6 model/`

**HOME_PAGE_ASSERTIONS** — ajouter :
- `'QUICK ACTIONS'`
- `/Backend|LLM|Connected|Online/`

**Regression test du bug clavier** — ajouter dans le test de navigation :
```typescript
// After navigation, verify no garbage in TaskInputBar
for (const frame of frames) {
  const garbageLine = frame.lines.find(l => l.includes('>') && /[hsfcm]{2,}/.test(l));
  expect(garbageLine).toBeUndefined();
}
```

### Verification B
```bash
cd packages/maestro-code && npm run test:visual
```

---

## C : Regenerer Golden Files + Verifier Phase 42

### Etapes

1. **Regenerer les golden files** (le fix clavier change le contenu) :
```bash
cd packages/maestro-code && npx tsx tests/update-golden.ts
```
Verifier que les golden files ne contiennent plus `> hs`, `> hsfc`, etc.

2. **Run full test suite** :
```bash
cd packages/maestro-code && npx vitest run tests/
```
Tous les tests doivent passer (54 baseline + 4 visual gate + 1 smoke = ~59+).

3. **Verifications Phase 42 specifiques** :
```bash
# Aucune reference a @maestro/monitor
grep -r "@maestro/monitor" packages/maestro-code/ --include="*.ts"
# Aucune reference a l'ancien systeme spatial (hors commentaires/tests)
grep -r "useSpatialNav\|PageRegistry\|Mascotte" packages/maestro-code/ --include="*.ts" | grep -v test | grep -v ".cjs"
# Demo mode fonctionne
cd packages/maestro-code && node tests/real-demo-check.cjs
```

4. **Ecrire Phase 42 checkpoint** a `docs/phases/PHASE-42/checkpoint.md`

5. **Mettre a jour MEMORY.md** : Phase 42 DONE, note le fix clavier, nouveau test count

---

## Anti-patterns

- **Ne PAS utiliser `useFocus` d'Ink** — c'est pour le focus entre elements `<Box>`, pas pour notre cas (conflicterait avec Tab pour le type filter dans Catalog)
- **Ne PAS unmount/remount TaskInputBar** — cause perte d'etat React (texte typed disparait)
- **Ne PAS ajouter un intercepteur global de clavier dans App.ts** — Ink ne supporte pas la prevention par priorite
- **Ne PAS sauter la regeneration des golden files apres le fix clavier** — les golden actuels contiennent l'artefact du bug
- **Ne PAS utiliser des numeros de lignes exacts** — utiliser des ranges (minLine/maxLine) car le layout peut varier de 1-2 lignes
- **Ne PAS rendre le golden file comparison un hard gate** — garder en soft/warning seulement
