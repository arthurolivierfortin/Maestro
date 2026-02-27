# Phase 44 : Dogfooding Pragmatique — Cantante + Jarvis

**Statut** : DONE
**Date** : 2026-02-26
**Prerequis** : Phase 42 DONE, Phase 43 DONE

> Note : Ce plan remplace l'ancien Phase 44 "TUI Sentinel" (agent autonome de QA).
> Le TUI Sentinel etait over-engineered pour l'etat actuel du projet.
> On a besoin de dogfooding pragmatique avant d'automatiser le QA.

---

## Contexte

Phase 42 (restructuration maestro-code) et Phase 43 (Visual Gate) sont DONE. Le TUI est propre, les tests passent (58 fast + 4 visual gate = 62). Mais **le mode reel** (connecte au backend C#) n'a jamais ete teste. On a un beau TUI en demo mode, mais zero validation end-to-end.

**Phase 41** (Cantante v1 + Jarvis) n'a jamais ete executee mais le travail de base est fait :
- Jarvis agent block existe (`content/system/blocks/agents/jarvis/`)
- Session template `jarvis` existe avec entry point `ask`
- Cantante a deja un `MaestroService` complet avec `ask()` (Phase 37)
- `maestro code` supporte `--template jarvis --entry ask`

---

## Objectif

Utiliser `maestro code` (TUI + headless) et l'agent Jarvis pour faire du vrai travail de developpement sur Cantante (`C:\Cantante`). Fixer chaque bug rencontre en chemin. Valider le pipeline complet : TUI → Backend → Jarvis → Tools → Cantante.

---

## Pre-requis

- Phase 42 DONE (restructuration maestro-code)
- Phase 43 DONE (Visual Gate — pipeline de verification)
- Backend C# buildable (`dotnet build`)
- LLM-Provider demarre correctement
- Claude Sonnet 4.6 accessible via LLM-Provider

---

## Sous-phases

| Phase | Titre | Effort | Dependance |
|-------|-------|--------|------------|
| A | Pipeline Bootstrap — premier aller-retour | 1-2 jours | — |
| B | Jarvis Tool Validation — tous les types d'outils | 1 jour | A |
| C | Cantante Development — vrai travail | 2-3 jours | B |
| D | Retrospective + mise a jour roadmap | 0.5 jour | C |

**Total : ~5-7 jours**

---

## A : Pipeline Bootstrap — Premier aller-retour

### Objectif
Un seul aller-retour complet : soumettre une tache via `maestro code`, Jarvis l'execute, le resultat apparait.

### Etapes

1. **Demarrer les services**
```powershell
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -BackendOnly
```
Verifier : `curl http://localhost:5000/api/health` et `curl http://localhost:5010/api/v1/health/`

2. **Tester maestro code en mode reel** (pas --demo)
```bash
cd C:\Meastro\packages\maestro-cli
node index.js code --repo C:\Cantante --template jarvis --entry ask
```
Attentes :
- Le TUI s'affiche (pas NoBackendScreen)
- NavBar, pages, TaskInputBar, StatusBar fonctionnent
- Presser `/` focus le TaskInputBar

3. **Soumettre une tache simple**
```
/ → "List the files in C:\Cantante\src"
```
Le SessionManager doit :
- Creer une session (`createSession()`)
- Importer le template jarvis (`importSessionTemplate()`)
- Demarrer la session (`startSession()`)
- Invoquer l'entry point `ask` (`invoke/ask`)
- Afficher le resultat dans le ConversationLog

4. **Fixer chaque bug** rencontre dans la chaine. Bugs probables :
   - `importSessionTemplate` pas wire correctement dans le CLI → SessionManager
   - Template `jarvis` import echoue (API mal appelee)
   - Entry point `ask` pas reconnu par le backend
   - Jarvis tool dispatch echoue (block discovery, tool name mapping)
   - LLM-Provider configuration pour Claude Sonnet manquante
   - Polling timeout ou erreur de deserialization des variables

5. **Alternative headless** si le TUI bloque :
```bash
node index.js code --headless --task "List the files in C:\Cantante\src" --repo C:\Cantante --template jarvis --entry ask
```

### Fichiers cles

| Fichier | Role |
|---------|------|
| `packages/maestro-cli/cli.ts` (ligne ~6230) | Lance `startInteractiveMode()` avec options |
| `packages/maestro-code/services/SessionManager.ts` | Lifecycle : create → import → start → invoke → poll |
| `packages/maestro-code/App.ts` (ligne ~521) | `startInteractive()` — setup real vs demo mode |
| `content/system/blocks/agents/jarvis/jarvis.agent.block.json` | Bloc Jarvis (model: claude-sonnet-4-6, maxIterations: 20) |
| `content/system/blocks/agents/jarvis/system-prompt.md` | System prompt avec 7 outils |
| `content/system/templates/sessions/jarvis.session.json` | Template : entry point `ask` → `jarvis` |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Dispatch entry point → block executor |

### Verification A
- [ ] Backend + LLM-Provider demarrent correctement
- [ ] `maestro code` se connecte au backend (pas NoBackendScreen)
- [ ] Tache soumise via TaskInputBar
- [ ] Session creee (visible dans `maestro session list`)
- [ ] Jarvis execute et repond
- [ ] Resultat visible dans ConversationLog ou output headless

---

## B : Jarvis Tool Validation — Tous les types d'outils

### Objectif
Verifier que chaque outil de Jarvis fonctionne correctement sur le repo Cantante.

### Tests par outil

1. **file-read** : "Read the contents of C:\Cantante\package.json"
   - Verifie : ToolBlockExecutor dispatch → file-read block → retourne le contenu
   - Bug probable : chemin Windows vs forward slashes

2. **directory-list** : "List all TypeScript files in C:\Cantante\src\renderer"
   - Verifie : directory-list block → listing correct
   - Bug probable : block pas enregistre dans le systeme

3. **file-write** : "Create a file C:\Cantante\docs\ARCHITECTURE.md describing the project"
   - Verifie : Jarvis genere le contenu, file-write block ecrit le fichier
   - Bug probable : permissions, path resolution

4. **file-edit** : "In C:\Cantante\package.json, add a description field"
   - Verifie : old_string/new_string replacement fonctionne
   - Bug probable : NormalizeToolId mapping, JSON parsing du tool call

5. **shell-execute** : "Run 'npm list --depth=0' in C:\Cantante"
   - Verifie : shell-execute → commande executee → output capture
   - Bug probable : working directory, shell escaping sur Windows

6. **step-complete** : Implicite — Jarvis doit terminer proprement
   - Verifie : agent termine, execution tree marque "completed"

### Verification B
- [ ] file-read retourne le contenu correct
- [ ] directory-list liste les fichiers
- [ ] file-write cree le fichier sur disque
- [ ] file-edit modifie le fichier correctement
- [ ] shell-execute execute et retourne l'output
- [ ] step-complete termine la session proprement

---

## C : Cantante Development — Vrai travail

### Objectif
Utiliser Jarvis pour avancer Cantante avec de vraies taches. Documenter ce qui fonctionne et ce qui echoue.

### Taches planifiees (par complexite croissante)

1. **Documentation** : "Create a comprehensive README.md for the Cantante project"
   - Simple : lecture du code + generation de texte + file-write
   - Teste la capacite de Jarvis a comprendre un projet

2. **Configuration** : "Add ESLint and Prettier configuration for the Cantante project"
   - Moyen : file-write x3 (eslintrc, prettierrc, package.json scripts)
   - Teste la multi-step execution

3. **Component** : "Add a FileTree component to the Sidebar that shows the project directory"
   - Complexe : lecture architecture, creation composant React, integration Sidebar
   - Teste la capacite a faire du vrai dev

4. **Feature** : "Add keyboard shortcuts: Ctrl+S to save, Ctrl+O to open file picker"
   - Complexe : modification de composants existants, ajout d'event handlers
   - Teste file-edit sur du code existant

### Approche iterative
- Soumettre chaque tache via `maestro code --template jarvis --entry ask --repo C:\Cantante`
- Observer le comportement dans le SessionMonitor / ConversationLog
- Si Jarvis echoue : analyser pourquoi (mauvais tool call? hallucination? bug infra?)
- Fixer les bugs d'infra, ajuster le system prompt si necessaire
- Re-essayer la tache
- **Documenter** chaque tache : succes/echec, bugs trouves, corrections appliquees

### Verification C
- [ ] Au moins 2 taches sur 4 completees avec succes
- [ ] Fichiers crees/modifies dans C:\Cantante sont valides
- [ ] Bugs d'infrastructure documentes et corriges
- [ ] System prompt de Jarvis ajuste si necessaire

---

## D : Retrospective + Mise a jour

### Deliverables

1. **Checkpoint** : `docs/phases/PHASE-44/checkpoint.md`
   - Bugs trouves et corriges (avec fichiers modifies)
   - Taches Cantante reussies/echouees
   - Metriques : sessions creees, temps moyen, taux de succes

2. **Mise a jour ROADMAP** : Phase 44 DONE, ajuster Phase 45+

3. **Mise a jour MEMORY.md** : etat du projet apres dogfooding

4. **Jarvis assessment** :
   - Quels outils fonctionnent bien?
   - Quels types de taches Jarvis peut faire seul?
   - Ou l'intervention humaine est-elle necessaire?
   - Recommandations pour Phase 46 (Cantante specialise)

---

## Regles

1. **Ne PAS over-engineer** — on fixe les bugs qu'on trouve, pas ceux qu'on imagine
2. **Documenter chaque bug** — meme les mineurs, pour le checkpoint
3. **Committer apres chaque fix significatif** — pas de gros commit monolithique
4. **Si le pipeline est trop casse** — fallback sur headless mode ou CLI direct
5. **Les tests existants doivent continuer a passer** — `npm run test:fast` (58 tests)
6. **Ne PAS modifier @maestro/tui** — le design system partage
7. **Lire `docs/system/AGENT-PROTOCOL.md`** avant d'executer

---

## Anti-patterns

- **Ne PAS creer un agent "TUI Sentinel"** — dogfooding humain-dans-la-boucle d'abord
- **Ne PAS passer 3 jours a fixer un seul bug** — si trop profond, documenter et passer a la suite
- **Ne PAS modifier Jarvis pour un seul cas** — adapter le system prompt seulement si le pattern d'echec est recurrent
- **Ne PAS creer de sessions "test"** — noms significatifs ("Cantante - README", "Cantante - FileTree")
- **Ne PAS ignorer les erreurs du ConversationLog** — chaque erreur est un bug a documenter

---

## E : Corrections UX + Setup de navigation (post-dogfooding)

### Contexte

L'utilisateur a teste `maestro code` en mode reel et a trouve des bugs UX que le dogfooding superficiel (Phase 44-C) n'avait pas detectes. Le TuiDriver existant ne teste que le happy path (soumettre une tache). Il faut corriger les bugs ET ameliorer le setup pour naviguer comme un vrai utilisateur.

### Bugs trouves par l'utilisateur

1. **StatusBar "connecting" eternellement** — `connectionStatus` jamais passe a StatusBar
2. **Reponse de l'agent invisible** — "Salut mon ami" cree une session mais la reponse de Jarvis n'est jamais affichee dans le ConversationLog
3. **Blocs depassent des panels** — overflow dans Catalog et autres screens
4. **NavBar qui rapetisse** — layout instable, header se compresse

### Fix 1 : StatusBar "connecting"

**Cause** : App.ts rend `h(StatusBar, { currentPage })` sans passer `connectionStatus`. Le defaut dans StatusBar.ts est `'connecting'` avec un spinner anime.

**Analyse** : Le monitor utilise le hook `useSessionData` (packages/tui/app/hooks/useSessionData.ts) qui met a jour `connectionStatus` via polling. Maestro-code n'utilise pas ce hook dans App.ts.

**Solution** :
- App.ts : ajouter un `useEffect` qui poll la sante du backend toutes les 5s via `apiClient.getHealth()`
- Stocker `connectionStatus` dans un `useState`
- Passer `connectionStatus` aux deux instances de `h(StatusBar, ...)` (lignes 458 et 515)

**Fichiers** : `packages/maestro-code/App.ts`

### Fix 2 : Layout instable (NavBar/StatusBar rapetissent)

**Cause** : Le composant partage NavBar (packages/tui/components/NavBar.ts, ligne 60) a `height: 3` mais PAS `flexShrink: 0`. Pareil pour StatusBar (ligne 160) avec `height: theme.layout.statusBarHeight`. Ink peut les compresser si le contenu enfant deborde.

**Analyse** : Le `flexShrink` par defaut dans Ink est 1, ce qui permet la compression. Avec `height: 3` mais sans `flexShrink: 0`, la hauteur declaree est un souhait, pas une contrainte dure.

**Solution** : Ajouter `flexShrink: 0` au Box racine de NavBar et StatusBar.

**Fichiers** :
- `packages/tui/components/NavBar.ts` (ligne 60)
- `packages/tui/components/StatusBar.ts` (ligne 160)

### Fix 3 : Overflow des panels

**Cause** : Les lignes de contenu (CatalogBlockRow, SessionRow, etc.) n'ont pas `overflow: 'hidden'` sur leur Box parent. Les champs texte combines (name.padEnd(30) + id + type + description) depassent la largeur du panel.

**Analyse** : Le Panel lui-meme a `overflow: 'hidden'` (packages/tui/components/Panel.ts, ligne 110) mais les Box enfants a l'interieur n'heritent pas cette propriete. Les row Box dans les screens n'ont aucune contrainte de largeur.

**Solution** : Ajouter `overflow: 'hidden'` au Box row de chaque composant de ligne.

**Fichiers** :
- `packages/maestro-code/components/CatalogScreen.ts` — CatalogBlockRow
- `packages/maestro-code/components/SpacesScreen.ts` — SessionRow, RepoRow, WorkspaceRow
- `packages/maestro-code/components/FoundryScreen.ts` — BlockRow
- `packages/maestro-code/components/HomeScreen.ts` — ActiveSessionCard

### Fix 4 : Reponse de l'agent invisible

**Cause** : SessionManager.startPolling (lignes 112-136) poll l'execution tree pour detecter la completion, mais quand la tache est complete, il affiche seulement "Task completed" sans extraire la reponse de l'agent. L'output du noeud Jarvis (le summary de step-complete) n'est jamais lu.

**Analyse** : L'execution tree (`_executionTree`) contient les noeuds avec `output`. Le noeud Jarvis (agent) a un `output` qui contient le summary de ce que l'agent a fait. Aussi, les variables `_conversationState_{blockId}` contiennent l'historique de conversation.

**Solution** :
1. Dans startPolling, quand `allDone = true` : lire le dernier noeud de `tree`, extraire `output.summary` ou `output.result`
2. Afficher la reponse dans le ConversationLog via `addLine()`
3. Aussi : pendant le polling, detecter les changements dans l'execution tree (nouveaux noeuds = outils utilises) et les afficher en temps reel

**Fichiers** : `packages/maestro-code/services/SessionManager.ts`

### Amelioration 5 : Script de navigation TUI comprehensive

**Probleme** : Le TuiDriver ne teste que spawn → type → enter → wait. Pas de navigation entre pages, pas de verification du layout.

**Solution** : Creer `tests/dogfood-navigation.ts` :
1. Spawn en demo mode
2. Verifier NavBar + panels sur l'ecran initial (Agent page)
3. Naviguer les 6 pages : H → A → S → F → C → M
4. Pour chaque page : capturer, verifier NavBar, onglet actif, contenu, pas d'overflow
5. Tester TaskInputBar : / → focus → Escape → unfocus
6. Rapport OK/FAIL par page

**Fichiers** : `packages/maestro-code/tests/dogfood-navigation.ts` (NOUVEAU)

### Ordre d'execution

1. Fix 2 (flexShrink) — 2 lignes
2. Fix 1 (StatusBar health) — ~15 lignes
3. Fix 3 (overflow) — ~8 lignes
4. Fix 4 (reponse agent) — ~20 lignes
5. Script navigation — ~120 lignes
6. Verification : vitest + real-demo-check + dogfood-navigation

### Verification E
- [ ] `npx vitest run tests/` — tests existants passent
- [ ] `node tests/real-demo-check.cjs` — 4/4 PASS
- [ ] `npx tsx tests/dogfood-navigation.ts` — toutes les pages OK
- [ ] StatusBar affiche "connected" quand backend tourne
- [ ] NavBar ne rapetisse plus
- [ ] Blocs ne depassent plus des panels
- [ ] Reponse de l'agent visible dans ConversationLog
