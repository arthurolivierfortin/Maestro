# Phase 44-C : TUI Feature Completion

**Statut** : A faire
**Prerequis** : Phase 44-B COMPLETE (verifier `docs/phases/PHASE-44-B/checkpoint.md` — dogfooding score >= 4.0/5)
**Objectif** : Transformer `maestro code` d'un outil de monitoring en un outil de productivite en ajoutant les features V1 manquantes identifiees par le dogfooding Phase 44.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-44-C/checkpoint.md`** apres chaque sous-phase
4. **Committer apres chaque sous-phase** — ne jamais laisser une sous-phase entiere sans commit
5. **Toujours verifier via PTY (TuiDriver)** — pas seulement vitest (lecon Phase 44)
6. **Ne PAS ajouter `@ts-nocheck`** aux nouveaux fichiers — les 33 fichiers existants sont du legacy, les nouveaux doivent etre types
7. **Ne PAS creer de nouveaux composants quand un composant existant peut etre etendu** — eviter la proliferation
8. **Toujours tester avec le backend reel** en plus du demo mode

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 44-C-A | Differencier Foundry vs Catalog | 1 jour |
| 44-C-B | Block creation depuis Foundry | 1 jour |
| 44-C-C | Help overlay sur toutes les pages | 0.5 jour |
| 44-C-D | Context/token usage display | 0.5 jour |
| 44-C-E | Error display + retry | 0.5 jour |
| 44-C-F | Git status integration | 0.5 jour |
| 44-C-G | Dead code cleanup | 0.5 jour |
| 44-C-H | Dogfooding final V1-ready | 0.5 jour |

---

## 44-C-A : Differencier Foundry vs Catalog

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/components/FoundryScreen.ts` — rendu actuel, `apiClient.listBlocks()` (ligne 80)
- `packages/maestro-code/components/CatalogScreen.ts` — rendu actuel, `apiClient.listBlocks()` (ligne 137), type filter tabs
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` — existe-t-il un parametre `?designation=` ou `?source=` ?
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs` — comment les blocks sont decouverts, y a-t-il une distinction user/system ?
- `content/system/blocks/` — structure des repertoires (system vs user blocks)

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Comprendre la distinction** :
   - Les blocks dans `content/system/blocks/` sont les blocks systeme (fournis avec Maestro)
   - Les blocks crees par l'utilisateur via Foundry/workspace devraient etre dans un repertoire separe (`.maestro/blocks/` du repo, ou un repertoire utilisateur)
   - Verifier si `BlockDefinition` a un champ `designation`, `source`, `authority` ou `sourcePath` qui permet de distinguer

2. **Implementer le filtrage** :
   - **Option A (backend)** : Si le backend supporte deja `?designation=user` ou `?source=user` → utiliser ce filtre dans FoundryScreen
   - **Option B (client-side)** : Si pas de filtre backend, filtrer cote client :
     - Foundry : blocks dont `sourcePath` contient le chemin du repo ou du workspace actif, OU blocks marques `designation: "user"`
     - Catalog : tous les blocks (systeme + user), en read-only
   - **Option C (convention)** : Si aucun champ ne distingue, creer une convention :
     - Foundry : blocks qui n'ont PAS de `metadata.authority` (blocks custom/user)
     - Catalog : blocks qui ONT `metadata.authority: "system"` (blocks officiels Maestro)

3. **Differencier le comportement** :
   - Foundry : afficher CRUD actions (Create [N], Edit [E], Delete [D]) dans le panneau ACTIONS
   - Catalog : afficher seulement [Enter] Detail, [Space] Expand (read-only browse)
   - Foundry titre : "MY BLOCKS" (existant) + nombre de blocks utilisateur
   - Catalog titre : "BLOCK CATALOG" (existant) + nombre total de blocks

4. **Empty state Foundry** :
   - Si 0 blocks utilisateur : afficher un message guide "No blocks yet. Press [N] to create your first block."
   - L'empty state actuel dit "use `maestro block create`" (CLI) — remplacer par l'action TUI

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/FoundryScreen.ts` | Filtrer les blocks (user seulement), ajouter CRUD actions, empty state |
| `packages/maestro-code/components/CatalogScreen.ts` | S'assurer que tous les blocks sont affiches (pas de filtre), read-only actions |
| `packages/maestro-client/src/domains/blocks.ts` | Ajouter un parametre de filtre a `list()` si necessaire |
| `packages/maestro-code/mocks/DemoApiClient.ts` | Ajouter des blocks mock avec des attributs user/system |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Tests
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent

