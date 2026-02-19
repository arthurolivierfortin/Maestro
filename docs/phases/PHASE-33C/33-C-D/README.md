# 33-C-D : Bugs + tests + validation E2E

**Statut** : PAS_COMMENCE
**Prerequis** : 33-C-C DONE (tous consommateurs migres, 0 imports shared/ restants, tests passent)
**Objectif** : Corriger les bugs connus dans @maestro/tui (useScroll, scroll per-panel, Home/End), ajouter des tests pour le toolkit, valider E2E les deux monitors.

**Regle** : Chaque bug fix = un test qui reproduisait le bug AVANT la correction.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `C:\Meastro\packages\tui\hooks\useScroll.ts` | Version canonique — bugs a corriger |
| `C:\Meastro\packages\tui\hooks\usePanelFocus.ts` | Version canonique — a tester |
| `C:\Meastro\packages\tui\hooks\useSelectableList.ts` | Version canonique — a tester |
| `C:\Meastro\packages\tui\keybindings\keybindings.ts` | Ajouter scroll.top / scroll.bottom |
| `C:\Meastro\packages\maestro-monitor\components\WorkflowTree.ts` | Bug : noeud collapse cache running children |
| `C:\Meastro\packages\maestro-monitor\App.ts` | Bug : hauteurs hardcodees |
| `C:\Meastro\packages\maestro-code\tests\App.test.ts` | Pattern de test existant (ink-testing-library) |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Fix useScroll dans @maestro/tui

**Bug 1 — MAX_OFFSET hardcode** :

Dans `packages/tui/hooks/useScroll.ts`, il y a un MAX_OFFSET fallback (200 ou 100) quand `setMaxScroll` n'a pas ete appele. Ce cap artificiel empeche le scroll de descendre au-dela.

Fix : Changer le fallback a un sentinel `Number.MAX_SAFE_INTEGER` pour signaler "pas de cap defini". Ajouter un log warning en dev quand `scrollDown` est appele sans `setMaxScroll` prealable. Documenter que `setMaxScroll(panel, max)` DOIT etre appele par le consumer avant toute interaction scroll.

**Bug 2 — scrollToTop / scrollToBottom manquants** :

Ajouter deux fonctions au hook :

```typescript
const scrollToTop = useCallback((panel: string): void => {
  setOffsets(prev => {
    if ((prev[panel] || 0) === 0) return prev;
    return { ...prev, [panel]: 0 };
  });
}, []);

const scrollToBottom = useCallback((panel: string): void => {
  setOffsets(prev => {
    const max = maxOffsetsRef.current[panel] ?? Infinity;
    if (max === Infinity) return prev; // pas de max defini, ne rien faire
    if ((prev[panel] || 0) === max) return prev;
    return { ...prev, [panel]: max };
  });
}, []);
```

Les inclure dans le retour du hook et dans le type `UseScrollReturn`.

### Etape 2 : Ajouter keybindings scroll.top / scroll.bottom

Dans `packages/tui/keybindings/keybindings.ts`, ajouter au `DEFAULT_KEYBINDINGS` :
```typescript
'scroll.top': 'g',
'scroll.bottom': 'G',
```

Aussi dans le keybindings local de `packages/maestro-cli/keybindings/keybindings.ts` (copie CJS).

### Etape 3 : Fix WorkflowTree running child indicator

Dans `packages/maestro-monitor/components/WorkflowTree.ts` :

Quand un noeud est collapse (`expanded = false`) mais a des enfants en status `running`, ajouter un indicateur visuel (ex: `[+2 running]` apres le nom du noeud) pour que l'utilisateur sache qu'il y a de l'activite cachee.

Logique :
```typescript
function countRunningChildren(node): number {
  if (!node.children) return 0;
  return node.children.reduce((count, child) => {
    const isRunning = child.status === 'running' || child.status === 'in_progress';
    return count + (isRunning ? 1 : 0) + countRunningChildren(child);
  }, 0);
}
```

Affichage : si `runningCount > 0` et noeud collapse, inserer APRES le nom du noeud, en rouge : ` {icons.running}{runningCount}` (ex: `Build ● 2`). Utiliser `semantic.status.running` pour la couleur.

### Etape 4 : Fix hauteurs dynamiques dans App.ts (monitor)

Dans `packages/maestro-monitor/App.ts`, les hauteurs des panels sont hardcodees. Remplacer par `useStdout().rows` et calculer dynamiquement :

```typescript
const { rows } = useStdout();
const headerHeight = 3;
const statusBarHeight = 1;
const contentHeight = rows - headerHeight - statusBarHeight;
```

