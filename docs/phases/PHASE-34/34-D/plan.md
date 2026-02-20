# Phase 34-D : Integration TUI — Widget Protocol dans Maestro Code

**Statut** : A faire
**Prerequis** : Phase 34-A COMPLETE (tous les blocs interaction crees : classify-intent, decide-action, send-widget-response, interaction-handler workflow), Phase 34-B-4 COMPLETE (checkpointing), Phase 13 COMPLETE (parallel, sequence, branches dans EntryPointExecutor)
**Objectif** : Integrer le widget protocol dans `packages/maestro-code/App.ts` pour permettre a l'utilisateur d'interagir avec l'agent pendant que le workflow tourne — envoyer des messages, recevoir des widgets, repondre aux widgets interactifs.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** de chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-34/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier de code C# backend** — cette phase est 100% TypeScript dans `packages/maestro-code/`
5. **Ne PAS casser les 32 tests existants** de `packages/maestro-code/` — verifier avec `npx vitest run tests/` apres chaque modification
6. **Utiliser `h(Text, null, ...)` pour Ink** — PAS `h('ink:text', ...)` (voir `memory/MEMORY.md`)
7. **Ne PAS creer de nouveaux fichiers** sauf si absolument necessaire — tout rentre dans `App.ts` (meme composant WidgetRenderer)

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 34-D-1 | Ajouter WidgetRenderer et types Widget | 1h |
| 34-D-2 | Modifier SessionManager (sendMessage + widget polling) | 1h |
| 34-D-3 | Modifier InteractiveApp (mode dual + input always active) | 1h |
| 34-D-4 | Tests manuels et verification | 30min |

---

## 34-D-1 : Ajouter WidgetRenderer et types Widget

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/App.ts` — comprendre le code complet actuel (349 lignes), les composants existants (OutputPanel, StatusBar, InputPrompt, InteractiveApp, SessionManager), les imports (`createElement as h`, `useState`, `useCallback`, `useEffect`, `Box`, `Text` de ink)
- `docs/phases/PHASE-34/34-A/02-interaction-handler/plan-workflow-tui.md` — section "Partie 2 : Integration TUI" (ligne ~620) — le design complet du WidgetRenderer avec 6 types de widgets, les TypeScript code snippets
- `docs/phases/PHASE-34/34-A/02-interaction-handler/spec.md` — le widget protocol (variables `_userMessage`, `_widgetRequest`, `_widgetResponse`)

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Ajouter l'interface `Widget`** dans `packages/maestro-code/App.ts`, apres les types existants (apres `InteractiveOptions` ligne ~30) :
   ```typescript
   interface Widget {
     type: string;
     content: string;
     params: Record<string, any>;
     id: string;
     interactive?: boolean;
     timestamp?: string;
   }
   ```

2. **Ajouter le composant `WidgetRenderer`** dans `packages/maestro-code/App.ts`, apres le composant `StatusBar` (ligne ~216). Le composant prend `{ widget, onResponse }` en props. Il rend 6 types de widgets avec des `Box` et `Text` ink :
   - `message` — Box bleue avec le contenu
   - `progress` — Box cyan avec liste de phases et statuts (couleur par statut : green=completed, yellow=in_progress, gray=pending)
   - `confirmation` — Box jaune avec action + consequence + "Type yes or no"
   - `option-select` — Box magenta avec options numerotees [id] label
   - `plan-view` — Box verte avec liste de steps et statuts
   - `test-results` — Box verte avec suites de tests (passed/failed counts)
   - `default` — Box grise avec `[type] content`

   **Important** : utiliser `h(Box, { ... }, ...)` et `h(Text, { ... }, ...)` — PAS de JSX. Chaque widget type retourne un `h(Box, ...)` avec `borderStyle: 'round'`, `paddingX: 1`, `marginY: 1`. Les couleurs de bordure varient par type.

   **Exemple pattern pour le type `message`** :
   ```typescript
   case 'message':
     return h(Box, { borderStyle: 'round', borderColor: 'blue', paddingX: 1, marginY: 1 },
       h(Text, { color: 'blue', bold: true }, 'Agent: '),
       h(Text, null, widget.content)
     );
   ```

   Se referer a `plan-workflow-tui.md` section "Nouveau composant : WidgetRenderer" (ligne ~646) pour le code complet de chaque type.

3. **Exporter `Widget` et `WidgetRenderer`** a la fin du fichier (ajouter a la ligne d'export existante ligne ~348).

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | MODIFIER — Ajouter interface `Widget` apres les types existants, ajouter composant `WidgetRenderer` apres `StatusBar`, ajouter aux exports |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : TypeScript compile (no emit)
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx tsc --noEmit 2>&1"
# Resultat attendu : aucune erreur (ou seulement les erreurs pre-existantes du @ts-nocheck)

# Commande 2 : Tests existants passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : 32 tests passed, 0 failed (meme nombre qu'avant)

# Commande 3 : Le composant WidgetRenderer est bien exporte
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\maestro-code\App.ts' -Pattern 'WidgetRenderer'"
# Resultat attendu : au moins 2 occurrences (definition + export)
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS utiliser JSX (`<Box>`, `<Text>`) — le fichier utilise `createElement as h` car il est un fichier `.ts` pas `.tsx`
- Ne PAS utiliser `h('ink:text', ...)` au lieu de `h(Text, ...)` — ink's reconciler rejette les string element types
- Ne PAS ajouter de dependances npm — tout est deja disponible via ink (`Box`, `Text`)
- Ne PAS creer un fichier separe pour WidgetRenderer — le garder dans `App.ts` pour la cohesion (les autres composants y sont aussi)

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-D-1 : WidgetRenderer
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Interface Widget ajoutee** : OUI/NON
**WidgetRenderer composant** : 6/6 types implementes
**TypeScript compile** : OUI/NON
**Tests existants** : 32/32 passent / X regressions
**Verification** : [copier output de vitest run]
```