# Commande 2 : Verification PTY — Foundry
# Lancer le TUI, naviguer vers Foundry (F)
# Verifier : titre "MY BLOCKS", actions incluent [N] Create, blocks filtres (user seulement)

# Commande 3 : Verification PTY — Catalog
# Naviguer vers Catalog (C)
# Verifier : titre "BLOCK CATALOG", TOUS les blocks affiches (systeme + user)

# Commande 4 : Comparer les nombres
# Foundry : X blocks (user seulement)
# Catalog : Y blocks (tous) — Y >= X
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS hardcoder une liste de "system block IDs" dans le TUI — le filtrage doit etre base sur des metadonnees (designation, authority, sourcePath)
- Ne PAS supprimer les blocks systeme de Foundry — les deplacer vers Catalog est suffisant. Ne pas casser les references existantes.

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-A : Foundry vs Catalog
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Methode de filtrage** : [Option A/B/C — quel champ utilise]
**Foundry blocks** : [nombre affiché, critere de filtre]
**Catalog blocks** : [nombre affiché]
**Foundry actions** : [lister les actions visibles]
**Tests** : [pass/fail count]
```

---

## 44-C-B : Block creation depuis Foundry

### Lecture obligatoire [OBLIGATOIRE]
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` — `[HttpPost] Create()` (lignes 115-154) et `CreateBlockRequest` DTO
- `apps/backend/src/Maestro.Application/DTOs/CreateBlockRequest.cs` — champs du DTO
- `packages/maestro-client/src/domains/blocks.ts` — existe-t-il un `create()` ? (probablement non)
- `packages/maestro-code/components/FoundryScreen.ts` — ou placer le formulaire de creation
- `content/system/blocks/` — structure des fichiers block.json pour comprendre les champs minimaux

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Ajouter `create()` au SDK** :
   - Dans `packages/maestro-client/src/domains/blocks.ts`, ajouter :
     ```typescript
     create: async (data: { name: string, blockType: string, description?: string }) => {
       return http.post<BlockDefinition>('/api/blocks', data);
     }
     ```

2. **UI de creation dans FoundryScreen** :
   - Quand l'utilisateur presse [N] (New), afficher un formulaire inline ou modal :
     - Champ 1 : Name (text input)
     - Champ 2 : Type (selection : workflow | agent | tool | inference | validator)
     - Champ 3 : Description (text input, optionnel)
   - [Enter] pour confirmer → appel API `blocks.create()`
   - [Escape] pour annuler
   - Apres creation : rafraichir la liste, selectionner le nouveau block

3. **Implementation pragmatique** :
   - Ne PAS creer un systeme de formulaire generique — un composant inline simple suffit
   - Le type selection peut etre un cycle via Tab (comme le filtre type dans CatalogScreen)
   - Apres creation, le block est vide (pas de system prompt, pas de config) — l'utilisateur peut ensuite editer via BlockDetail

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-client/src/domains/blocks.ts` | Ajouter methode `create()` |
| `packages/maestro-client/src/types.ts` | Ajouter `CreateBlockRequest` type si necessaire |
| `packages/maestro-code/components/FoundryScreen.ts` | Ajouter mode creation (formulaire inline), keyboard [N] |
| `packages/maestro-code/mocks/DemoApiClient.ts` | Ajouter `createBlock()` mock |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Tests
cd packages/maestro-code && npx vitest run tests/
cd packages/maestro-client && npx vitest run tests/

# Commande 2 : Test API directement
curl -s -X POST http://localhost:5000/api/blocks -H "Content-Type: application/json" \
  -d '{"name":"Test Block","blockType":"tool","description":"A test"}' | python -m json.tool
# Resultat attendu : block cree avec ID genere

# Commande 3 : Verification PTY — creation flow
# Lancer TUI, Foundry (F), presser N
# Verifier que le formulaire apparait
# Remplir nom + type, Enter
# Verifier que le block apparait dans la liste

# Commande 4 : Cleanup
curl -s -X DELETE http://localhost:5000/api/blocks/test-block
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS creer un composant `CreateBlockForm.ts` separe — inline dans FoundryScreen suffit pour V1
- Ne PAS implementer l'edition complete dans cette sous-phase — juste la creation (nom + type + description)
- Ne PAS oublier le DemoApiClient — il doit simuler la creation pour les tests

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-B : Block creation
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**SDK method** : [decrire la signature]
**API test** : [copier le output du curl POST]
**TUI flow** : [decrire le parcours : N → formulaire → Enter → block dans liste]
**Tests** : [pass/fail count]
```