Ce fix est specifique au monitor (pas dans @maestro/tui).

### Etape 5 : Tests du toolkit (@maestro/tui)

Creer des tests pour les hooks de @maestro/tui. Location : `packages/tui/tests/` (chaque package possede ses propres tests — vitest.config.ts cree en 33-C-B).

**`packages/tui/tests/useScroll.test.ts`** :
- scroll up quand offset > 0 decrement
- scroll up quand offset = 0 ne change pas
- scroll down quand offset < max increment
- scroll down quand offset = max ne change pas
- scrollToTop met offset a 0
- scrollToBottom met offset a max
- setMaxScroll definit la limite
- multi-panel : offsets independants par panel
- MAX_OFFSET par defaut n'est pas un cap artificiel

Pattern de test (utiliser renderHook via un composant Ink wrapper) :
```typescript
import { createElement as h, useState } from 'react';
import { render } from 'ink-testing-library';
import { useScroll } from '../hooks/useScroll.ts';

function TestComponent({ onHook }) {
  const scroll = useScroll();
  onHook(scroll);
  return h('ink:text', null, 'test');
}
```

**`packages/tui/tests/usePanelFocus.test.ts`** :
- next() incremente activeIndex
- prev() decremente
- wrap : next apres dernier → premier
- isActive retourne true pour le panel actif

**`packages/tui/tests/useSelectableList.test.ts`** :
- selectNext() / selectPrev() changent l'index
- page up / page down sautent de N
- wrap : selectNext apres dernier → premier si wrap=true

### Etape 6 : Tests monitor

Location : `packages/maestro-monitor/tests/` (chaque package possede ses propres tests).

Creer `packages/maestro-monitor/vitest.config.ts` :
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