---

## 34-D-2 : Modifier SessionManager (sendMessage + widget polling)

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/App.ts` — relire la classe `SessionManager` (ligne 41-171), comprendre `submitTask()`, `startPolling()`, `stopPolling()`, le pattern d'appels API via `this.client._fetch()`
- `docs/phases/PHASE-34/34-A/02-interaction-handler/plan-workflow-tui.md` — section "Modifications au SessionManager" (ligne ~799) — code complet de `sendMessage`, `startWidgetPolling`, `sendWidgetResponse`, `stopWidgetPolling`

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Ajouter 3 proprietes privees** a la classe `SessionManager` (apres `private lastTreeHash = '';` ligne ~51) :
   ```typescript
   private widgetPollTimer: ReturnType<typeof setInterval> | null = null;
   private lastWidgetId: string | null = null;
   ```

2. **Ajouter la methode `sendMessage()`** a la classe `SessionManager` :
   - Prend `(message: string, addLine: (line: LogLine) => void): Promise<void>`
   - Verifie que `this.sessionId` existe, sinon retourne
   - Appelle `this.client._fetch('PUT', \`/api/sessions/${this.sessionId}/variables/_userMessage\`, { body: { value: { text: message, time: new Date().toISOString() } } })`
   - Ajoute une LogLine verte `> ${message}` en cas de succes
   - Ajoute une LogLine rouge en cas d'erreur

3. **Ajouter la methode `startWidgetPolling()`** :
   - Prend `(addLine: (line: LogLine) => void, setWidget: (w: Widget | null) => void, setPendingInteractive: (w: Widget | null) => void): void`
   - Cree un `setInterval` a 500ms qui :
     a. Lit la session via `this.client.getSession(this.sessionId)`
     b. Extrait `vars._widgetRequest`
     c. Si `widgetReq.widget.id !== this.lastWidgetId` (nouveau widget) :
        - Met a jour `this.lastWidgetId`
        - Si widget non-interactif : appelle `addLine()` avec le contenu
        - Si widget interactif (`widget.interactive === true`) : appelle `setPendingInteractive(widget)`
        - Appelle `setWidget(widget)` dans tous les cas

4. **Ajouter la methode `sendWidgetResponse()`** :
   - Prend `(response: string, widgetId: string, addLine: (line: LogLine) => void): Promise<void>`
   - Appelle `this.client._fetch('PUT', \`/api/sessions/${this.sessionId}/variables/_widgetResponse\`, { body: { value: { response, widgetId } } })`
   - Log le resultat

5. **Ajouter la methode `stopWidgetPolling()`** :
   - Arrete `this.widgetPollTimer` si actif

6. **Modifier `stopPolling()`** existant (ligne 161) pour aussi appeler `this.stopWidgetPolling()`.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | MODIFIER — Ajouter les 3 proprietes, 4 methodes (sendMessage, startWidgetPolling, sendWidgetResponse, stopWidgetPolling) a SessionManager, modifier stopPolling existant |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : TypeScript compile
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx tsc --noEmit 2>&1"
# Resultat attendu : pas de nouvelle erreur

# Commande 2 : Tests passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : 32/32 passent

# Commande 3 : Les 4 nouvelles methodes existent
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\maestro-code\App.ts' -Pattern 'sendMessage|startWidgetPolling|sendWidgetResponse|stopWidgetPolling'"
# Resultat attendu : au moins 4 occurrences (une par methode)
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS creer un client API separe — utiliser `this.client._fetch()` et `this.client.getSession()` qui existent deja
- Ne PAS oublier de nettoyer `widgetPollTimer` dans `stopPolling()` — sinon memory leak
- Ne PAS poller les widgets et les logs dans le meme timer — garder les 2 pollers separes (logs a 2s, widgets a 500ms) pour des frequences differentes

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-D-2 : SessionManager modifications
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**sendMessage** : OUI/NON
**startWidgetPolling** : OUI/NON
**sendWidgetResponse** : OUI/NON
**stopWidgetPolling** : OUI/NON
**Tests existants** : 32/32 passent
**Verification** : [copier output de vitest run]
```

---

## 34-D-3 : Modifier InteractiveApp (mode dual + input always active)

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/App.ts` — relire `InteractiveApp` (ligne 264-327), comprendre `handleSubmit` (ligne 299-318), `setBusy`, le render tree (OutputPanel + StatusBar + InputPrompt), et que `InputPrompt` a `disabled: busy` (ligne 325)
- `docs/phases/PHASE-34/34-A/02-interaction-handler/plan-workflow-tui.md` — section "Modifications au InteractiveApp" (ligne ~897) — le code complet du handleSubmit modifie et du render modifie

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Ajouter 2 states** dans `InteractiveApp` (apres `const [currentSessionId, setCurrentSessionId] = useState(...)` ligne ~274) :
   ```typescript
   const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
   const [pendingInteractive, setPendingInteractive] = useState<Widget | null>(null);
   ```

2. **Remplacer `handleSubmit`** (lignes 299-318) par une version a 3 branches :
   - **Branche 1 (pendingInteractive != null)** : l'utilisateur repond a un widget interactif
     - Appelle `sessionManager.sendWidgetResponse(input, pendingInteractive.id, addLine)`
     - Reset `setPendingInteractive(null)` et `setCurrentWidget(null)`
     - Retourne immediatement
   - **Branche 2 (busy && sessionManager.getSessionId())** : session active, message libre
     - Appelle `sessionManager.sendMessage(input, addLine)`
     - Retourne immediatement
   - **Branche 3 (default)** : premier message, creer la session
     - Comportement actuel (submitTask)
     - Ajouter `sessionManager.startWidgetPolling(addLine, setCurrentWidget, setPendingInteractive)` quand `setBusy(true)` est appele
     - Ajouter `sessionManager.stopWidgetPolling()` quand `setBusy(false)` est appele

3. **Modifier le render tree** (lignes 322-326) :
   - Reduire la hauteur du `OutputPanel` quand un widget est affiche : `height: outputHeight - (currentWidget ? 8 : 0)`
   - Inserer `WidgetRenderer` entre `OutputPanel` et `StatusBar` : `currentWidget ? h(WidgetRenderer, { widget: currentWidget, onResponse: () => {} }) : null`
   - **CRITIQUE** : Changer `disabled: busy` en `disabled: false` sur `InputPrompt` (l'input est TOUJOURS actif)
   - Changer le `placeholder` dynamiquement :
     - Si `pendingInteractive` : `'Respond to the widget above...'`
     - Si `busy` : `'Send a message to the agent...'`
     - Sinon : `'Describe your task...'`

4. **Modifier le cleanup effect** (lignes 276-286) : ajouter `sessionManager.stopWidgetPolling()` dans le cleanup return.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | MODIFIER — Ajouter 2 states, remplacer handleSubmit par version 3 branches, modifier le render tree (WidgetRenderer + disabled:false + placeholder dynamique), modifier le cleanup effect |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : TypeScript compile
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx tsc --noEmit 2>&1"
# Resultat attendu : pas de nouvelle erreur

# Commande 2 : Tests passent
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : 32/32 passent

# Commande 3 : InputPrompt n'est plus disabled quand busy
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\maestro-code\App.ts' -Pattern 'disabled.*busy'"
# Resultat attendu : 0 occurrences (le pattern disabled: busy a ete supprime)

# Commande 4 : Le placeholder dynamique existe
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\maestro-code\App.ts' -Pattern 'pendingInteractive|Send a message'"
# Resultat attendu : au moins 2 occurrences

# Commande 5 : WidgetRenderer est utilise dans le render
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\maestro-code\App.ts' -Pattern 'h.WidgetRenderer'"
# Resultat attendu : 1 occurrence dans le render tree
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS garder `disabled: busy` sur InputPrompt — c'est LE changement fondamental de 34-D. L'input DOIT etre actif quand le workflow tourne
- Ne PAS oublier la branche pendingInteractive dans handleSubmit — sans elle, les widgets interactifs (confirmation, option-select) ne peuvent pas recevoir de reponse
- Ne PAS oublier de declencher `startWidgetPolling` quand la session demarre — sinon aucun widget ne sera affiche
- Ne PAS supprimer le polling de logs existant (`startPolling`) — les 2 pollers coexistent (logs a 2s, widgets a 500ms)
- Ne PAS oublier le cleanup du widget polling dans le useEffect return

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-D-3 : InteractiveApp modifications
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**3 branches handleSubmit** : OUI/NON
**InputPrompt disabled:false** : OUI/NON
**WidgetRenderer dans render** : OUI/NON
**Placeholder dynamique** : OUI/NON
**startWidgetPolling integre** : OUI/NON
**Cleanup widget polling** : OUI/NON
**Tests existants** : 32/32 passent / X regressions
**Verification** : [copier output de vitest run + grep results]
```

---

## 34-D-4 : Tests manuels et verification

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/App.ts` — le fichier complet apres toutes les modifications
- `docs/phases/PHASE-34/34-A/02-interaction-handler/plan-workflow-tui.md` — section "Scenarios de test detailles" (ligne ~990) — les 5 scenarios attendus

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Verifier que tous les tests passent** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
   ```

2. **Verifier que TypeScript compile** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx tsc --noEmit 2>&1"
   ```

3. **Test manuel** (si le backend est disponible) :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js code"
   ```
   - Taper une tache → verifier que la session se cree normalement
   - Pendant que le workflow tourne, taper un message → verifier dans les logs qu'il est envoye
   - Verifier que les widgets s'affichent quand l'interaction-handler repond

4. **Si le backend n'est pas disponible** : verifier la structure du code par grep — WidgetRenderer a 6 branches case (message, progress, confirmation, option-select, plan-view, test-results), SessionManager a 4 nouvelles methodes (sendMessage, startWidgetPolling, sendWidgetResponse, stopWidgetPolling), InteractiveApp a `pendingInteractive` state et handleSubmit 3 branches, InputPrompt a `disabled: false`. Verifier aussi TypeScript compile et tests unitaires. Documenter clairement dans le checkpoint que le test manuel n'a pas ete fait.

5. **Compter les lignes du fichier modifie** :
   ```bash
   powershell.exe -Command "(Get-Content 'C:\Meastro\packages\maestro-code\App.ts').Count"
   ```
   Le fichier devrait passer de ~349 lignes a ~500-550 lignes.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Ecrire le checkpoint 34-D complet |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : 32/32 passent

# Commande 2 : TypeScript compile
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx tsc --noEmit 2>&1"
# Resultat attendu : pas d'erreur nouvelle

# Commande 3 : Comptage des composants et methodes cles
powershell.exe -Command "Select-String -Path 'C:\Meastro\packages\maestro-code\App.ts' -Pattern 'WidgetRenderer|sendMessage|startWidgetPolling|sendWidgetResponse|pendingInteractive|disabled.*false' | Measure-Object"
# Resultat attendu : Count >= 10 (toutes les modifications sont presentes)
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS declarer DONE sans avoir verifie que les 32 tests existants passent encore
- Ne PAS inventer des resultats de test manuel — si le backend n'est pas up, dire "non verifie" clairement
- Ne PAS oublier de documenter les regressions si il y en a

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-D-4 : Verification finale
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Tests unitaires** : 32/32 passent / X regressions
**TypeScript compile** : OUI/NON
**Test manuel** : FAIT / PAS FAIT (backend pas up)
**Lignes App.ts** : avant=349, apres=XXX
**Composants ajoutes** : WidgetRenderer (6 types)
**Methodes ajoutees** : sendMessage, startWidgetPolling, sendWidgetResponse, stopWidgetPolling
**Changements cles** : InputPrompt disabled:false, handleSubmit 3 branches, placeholder dynamique
**Verification** : [copier output de vitest run tests/]
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-34/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 34-D complete — WidgetRenderer + sendMessage + widget polling integres dans App.ts. InputPrompt toujours actif. 6 types de widgets supportes."
- Mettre a jour : "Tests: 76 total" → nouveau total si des tests ont ete ajoutes