---

## 44-C-C : Help overlay sur toutes les pages

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/components/SessionMonitor.ts` — HelpOverlay existant (lignes 136-164) : le seul endroit ou `?` affiche une aide
- `packages/maestro-code/App.ts` — global keyboard handling
- `packages/maestro-code/components/AgentScreen.ts` — raccourcis Agent
- `packages/maestro-code/components/SpacesScreen.ts` — raccourcis Spaces
- `packages/maestro-code/components/FoundryScreen.ts` — raccourcis Foundry

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Extraire HelpOverlay en composant reutilisable** :
   - Creer `packages/maestro-code/components/HelpOverlay.ts` (extraction du code dans SessionMonitor)
   - Props : `{ shortcuts: Array<{ key: string, action: string, category?: string }>, onClose: () => void }`
   - Le composant affiche une Box overlay avec les raccourcis groupes par categorie

2. **Definir les raccourcis par page** :
   - Agent : J/K scroll, G go to session, /help, /clear, /new, /stop, /quit
   - Home : J/K select, Enter detail, H/A/S/F/C/M navigation
   - Spaces : J/K select, Enter detail, Tab switch tab, A/R/S filter, 1/2/3 tab shortcuts
   - Foundry : J/K select, Enter detail, Space expand, N new block
   - Catalog : J/K select, Enter detail, Space expand, Tab type filter
   - Models : J/K select, Enter detail

3. **Ajouter `?` comme raccourci global dans App.ts** :
   - Quand `?` est presse (et input non focus), afficher le HelpOverlay de la page courante
   - Stocker les definitions de raccourcis dans un objet `PAGE_SHORTCUTS` indexe par page name
   - "Press any key" ou Escape pour fermer

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/HelpOverlay.ts` | **Creer** — composant reutilisable extrait de SessionMonitor |
| `packages/maestro-code/App.ts` | Ajouter state `showHelp`, raccourci `?`, rendu conditionnel de HelpOverlay |
| `packages/maestro-code/components/SessionMonitor.ts` | Remplacer le HelpOverlay inline par le composant extrait |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Tests
cd packages/maestro-code && npx vitest run tests/

# Commande 2 : Verification PTY — ? sur chaque page
# Pour chaque page (Agent, Home, Spaces, Foundry, Catalog, Models) :
# Naviguer vers la page, presser ?, verifier qu'un overlay apparait
# Presser Escape, verifier que l'overlay disparait et la page est restauree
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS dupliquer le composant HelpOverlay dans chaque page — un seul composant dans App.ts, les donnees changent selon la page
- Ne PAS hardcoder les raccourcis dans le composant HelpOverlay — les passer en props
- Ne PAS bloquer les raccourcis de navigation quand le help est ouvert — Escape doit fermer

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-C : Help overlay
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Pages avec help** : [lister les 6 pages testees]
**Nombre de raccourcis par page** : [Agent: X, Home: Y, ...]
**Tests** : [pass/fail count]
```

---

## 44-C-D : Context/token usage display

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/components/AgentScreen.ts` — zone AGENT STATUS
- `packages/maestro-code/services/SessionManager.ts` — extraction d'outputs, `_llmActivity`, `_conversationState_*`
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — comment les tokens sont accumules (lignes 144-146)
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — ou `_llmActivity` est ecrit

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Identifier les sources de donnees tokens** :
   - `_llmActivity` : array d'objets avec `promptTokens`, `completionTokens`, `duration` par appel LLM
   - `_conversationState_*` : contient `estimatedTotalTokens` pour la conversation
   - Determiner quel source est la plus fiable et accessible

2. **Afficher les tokens dans AgentScreen** :
   - Dans la zone AGENT STATUS ou dans la StatusBar :
     - `Tokens: 1,234 / ~128K` (tokens utilises / context window approximatif)
     - `Cost: ~$0.02` (si le pricing est disponible dans `_llmActivity`)
   - Si les donnees ne sont pas disponibles dans le polling actuel de SessionManager, ajouter l'extraction de `_llmActivity` ou `_conversationState_*`