**`packages/maestro-monitor/tests/WorkflowTree.test.ts`** (OBLIGATOIRE — le bug fix de l'etape 3 necessite un test de regression) :
- Rendu d'un arbre simple (root + 2 enfants) — verifie que les noeuds s'affichent
- Noeud collapse : enfants non affiches
- Noeud collapse avec running child : indicateur `[running icon] 2` visible en rouge apres le nom

**`packages/maestro-monitor/tests/Panel.test.ts`** (optionnel) :
- Rendu avec titre
- Focus indicator visible quand focused=true

### Etape 7 : Nettoyage final

**Verifier d'abord** qu'aucun fichier ne reference les anciens chemins :
```bash
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\**\*.ts','C:\Meastro\frontend\src\**\*.tsx','C:\Meastro\maestro-mcp\*.js' -Pattern '../shared/|../../shared/|../../../shared/|../../../../shared/|@shared/' -Recurse | Select-Object -First 10"
```
Resultat attendu : 0 resultats. Si > 0, corriger AVANT de supprimer.

**Supprimer :**
- `C:\Meastro\shared\` — l'ancien dossier complet (maintenant dans packages/tui/)
- `C:\Meastro\maestro-cli\monitor\` — monitor TUI (maintenant dans packages/maestro-monitor/)
- `C:\Meastro\maestro-cli\interactive\` — mode interactif (maintenant dans packages/maestro-code/)
- `C:\Meastro\maestro-cli\tests\interactive\` — tests deplaces (maintenant dans packages/maestro-code/tests/)
- `C:\Meastro\maestro-cli\cli.ts` — CLI principal (maintenant dans packages/maestro-cli/cli.ts)
- `C:\Meastro\maestro-cli\output-formatter.ts`, `shell.ts`, `config.ts`, `discover.ts`, `json-parser.ts`, `index.js` — idem

**Supprimer** `C:\LLM-Provider\` — le code a ete copie dans `C:\Meastro\llm-provider\`. CLAUDE.md interdit le legacy : "No legacy support. Remove the old code entirely." L'historique Git de LLM-Provider reste dans son repo Git propre (.git). Si besoin de consulter l'historique, faire `git log` dans le repo original avant suppression, ou taguer le dernier commit.

**MAJ** `dev-scripts/dev-start.ps1` : remplacer les references a `C:\LLM-Provider\dotnet\` par `C:\Meastro\llm-provider\dotnet\`.

### Etape 8b : Mise a jour CLAUDE.md et MEMORY.md

**CLAUDE.md** — mettre a jour les sections suivantes :

| Section | Changements |
|---------|-------------|
| Architecture Quick Reference | `CLI` → `packages/maestro-cli/cli.ts`, `Shared` → `packages/tui/`, `LLM-Provider Monitor` → `packages/provider-monitor/src/app.tsx` |
| Key File Paths | `maestro-cli/cli.ts` → `packages/maestro-cli/cli.ts`, `maestro-cli/index.js` → `packages/maestro-cli/index.js`, `maestro-cli/monitor/ink/App.ts` → `packages/maestro-monitor/App.ts`, `maestro-cli/interactive/App.ts` → `packages/maestro-code/App.ts`, `maestro-cli/interactive/headless.ts` → `packages/maestro-code/headless.ts`, `C:\LLM-Provider\monitor\src\app.tsx` → `packages/provider-monitor/src/app.tsx` |
| CLI Commands | `cd C:\Meastro\maestro-cli` → `cd C:\Meastro\packages\maestro-cli` |
| Testing Commands | MAJ paths des tests interactive, ajouter tests toolkit |
| TUI Monitor Architecture | `maestro-cli/monitor/` → `packages/maestro-monitor/` |

**MEMORY.md** — mettre a jour :

| Entree | Action |
|--------|--------|
| Architecture Quick Reference | MAJ tous les chemins |
| Key File Paths | MAJ tous les chemins |
| Testing Commands | MAJ chemins + ajouter `packages/tui/tests/` |
| Shared TUI Reality | Remplacer par : "@maestro/tui design system dans packages/tui/, monitors dans packages/{maestro-monitor,provider-monitor}/" |
| LLM-Provider Monitor | Remplacer `C:\LLM-Provider\monitor\` par `packages/provider-monitor/` |
| Current Project State | MAJ active phase |

### Etape 8 : Validation E2E

**Maestro monitor** (necessite backend running ou mode mock) :
```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js monitor --mock"
```
Verifier : TUI s'affiche, navigation fonctionne, scroll fonctionne, tabs fonctionnent.

**Provider monitor** (necessite LLM-Provider running ou mode mock) :
```bash
powershell.exe -Command "cd C:\Meastro\packages\provider-monitor; npx tsx src/index.ts --mock"
```
Verifier : TUI s'affiche, theme cyan/violet applique, tabs fonctionnent.

**CLI commandes** :
```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js health"
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks --limit 5"
```
Verifier : output formate correctement, pas d'erreur d'import.

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/tui/hooks/useScroll.ts` | Modifier — fix MAX_OFFSET, ajouter scrollToTop/scrollToBottom |
| `packages/tui/keybindings/keybindings.ts` | Modifier — ajouter scroll.top, scroll.bottom |
| `packages/maestro-cli/keybindings/keybindings.ts` | Modifier — idem (copie CJS) |
| `packages/maestro-monitor/components/WorkflowTree.ts` | Modifier — running child indicator |
| `packages/maestro-monitor/App.ts` | Modifier — hauteurs dynamiques |
| `packages/tui/tests/useScroll.test.ts` | Creer — tests du toolkit dans son propre package |
| `packages/tui/tests/usePanelFocus.test.ts` | Creer |
| `packages/tui/tests/useSelectableList.test.ts` | Creer |
| `packages/maestro-monitor/vitest.config.ts` | Creer — config tests du monitor |
| `packages/maestro-monitor/tests/WorkflowTree.test.ts` | Creer (OBLIGATOIRE — regression test pour bug fix etape 3) |
| `packages/maestro-monitor/tests/Panel.test.ts` | Creer (optionnel) |
| `shared/` | Supprimer (apres verification grep) |
| `maestro-cli/` (anciens fichiers copies) | Supprimer (apres verification grep) |
| `C:\LLM-Provider\` | Supprimer (apres validation E2E — no legacy support) |
| `CLAUDE.md` | Modifier — MAJ tous les chemins (voir etape 8b) |
| `C:\Users\arthu\.claude\projects\C--Meastro\memory\MEMORY.md` | Modifier — MAJ chemins et etat |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : tests existants passent (maestro-code)
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/ 2>&1"
# Resultat attendu : 32/32

# Commande 2 : tests toolkit passent (dans @maestro/tui)
powershell.exe -Command "cd C:\Meastro\packages\tui; npx vitest run tests/ 2>&1"
# Resultat attendu : minimum 15 tests verts

# Commande 2b : tests monitor passent (dans @maestro/monitor)
powershell.exe -Command "cd C:\Meastro\packages\maestro-monitor; npx vitest run tests/ 2>&1"
# Resultat attendu : minimum 3 tests verts (WorkflowTree regression)

# Commande 3 : aucun import vers shared/ ou maestro-cli/ (anciens chemins)
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\**\*.ts' -Pattern '../shared/|../../shared/|../../../shared/|../../../../shared/' -Recurse | Select-Object -First 5"
# Resultat attendu : 0 resultats

# Commande 4 : backend compile toujours
powershell.exe -Command "cd C:\Meastro\backend; dotnet build 2>&1 | Select-String 'Build succeeded|Error'"
# Resultat attendu : Build succeeded

# Commande 5 : LLM-Provider compile toujours
powershell.exe -Command "cd C:\Meastro\llm-provider\dotnet; dotnet build 2>&1 | Select-String 'Build succeeded|Error'"
# Resultat attendu : Build succeeded

# Commande 6 : frontend build
powershell.exe -Command "cd C:\Meastro\frontend; npm run build 2>&1 | Select-String 'error|built'"
# Resultat attendu : built in X.Xs

# Commande 7 : tous les tests (3 packages)
powershell.exe -Command "cd C:\Meastro; npx vitest run --workspace 2>&1"
# Ou sequentiellement si workspace vitest pas configure :
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run 2>&1"
powershell.exe -Command "cd C:\Meastro\packages\tui; npx vitest run 2>&1"
powershell.exe -Command "cd C:\Meastro\packages\maestro-monitor; npx vitest run 2>&1"
# Resultat attendu : ~50+ tests verts (32 maestro-code + ~15 tui + ~3 monitor)

# Commande 8 : C:\LLM-Provider\ supprime
powershell.exe -Command "Test-Path C:\LLM-Provider"
# Resultat attendu : False

# Commande 9 : CLAUDE.md chemins mis a jour
powershell.exe -Command "Select-String -Path 'C:\Meastro\CLAUDE.md' -Pattern 'maestro-cli/monitor|maestro-cli/interactive|C:\\LLM-Provider\\monitor' | Select-Object -First 5"
# Resultat attendu : 0 resultats (tous les anciens chemins remplaces)
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS tester les hooks sans React — utiliser renderHook ou un composant wrapper Ink
- Ne PAS hardcoder des tailles de terminal dans les tests — mocker `useStdout()`
- Ne PAS corriger un bug specifique au monitor (WorkflowTree, App.ts) dans @maestro/tui — separer les responsabilites
- Ne PAS ignorer les tests de regression — chaque bug fix DOIT avoir un test qui le reproduisait
- Ne PAS supprimer shared/ et maestro-cli/ avant verification complete — grep d'abord
- Ne PAS placer les tests d'un package dans un autre package — @maestro/tui tests dans packages/tui/tests/, monitor tests dans packages/maestro-monitor/tests/
- Ne PAS oublier de mettre a jour CLAUDE.md et MEMORY.md — les anciens chemins cassent le contexte des futurs agents
- Ne PAS garder C:\LLM-Provider "comme archive" — CLAUDE.md interdit le legacy, supprimer apres validation
- Ne PAS modifier les copies CJS dans packages/maestro-cli/keybindings/ sans modifier aussi packages/tui/keybindings/ (et vice-versa) — ajouter un commentaire `// SYNC WITH packages/tui/keybindings/keybindings.ts` en haut de la copie CJS
- Ne PAS oublier de MAJ la copie CJS des keybindings dans maestro-cli quand on modifie la version tui

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-C-D : Bugs + tests + validation
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Bugs corriges** :
- [ ] useScroll MAX_OFFSET : CORRIGE / NON
- [ ] scrollToTop/scrollToBottom : AJOUTE / NON
- [ ] scroll.top/scroll.bottom keybindings : AJOUTE / NON
- [ ] WorkflowTree running child indicator : AJOUTE / NON
- [ ] App.ts hauteurs dynamiques : CORRIGE / NON
**Tests toolkit crees** : X nouveaux dans packages/tui/tests/ (lister fichiers)
**Tests monitor crees** : X nouveaux dans packages/maestro-monitor/tests/ (lister fichiers)
**Tests totaux** : X (32 maestro-code + X tui + X monitor)
**shared/ supprime** : OUI / NON
**maestro-cli/ ancien supprime** : OUI / NON
**C:\LLM-Provider\ supprime** : OUI / NON
**CLAUDE.md mis a jour** : OUI / NON (lister sections modifiees)
**MEMORY.md mis a jour** : OUI / NON
**CJS sync comment ajoute** : OUI / NON (packages/maestro-cli/keybindings/)
**E2E Maestro monitor** : OK / FAIL (description)
**E2E Provider monitor** : OK / FAIL (description)
**E2E CLI commandes** : OK / FAIL
**Backend build** : OK / FAIL
**Frontend build** : OK / FAIL
**Grep shared/ restants** : 0 / X (coller output)
**Grep anciens chemins CLAUDE.md** : 0 / X (coller output)
```