3. **Afficher dans la StatusBar** (optionnel, si la place le permet) :
   - Format compact : `1.2K tokens • $0.02`
   - A cote du statut de connexion existant

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/AgentScreen.ts` | Ajouter token/cost display dans AGENT STATUS |
| `packages/maestro-code/services/SessionManager.ts` | Extraire `_llmActivity` ou `_conversationState_*` du polling |
| `packages/maestro-code/App.ts` | Passer les donnees token a AgentScreen si necessaire |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Verifier les donnees disponibles
# Apres avoir envoye un message via le TUI :
curl -s http://localhost:5000/api/sessions/<ID>/variables/_llmActivity | python -m json.tool
# Resultat attendu : array avec des objets contenant des infos de tokens

# Commande 2 : Verification PTY
# Envoyer un message, attendre la reponse, capturer le frame
# Verifier que "Tokens:" ou "tokens" apparait dans la zone AGENT STATUS

# Commande 3 : Tests
cd packages/maestro-code && npx vitest run tests/
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS inventer des chiffres de tokens — afficher seulement ce que le backend fournit reellement
- Ne PAS afficher le cout si le pricing n'est pas fiable (les prix hardcodes dans `LLMBlockExecutorBase` sont perime selon l'audit)
- Ne PAS surcharger la StatusBar — si pas de place, mettre dans AGENT STATUS seulement

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-D : Token display
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Source de donnees** : [_llmActivity / _conversationState_* / autre]
**Format affiche** : [copier la ligne exacte du frame]
**curl _llmActivity** : [copier les 5 premieres lignes]
**Tests** : [pass/fail count]
```

---

## 44-C-E : Error display + retry

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/components/ConversationLog.ts` — rendu actuel des lignes de conversation
- `packages/maestro-code/services/SessionManager.ts` — comment les erreurs sont detectees et propagees
- `packages/maestro-code/components/AgentScreen.ts` — state agentState et comment les erreurs sont affichees

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Detecter les erreurs dans le polling** :
   - Dans `SessionManager.ts`, quand le polling detecte un node avec `status: "error"` dans `_executionTree` :
     - Extraire le message d'erreur
     - Ajouter une ligne d'erreur dans la conversation log avec un format distinct

2. **Afficher les erreurs distinctement dans ConversationLog** :
   - Les lignes d'erreur doivent avoir un format visuel different : prefixe `[ERROR]` en rouge, ou `!! Error: ...`
   - L'erreur doit etre expandable : ligne courte par defaut, detail complet sur `Enter` ou `Space`
   - Si le detail est trop long, tronquer a 5 lignes

3. **Retry action** :
   - Quand le dernier message a produit une erreur, afficher `[R] Retry` dans le panneau ACTIONS
   - Presser R re-soumet le dernier message utilisateur (meme input)
   - Implementation : stocker le dernier message dans SessionManager, re-appeler `submitTask()` sur R

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/ConversationLog.ts` | Ajouter format d'erreur distinct, expansion |
| `packages/maestro-code/services/SessionManager.ts` | Detecter erreurs dans le polling, stocker dernier message pour retry |
| `packages/maestro-code/components/AgentScreen.ts` | Ajouter action [R] Retry quand erreur, handler |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Tests
cd packages/maestro-code && npx vitest run tests/

# Commande 2 : Provoquer une erreur
# Arreter le LLM-Provider (kill process port 5010)
# Envoyer un message dans le TUI
# Verifier que l'erreur s'affiche dans la conversation (pas juste "idle")
# Verifier que [R] Retry apparait

# Commande 3 : Tester le retry
# Relancer le LLM-Provider
# Presser R dans le TUI
# Verifier que le message est re-soumis et une reponse arrive
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS cacher les erreurs — l'utilisateur DOIT voir quand quelque chose echoue (principe "no silent failures")
- Ne PAS implementer un retry automatique — c'est l'utilisateur qui decide de retenter
- Ne PAS re-creer une session pour le retry — reutiliser la meme session

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-E : Error display + retry
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Error format** : [copier la ligne d'erreur du frame]
**Retry flow** : [decrire : R presse → message re-soumis → reponse recue]
**Tests** : [pass/fail count]
```

---

## 44-C-F : Git status integration

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/App.ts` — StatusBar props
- `packages/maestro-code/components/AgentScreen.ts` — AGENT STATUS zone
- `packages/maestro-code/services/SessionManager.ts` — repoPath est deja connu

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Lire le statut git du repo cible** :
   - A l'initialisation de SessionManager (ou dans App.ts), executer `git` pour obtenir :
     - `git rev-parse --abbrev-ref HEAD` → branche courante
     - `git status --porcelain` → nombre de fichiers modifies
   - Utiliser `child_process.execSync` ou `execa` (si deja dependance)
   - Cacher le resultat et rafraichir toutes les 30 secondes (pas a chaque render)

2. **Afficher dans AGENT STATUS** :
   - Format : `○ Agent: idle  |  C:/Cantante  |  main (+3)  |  Session: 7e165bc8`
   - `main` = branche courante
   - `(+3)` = 3 fichiers modifies (unstaged + staged)
   - Si pas un repo git → ne pas afficher la section git

3. **Optionnel : StatusBar compact** :
   - Si la place le permet : `main (+3)` dans la StatusBar a cote de la connexion

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/services/SessionManager.ts` | Ajouter methode `getGitStatus()` avec cache |
| `packages/maestro-code/components/AgentScreen.ts` | Afficher branche + changes dans AGENT STATUS |
| `packages/maestro-code/App.ts` | Appeler getGitStatus periodiquement, passer a AgentScreen |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Tests
cd packages/maestro-code && npx vitest run tests/

# Commande 2 : Verification PTY avec un repo git
# Lancer le TUI avec --repo C:/Cantante
# Verifier que la branche et le nombre de changes apparaissent dans AGENT STATUS

# Commande 3 : Verification PTY sans repo git
# Lancer le TUI avec --repo /tmp (ou un repertoire non-git)
# Verifier que la section git n'apparait PAS (pas d'erreur, pas de "not a git repo")
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS executer `git status` a chaque render — cache avec TTL de 30 secondes
- Ne PAS bloquer le rendering en attendant git — executer en async avec un state
- Ne PAS crash si `git` n'est pas installe — try/catch, afficher rien

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-F : Git status
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Format affiche** : [copier la ligne AGENT STATUS du frame]
**Repo git** : [branche + changes visibles]
**Non-git** : [pas d'erreur, section masquee]
**Tests** : [pass/fail count]
```

---

## 44-C-G : Dead code cleanup

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/components/GlobalMonitor.ts` — 215 lignes, importe SessionList et PhaseList, importe par RIEN
- `packages/maestro-code/components/SessionList.ts` — 187 lignes, utilise seulement par GlobalMonitor
- `packages/maestro-code/components/PhaseList.ts` — 118 lignes, utilise seulement par GlobalMonitor
- `packages/maestro-code/components/LLMMonitorScreen.ts` — 119 lignes, importe par RIEN

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Supprimer les 4 fichiers dead code** :
   - `packages/maestro-code/components/GlobalMonitor.ts`
   - `packages/maestro-code/components/SessionList.ts`
   - `packages/maestro-code/components/PhaseList.ts`
   - `packages/maestro-code/components/LLMMonitorScreen.ts`

2. **Verifier qu'aucune reference n'est cassee** :
   - Grep pour les imports de ces 4 composants dans tout le monorepo
   - Si des tests les importent, supprimer les tests aussi

3. **Supprimer `ink-table.ts` et `ink-table-launcher.ts`** si confirmes non utilises :
   - Verifier d'abord avec grep que rien ne les importe

4. **Supprimer `createDemoApiClient` factory** (dans `mocks/demo-data.ts` ligne 62-84) si confirmee non appelee :
   - Verifier avec grep

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/GlobalMonitor.ts` | **Supprimer** |
| `packages/maestro-code/components/SessionList.ts` | **Supprimer** |
| `packages/maestro-code/components/PhaseList.ts` | **Supprimer** |
| `packages/maestro-code/components/LLMMonitorScreen.ts` | **Supprimer** |
| `packages/maestro-code/ink-table.ts` | **Supprimer** si non reference |
| `packages/maestro-code/ink-table-launcher.ts` | **Supprimer** si non reference |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Verifier pas de references cassees
cd packages/maestro-code && grep -r "GlobalMonitor\|SessionList\|PhaseList\|LLMMonitorScreen" --include="*.ts" --include="*.tsx" .
# Resultat attendu : 0 resultats (ou seulement les fichiers supprimes)

# Commande 2 : Tests
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent (le nombre peut diminuer si des tests pour le dead code existaient)

# Commande 3 : Build verification
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : PASS
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS commenter le code au lieu de le supprimer — CLAUDE.md interdit le legacy support
- Ne PAS garder un fichier "au cas ou" — git log preservera l'historique si besoin

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-G : Dead code cleanup
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers supprimes** : [lister les fichiers]
**Lignes supprimees** : [nombre total]
**Grep confirmation** : [0 resultats pour les imports supprimes]
**Tests** : [pass/fail count]
```

---

## 44-C-H : Dogfooding final V1-ready

### Lecture obligatoire [OBLIGATOIRE]
- `docs/guides/ai-agents/dogfooding-methodology.md` — protocole complet
- `docs/phases/PHASE-44-B/dogfood-notes-validation.md` — notes de la validation 44-B (reference)
- `docs/phases/dogfood-notes-2026-02-27-v1-gaps.md` — les gaps V1 identifies initialement

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Session de dogfooding de 30 minutes** sur `C:/Cantante` avec le backend reel :
   - L'objectif est de simuler un utilisateur V1 : quelqu'un qui decouvre `maestro code` pour la premiere fois
   - Parcours : lancer → lire le help → envoyer un message → voir la reponse → utiliser /new → creer un block → voir les modeles → revenir a l'agent

2. **V1 Feature Checklist** (tous doivent PASS pour sortir de 44-C) :

   **Conversation** :
   - [ ] Multi-turn fonctionne (contexte preservé entre messages)
   - [ ] /help affiche les commandes
   - [ ] /new efface le contexte
   - [ ] /clear vide la conversation
   - [ ] /stop arrete une tache
   - [ ] Session reutilisee entre 2 lancements

   **Pages** :
   - [ ] Home rend correctement (SYSTEM STATUS, ACTIVE SESSIONS, QUICK ACTIONS)
   - [ ] Foundry affiche les blocks UTILISATEUR (differencie du Catalog)
   - [ ] Catalog affiche TOUS les blocks
   - [ ] Models affiche le modele actif et la liste
   - [ ] Spaces affiche les sessions sans pollution
   - [ ] Help overlay (`?`) fonctionne sur toutes les pages

   **Agent** :
   - [ ] Working directory visible dans AGENT STATUS
   - [ ] Git branche + changes visibles
   - [ ] Token usage visible apres un message
   - [ ] Erreur affichee si le LLM est down + retry fonctionne
   - [ ] J/K scroll fonctionne sans ecran blanc

   **Creation** :
   - [ ] Block creation depuis Foundry (N → formulaire → block cree)

   **Stabilite** :
   - [ ] Foundry scroll 20+ items sans ecran blanc
   - [ ] Detail views : 1 seul StatusBar, pas de TaskInputBar parasite
   - [ ] 0 dead code visible (pas de composants fantomes)

3. **Score UX cible** : >= 4.5/5

4. **Creer le fichier de notes** : `docs/phases/PHASE-44-C/dogfood-notes-v1-ready.md`

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-44-C/dogfood-notes-v1-ready.md` | **Creer** — notes de dogfooding V1-ready avec checklist |

### Verification [OBLIGATOIRE]
```bash
# Le dogfooding EST la verification.
# Critere de sortie :
# - Score UX >= 4.5/5
# - 0 bugs critiques
# - 21/21 checks PASS (la V1 feature checklist ci-dessus)
# Si < 21/21 : documenter les fails, creer des tickets pour Phase 45
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS declarer V1-ready si des checks sont en echec — documenter les fails et les tracker
- Ne PAS raccourcir la session a 5 minutes — 30 minutes minimum pour tester les parcours complets
- Ne PAS ignorer les problemes "mineurs" — les utilisateurs les verront

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-C-H : Dogfooding V1-ready
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Score UX** : [X.X/5]
**Checks PASS** : [X/21]
**Checks FAIL** : [lister]
**Bugs trouves** : [0 ou lister]
**Verdict** : [V1-READY / NOT-READY — si not ready, lister les blockers]
**Notes** : [path vers le fichier de notes]
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-44-C/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 44-C (features V1) : Foundry/Catalog differencies, block creation TUI, help overlay toutes pages, token display, error+retry, git status. Dead code: 4 composants supprimes (GlobalMonitor, SessionList, PhaseList, LLMMonitorScreen)."
- Mettre a jour : "Current Project State" — phase active = 45, "V1-ready = true/false"
- Mettre a jour : "Tests" count avec le nouveau total
- Retirer : les mentions de "monitoring tool, not productivity tool" si V1-ready
