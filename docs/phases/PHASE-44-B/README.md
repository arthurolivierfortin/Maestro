# Phase 44-B : Stabilisation critique

**Statut** : A faire
**Prerequis** : Phase 44 COMPLETE (verifier `docs/phases/PHASE-44/checkpoint.md`)
**Objectif** : Corriger les bugs bloquants, les failles de securite, et implementer la conversation persistante — rendant `maestro code` utilisable pour des sessions reelles de plus de 2 messages.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-44-B/checkpoint.md`** apres chaque sous-phase
4. **Committer apres chaque sous-phase** — ne jamais laisser une sous-phase entiere sans commit
5. **Ne PAS toucher aux pages TUI** (HomeScreen, FoundryScreen, CatalogScreen, SpacesScreen) sauf pour les fixes specifiques mentionnes
6. **Ne PAS ajouter de nouvelles dependances npm** sauf si absolument necessaire
7. **Tester avec le backend reel** — les fixes demo-only sont insuffisants (lecon Phase 44)
8. **Verification obligatoire** : chaque fix doit etre verifie via PTY (`TuiDriver`) ou `curl`, pas juste via `vitest`

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 44-B-A | Securite : path traversal + shell injection | 0.5 jour |
| 44-B-B | Data integrity : BlocksController.Update + WorkspacesController persist | 0.5 jour |
| 44-B-C | TUI stability : scroll blank + double StatusBar + input bar | 0.5 jour |
| 44-B-D | SDK contract : Models page field mapping | 0.5 jour |
| 44-B-E | Conversation persistante (ADR Option B) | 2-3 jours |
| 44-B-F | Slash commands de base + task cancellation | 1 jour |
| 44-B-G | Session reuse + working directory indicator | 0.5 jour |
| 44-B-H | Dogfooding de validation | 0.5 jour |

---

## 44-B-A : Securite — path traversal + shell injection

### Lecture obligatoire [OBLIGATOIRE]
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` — lignes 397-421 : endpoints GetContent/PutContent avec `Path.Combine` non valide
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` — lignes 230-242 : shell injection via `cmd.exe /c`
- `docs/phases/dogfood-audit-2026-02-27-full.md` — section LAYER 2 : B-C1 et B-C2

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **BlocksController.cs** — Ajouter une validation de path traversal dans `GetContent` (ligne 402) et `PutContent` (ligne 416) :
   - Apres `Path.Combine(blockPath, filePath)`, appeler `Path.GetFullPath()`
   - Verifier que le chemin normalise commence par `Path.GetFullPath(blockPath) + Path.DirectorySeparatorChar`
   - Retourner `BadRequest("Path traversal not allowed")` sinon

2. **ToolBlockExecutor.cs** — Securiser l'execution shell :
   - Ligne 230-236 : echapper les metacaracteres shell dans `shellCmd` avant de le passer a `cmd.exe /c` ou `/bin/bash -c`
   - Valider que `scriptFile` (lignes 118-122) ne contient pas `..`, `/`, `\` en debut de chemin, ni de chemin absolu
   - Ajouter une whitelist de caracteres autorises pour les noms de scripts

3. **ToolBlockExecutor.cs** — Securiser le path d'artefacts :
   - Ligne 654 : apres `Path.Combine(workingDir, filePath)`, verifier que le chemin normalise reste sous `workingDir`

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` | Ajouter validation path traversal dans GetContent (L402) et PutContent (L416) |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` | Echapper shell input (L236), valider scriptFile (L120), valider artifact path (L654) |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Build backend
cd apps/backend && dotnet build
# Resultat attendu : Build succeeded. 0 erreur.

# Commande 2 : Test path traversal bloque
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/blocks/maestro-assistant/content/../../appsettings.json
# Resultat attendu : 400 (Bad Request), PAS 200

# Commande 3 : Test path normal fonctionne
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/blocks/maestro-assistant/content/system-prompt.md
# Resultat attendu : 200
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS utiliser une regex pour valider les chemins — `Path.GetFullPath()` + `StartsWith` est la seule approche fiable
- Ne PAS desactiver le toolType "shell" entierement — c'est utilise par des blocks existants. Securiser, pas supprimer.
- Ne PAS ajouter de `try/catch` silencieux autour des validations — l'erreur doit etre visible

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-A : Securite
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Path traversal test** : [copier le output du curl avec ../]
**Shell injection** : [decrire les mecanismes d'echappement ajoutes]
**Build** : [copier la derniere ligne du build]
**Verification** : [copier les 3 resultats curl]
```

---

## 44-B-B : Data integrity — BlocksController.Update + WorkspacesController persist

### Lecture obligatoire [OBLIGATOIRE]
- `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` — lignes 159-198 : endpoint Update qui detruit les donnees
- `apps/backend/src/Maestro.Api/Controllers/WorkspacesController.cs` — lignes 392-586 : 5 endpoints sans persist
- `apps/backend/src/Maestro.Domain/Entities/BlockDefinition.cs` — l'entite domaine et ses methodes

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **BlocksController.cs Update** (lignes 159-198) — Corriger la perte de donnees :
   - NE PAS appeler `BlockDefinition.Create()` quand on met a jour le nom (ligne 169-172). Au lieu de ca, ajouter une methode `UpdateName(string)` a `BlockDefinition` si elle n'existe pas, ou modifier directement le nom
   - Si `request.Config` est fourni, **merger** avec la config existante au lieu de remplacer entierement (iterer les clefs du nouveau config, ecraser seulement celles presentes)
   - Preserver les timestamps, metrics, et version existants

2. **WorkspacesController.cs** — Ajouter le persist manquant apres chaque mutation :
   - Ligne 406 (UpdatePermissions) : ajouter `await _workspaceService.SaveWorkspaceAsync(workspace)` apres `workspace.UpdatePermissions()`
   - Ligne 481 (SetSessionTemplate) : idem apres `workspace.SetSessionTemplate()`
   - Ligne 509 (DeleteSessionTemplate) : idem apres `workspace.RemoveSessionTemplate()`
   - Ligne 557 (SetEntryPoint) : idem apres `workspace.SetEntryPoint()`
   - Ligne 586 (DeleteEntryPoint) : idem apres `workspace.RemoveEntryPoint()`
   - Verifier que `SaveWorkspaceAsync` ou `UpdateWorkspaceAsync` existe dans le service. Si non, utiliser la methode existante qui persiste (inspecter les autres endpoints comme `UpdateWorkspace()` lignes 116-125 pour le pattern)

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Api/Controllers/BlocksController.cs` | Fix Update() : ne pas recreer le block, merger la config |
| `apps/backend/src/Maestro.Domain/Entities/BlockDefinition.cs` | Ajouter `UpdateName()` si necessaire |
| `apps/backend/src/Maestro.Api/Controllers/WorkspacesController.cs` | Ajouter persist apres 5 mutations (L406, L481, L509, L557, L586) |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Build backend
cd apps/backend && dotnet build
# Resultat attendu : 0 erreur

# Commande 2 : Test que Update preserve la config
# D'abord lire un block
curl -s http://localhost:5000/api/blocks/maestro-assistant | python -m json.tool | head -20
# Noter les champs config
# Puis updater le nom seulement
curl -s -X PUT http://localhost:5000/api/blocks/maestro-assistant -H "Content-Type: application/json" -d '{"name":"Maestro Assistant Updated"}'
# Relire et verifier que config est toujours la
curl -s http://localhost:5000/api/blocks/maestro-assistant | python -m json.tool | head -20
# Resultat attendu : config identique avant/apres
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS ajouter un endpoint PATCH separe — corriger le PUT existant
- Ne PAS ecrire un test unitaire qui mocke le repository — tester avec le vrai backend via curl

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-B : Data integrity
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Block Update** : [copier config avant/apres update]
**Workspace persist** : [nombre de lignes ajoutees, methode utilisee]
**Build** : [derniere ligne]
```

---

## 44-B-C : TUI stability — scroll blank + double StatusBar + input bar

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/App.ts` — comprendre le wrapper global (TaskInputBar + StatusBar) et le rendering des detail views
- `packages/maestro-code/components/ConversationLog.ts` — scroll implementation actuelle
- `packages/maestro-code/components/AgentScreen.ts` — keyboard J/K et scroll state
- `packages/maestro-code/components/FoundryScreen.ts` — scroll pattern (celui-ci marche, utiliser comme reference)
- `docs/phases/PHASE-44/dogfood-session2-2026-02-27.md` — BUG-7, BUG-8, BUG-9

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Fix BUG-8 : Foundry scroll blank** — Le scroll de FoundryScreen utilise `visibleItems = termRows - 9`. Mais App.ts ajoute 6 lignes de chrome global (TaskInputBar 3 lignes + StatusBar 3 lignes). Quand `scrollStart + visibleItems > sortedBlocks.length` apres le chrome, l'ecran se vide.
   - Dans `FoundryScreen.ts`, reduire `visibleItems` pour tenir compte du chrome global (ajouter un parametre `chromeHeight` ou calculer a partir de `process.stdout.rows - totalChromeLines`)
   - Meme pattern dans `CatalogScreen.ts` si applicable

2. **Fix BUG-9 : Agent J/K scroll blank** — `AgentScreen.ts` gere J/K mais le `scrollOffset` state manque ou n'est pas correctement passe a `ConversationLog`.
   - Verifier que `AgentScreen` a un state `scrollOffset` (useState)
   - Verifier que J incremente et K decremente le scrollOffset (avec bounds)
   - Verifier que `ConversationLog` recoit et utilise `scrollOffset` pour le slicing (pattern : `lines.slice(startIndex, endIndex)`)
   - S'inspirer du pattern de `FoundryScreen` qui derive le scroll de `selectedIndex`

3. **Fix BUG-7 : Double StatusBar dans les detail views** — Quand `detailView` est actif dans App.ts, le composant de detail (BlockDetail, ModelDetail, etc.) rend son propre StatusBar. App.ts rend aussi le StatusBar global.
   - Option A : Dans App.ts, ne pas rendre le StatusBar global quand `detailView !== null`
   - Option B : Dans les composants de detail, supprimer leur StatusBar interne
   - Choisir l'option la plus simple. Option A est probablement meilleure (un seul point de controle)
   - Aussi verifier que TaskInputBar n'apparait pas dans les detail views (normalement `currentPage === 'agent'` protege, mais verifier)

4. **Fix BUG-P1-4 : Input bar ne clear pas sur Escape** — Dans `App.ts` lignes 263-266, quand Escape est presse, `setInputFocused(false)` est appele mais la valeur du champ n'est pas effacee.
   - Ajouter `setInputValue('')` (ou equivalent) dans le handler Escape de App.ts
   - Verifier dans `TaskInputBar.ts` que le composant se reset correctement quand la valeur parente change

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/FoundryScreen.ts` | Reduire `visibleItems` pour compenser le chrome global |
| `packages/maestro-code/components/CatalogScreen.ts` | Meme fix si meme pattern de scroll |
| `packages/maestro-code/components/AgentScreen.ts` | Verifier/ajouter scrollOffset state, passer a ConversationLog |
| `packages/maestro-code/components/ConversationLog.ts` | Verifier que scrollOffset est utilise pour le slicing |
| `packages/maestro-code/App.ts` | Ne pas rendre StatusBar quand detailView actif + clear input sur Escape |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Tests unitaires
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests existants passent (69+)

# Commande 2 : Verification PTY — scroll Foundry (CRITIQUE)
# Lancer le TUI en demo, naviguer vers Foundry (F), presser J 20 fois, capturer le frame
# Le frame doit avoir > 0 lignes non-vides
cd packages/maestro-code && npx tsx tests/tui-driver.ts --demo --test-scroll-foundry
# OU verification manuelle via dogfood-real.ts

# Commande 3 : Verification PTY — scroll Agent (CRITIQUE)
# Lancer le TUI, soumettre un message, presser K 5 fois puis J 5 fois
# Aucun frame ne doit etre completement vide
cd packages/maestro-code && npx tsx tests/tui-driver.ts --demo --test-scroll-agent

# Commande 4 : Verification PTY — detail view
# Aller sur Foundry (F), presser Enter sur un block, verifier qu'il n'y a qu'UN StatusBar
# Verifier que TaskInputBar n'est PAS present
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS tester le scroll seulement avec 5 items — le bug apparait quand `items > visibleItems`. Tester avec 20+ items.
- Ne PAS utiliser `marginBottom` ou `marginTop` pour gerer le scroll — cela pousse le contenu hors ecran au lieu de le fenestrer
- Ne PAS faire confiance aux tests vitest pour le scroll — utiliser TuiDriver/PTY (lecon Phase 44)

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-C : TUI stability
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Foundry scroll** : [frame lines apres 20x J — nombre de lignes non-vides]
**Agent scroll** : [frame lines apres 5x K — nombre de lignes non-vides]
**Detail view StatusBar** : [nombre de StatusBar visibles dans le frame BlockDetail]
**Input bar Escape** : [valeur du champ apres type + Escape + refocus]
**Tests** : [nombre pass/fail]
```

---

## 44-B-D : SDK contract — Models page field mapping

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/components/ModelsScreen.ts` — lignes 79, 159, 198 : utilisation de `modelId`
- `packages/maestro-client/src/types.ts` — interface `LLMModel` (lignes 175-196)
- `packages/maestro-client/src/domains/llm.ts` — `models()` et unwrapping (lignes 11-26)
- `llm-provider/dotnet/src/LLMProvider.Web/Controllers/ModelsController.cs` — le DTO reel que le backend retourne

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Verifier le contrat API reel** :
   - `curl -s http://localhost:5010/api/v1/models | python -m json.tool | head -50` — noter la shape (array vs wrapper) et les noms de champs
   - `curl -s http://localhost:5000/api/provider/models | python -m json.tool | head -50` — noter la shape du proxy Maestro
   - `curl -s http://localhost:5000/api/provider/health | python -m json.tool` — noter le nom du champ pour le modele actif (`model` vs `activeModel`)

2. **Aligner les types SDK** :
   - Mettre a jour `LLMModel` dans `types.ts` pour correspondre au DTO backend exact
   - Mettre a jour `LLMHealth` (ou equivalent) pour avoir le bon nom de champ (`model` ou `activeModel`)
   - Mettre a jour `llm.ts models()` si le unwrapping est incorrect

3. **Aligner le TUI** :
   - `ModelsScreen.ts` ligne 79 : utiliser le bon nom de champ (celui du type SDK corrige)
   - `ModelsScreen.ts` ligne 159 : `model?.modelId` → utiliser le bon champ pour la navigation vers detail
   - `ModelsScreen.ts` ligne 198 : `model.modelId === activeModel` → aligner les deux cotes de la comparaison
   - Tester que le `DemoApiClient` retourne les memes noms de champs que le SDK

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-client/src/types.ts` | Corriger `LLMModel` et `LLMHealth` pour matcher le backend |
| `packages/maestro-client/src/domains/llm.ts` | Corriger le unwrapping si necessaire |
| `packages/maestro-code/components/ModelsScreen.ts` | Utiliser les bons noms de champs (L79, L159, L198) |
| `packages/maestro-code/mocks/DemoApiClient.ts` | Aligner les mock data avec les types corriges |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Verifier le contrat reel
curl -s http://localhost:5010/api/v1/models | python -m json.tool | head -30
# Resultat attendu : voir les noms de champs reels

# Commande 2 : Verifier le proxy Maestro
curl -s http://localhost:5000/api/provider/models | python -m json.tool | head -30

# Commande 3 : Tests
cd packages/maestro-code && npx vitest run tests/
cd packages/maestro-client && npx vitest run tests/

# Commande 4 : Verification PTY — Models page
# Lancer le TUI, naviguer vers Models (M), verifier :
# 1. "Active Model: claude-sonnet-4-6" (pas "-")
# 2. Liste des modeles visible (pas "0 models")
# 3. Enter sur un modele ouvre le detail (pas no-op)
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS utiliser de fallback chains (`model.id || model.modelId || model.name`) — c'est un symptome de contrat non verifie. UN nom de champ, verifie par curl.
- Ne PAS deviner les noms de champs — `curl` le endpoint reel AVANT de modifier le code
- Ne PAS oublier le DemoApiClient — il doit retourner la meme shape que le SDK

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-D : SDK contract
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**curl /api/v1/models** : [copier les 3 premieres lignes pour montrer la shape]
**curl /api/provider/health** : [copier le champ du modele actif]
**Champs corriges** : [lister les renommages : ancien → nouveau]
**Models page PTY** : [Active Model affiché, nombre de modeles, Enter ouvre detail]
**Tests** : [pass/fail count pour maestro-code + maestro-client]
```

---

## 44-B-E : Conversation persistante (ADR Option B)

### Lecture obligatoire [OBLIGATOIRE]
- `docs/system/design-decisions/ADR-CONVERSATION-MANAGEMENT.md` — le design complet (Option B, workflow-driven)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ConversationBlockExecutor.cs` — operations actuelles (create, add-message, get-state, get-messages, cleanup)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — lignes 83-86 : creation de conversation par invocation
- `apps/backend/src/Maestro.Application/Interfaces/IConversationManager.cs` — interface actuelle
- `content/system/templates/sessions/maestro-assistant.session.json` — template actuel (1 entry point, pas de phases)
- `content/system/blocks/infrastructure/conversation.block.json` — block de conversation existant
- `packages/maestro-code/services/SessionManager.ts` — soumission de taches (lignes 115-118 : `{ message, repoPath }`)

### Ce que cette sous-phase fait [OBLIGATOIRE]

C'est la sous-phase la plus complexe. Suivre l'ADR exactement.

#### Etape 1 : Workflow block pour le message
1. Creer `content/system/blocks/workflows/maestro-assistant-workflow.block.json` :
   - Type `workflow`, `isAtomic: false`
   - `config.nodes` selon l'ADR section 3 :
     - Node `ensure-conversation` : conditionnel, cree une conversation si `_activeConversation` est null
     - Node `save-user-message` : `conversation` block, operation `add-message`
     - Node `load-history` : `conversation` block, operation `get-messages`
     - Node `execute-agent` : `blockRef: "system:maestro-assistant"` avec input `conversationHistory`
     - Node `save-assistant-response` : `conversation` block, operation `add-message`

#### Etape 2 : AgentBlockExecutor — seed conversation from history
2. Dans `AgentBlockExecutor.cs`, apres `CreateConversation(systemPrompt)` (ligne 84) :
   - Lire `inputs["conversationHistory"]`
   - Si present et non vide, deserialiser en `List<ChatMessage>` et ajouter chaque message a la conversation via `_conversationManager.AddMessage()`
   - Puis ajouter le message utilisateur courant

#### Etape 3 : ConversationBlockExecutor — output pour workflow
3. Dans `ConversationBlockExecutor.cs` :
   - Verifier que `get-messages` retourne les messages dans un format consommable par le workflow (JSON serialise dans les outputs)
   - Si l'output est un objet complexe, s'assurer que le workflow peut le passer comme input string a l'agent

#### Etape 4 : Template update
4. Mettre a jour `maestro-assistant.session.json` :
   - `entryPoints.message` : pointer vers `maestro-assistant-workflow` (le nouveau workflow)
   - Ajouter `_activeConversation: null` et `_conversations: []` aux variables
   - Ajouter `_phases` selon l'ADR section 6

#### Etape 5 : SessionManager — passer l'historique
5. Dans `SessionManager.ts` :
   - Le workflow gere maintenant la conversation. `SessionManager` n'a plus besoin de gerer l'historique.
   - Verifier que `submitTask()` passe toujours `{ message, repoPath }` — le workflow s'occupe du reste

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `content/system/blocks/workflows/maestro-assistant-workflow.block.json` | **Creer** — workflow 5 nodes selon ADR |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Ajouter seed conversation from `conversationHistory` input (apres L84) |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ConversationBlockExecutor.cs` | Verifier/ajuster output de `get-messages` pour workflow consumption |
| `content/system/templates/sessions/maestro-assistant.session.json` | Update entry points, ajouter variables conversation |
| `packages/maestro-code/services/SessionManager.ts` | Verifier compatibilite (minimal changes attendu) |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Build backend
cd apps/backend && dotnet build
# Resultat attendu : 0 erreur

# Commande 2 : Verifier que le workflow block est decouvert
curl -s http://localhost:5000/api/blocks/maestro-assistant-workflow | python -m json.tool | head -10
# Resultat attendu : block avec type "workflow" et config.nodes

# Commande 3 : Test multi-turn conversation (CRITIQUE)
# Creer une session, envoyer un premier message, puis un deuxieme
# Le deuxieme message DOIT faire reference au contexte du premier
cd packages/maestro-cli
node index.js session create --type project --name "Conv Test" --repo "C:/Cantante" --template maestro-assistant --start
# [noter l'ID]
node index.js session invoke <ID> message --input message="What is the Cantante project about?" repoPath="C:/Cantante"
# Attendre la reponse
node index.js session invoke <ID> message --input message="What framework does it use?" repoPath="C:/Cantante"
# Verifier que la reponse fait reference a Cantante (pas "I don't have context")

# Commande 4 : Verifier les variables de conversation
curl -s http://localhost:5000/api/sessions/<FULL-UUID>/variables/_activeConversation
# Resultat attendu : un conversation ID (pas null)

# Commande 5 : Test via TUI (verification finale)
# Lancer maestro code, envoyer "What is Cantante?", puis "What framework?"
# La deuxieme reponse doit avoir du contexte
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS stocker l'historique dans le TUI (SessionManager.ts) — c'est le workflow qui gere via les conversation blocks. Le TUI est un thin client.
- Ne PAS modifier `InMemoryConversationManager` pour persister sur disque — utiliser les session variables comme persistence (Phase 1 de l'ADR)
- Ne PAS hardcoder les noms de nodes dans le C# — le workflow JSON les definit, le backend les execute generiquement
- Ne PAS creer de nouveaux entry points (`new-conversation`, `clear-conversation`) dans cette sous-phase — c'est pour 44-B-F

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-E : Conversation persistante
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Workflow block** : [path du fichier cree, nombre de nodes]
**AgentBlockExecutor** : [decrire le changement pour conversationHistory]
**Multi-turn test** : [copier la reponse au 2eme message — doit referencer le contexte]
**_activeConversation** : [valeur apres le test]
**Build** : [derniere ligne]
**Tests** : [pass/fail count backend + maestro-code]
```

---

## 44-B-F : Slash commands de base + task cancellation

### Lecture obligatoire [OBLIGATOIRE]
- `packages/maestro-code/App.ts` — lignes 258-267 (input handling), lignes 381-382 (slash commands existants)
- `packages/maestro-code/services/SessionManager.ts` — `submitTask()` et comment il invoke les entry points
- `docs/system/design-decisions/ADR-CONVERSATION-MANAGEMENT.md` — sections `/new`, `/clear`, `/switch`
- `content/system/templates/sessions/maestro-assistant.session.json` — entry points actuels

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Parser les slash commands dans App.ts** :
   - Dans le handler qui envoie le message a `SessionManager.submitTask()`, intercepter les messages qui commencent par `/`
   - Dispatcher vers des handlers specifiques :
     - `/help` → afficher un overlay ou un message dans la conversation avec les commandes disponibles
     - `/clear` → invoquer l'entry point `clear-conversation` (cree dans cette sous-phase)
     - `/new` → invoquer l'entry point `new-conversation`
     - `/stop` → annuler la tache en cours (voir point 3)
     - `/quit`, `/q` → existant, ne pas toucher

2. **Creer les workflows pour `/new` et `/clear`** :
   - `content/system/blocks/workflows/maestro-new-conversation.block.json` — cree une nouvelle conversation et met a jour `_activeConversation`
   - `content/system/blocks/workflows/maestro-clear-conversation.block.json` — cleanup l'ancienne conversation et en cree une nouvelle
   - Mettre a jour `maestro-assistant.session.json` pour ajouter les entry points `new-conversation` et `clear-conversation`

3. **Task cancellation (`/stop` + Ctrl+C handling)** :
   - Dans `App.ts`, intercepter Ctrl+C quand une tache est en cours : au lieu de quitter le TUI, envoyer un signal d'annulation
   - Dans `SessionManager.ts`, ajouter une methode `cancelTask()` qui appelle `POST /api/sessions/{id}/cancel` (ou equivalent)
   - Si le backend n'a pas d'endpoint cancel, implementer un : mettre le status du node executant a `cancelled` et arreter le workflow
   - Si l'implementation cancel est trop complexe, au minimum : `/stop` dans le TUI qui reset le state local (agentState → idle, stop polling)

4. **`/help` implementation** :
   - Ajouter un message systeme dans la conversation log qui liste les commandes disponibles
   - Pas besoin d'un overlay complexe — juste un message formate dans le log

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | Ajouter slash command parsing dans le submit handler, Ctrl+C interception |
| `packages/maestro-code/services/SessionManager.ts` | Ajouter `cancelTask()`, ajouter `invokeEntryPoint(name)` pour /new et /clear |
| `content/system/blocks/workflows/maestro-new-conversation.block.json` | **Creer** — workflow new-conversation |
| `content/system/blocks/workflows/maestro-clear-conversation.block.json` | **Creer** — workflow clear-conversation |
| `content/system/templates/sessions/maestro-assistant.session.json` | Ajouter entry points `new-conversation`, `clear-conversation` |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Tests
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent

# Commande 2 : Verification PTY — /help
# Lancer le TUI, taper /help, verifier qu'un message s'affiche avec la liste des commandes

# Commande 3 : Verification PTY — /new
# Envoyer un message ("hello"), puis /new, puis "what did I say?"
# La reponse au 3eme message ne doit PAS faire reference a "hello" (contexte efface)

# Commande 4 : Verification PTY — /clear
# Envoyer un message, puis /clear
# La conversation doit se vider visuellement

# Commande 5 : Verification — /stop ou Ctrl+C
# Lancer une tache longue, puis /stop
# Le TUI doit revenir a l'etat idle sans se fermer
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS hardcoder les slash commands dans un switch/case monolithique — utiliser un objet de dispatch `{ '/help': handleHelp, '/clear': handleClear, ... }`
- Ne PAS implementer `/switch` dans cette sous-phase — c'est Phase 44-C
- Ne PAS fermer le TUI sur Ctrl+C quand une tache est en cours — seulement annuler la tache

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-F : Slash commands
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Commands implementees** : [liste : /help, /clear, /new, /stop]
**Workflows crees** : [paths]
**Entry points ajoutes** : [liste]
**Test /new** : [reponse au message post-/new — pas de contexte]
**Test /stop** : [comportement observe]
**Tests** : [pass/fail count]
```

---

## 44-B-G : Session reuse + working directory indicator

### Lecture obligatoire [OBLIGATOIRE]
- `docs/system/design-decisions/ADR-CONVERSATION-MANAGEMENT.md` — section 1 : Session Persistence
- `packages/maestro-code/services/SessionManager.ts` — `ensureSession()` et le flag `sessionReady`
- `packages/maestro-code/App.ts` — StatusBar et AgentScreen rendering
- `packages/maestro-code/components/AgentScreen.ts` — zone AGENT STATUS

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Session persistence dans `.maestro/session.json`** :
   - Au demarrage du TUI (dans `SessionManager` ou `App.ts`), lire `<repoPath>/.maestro/session.json`
   - Si le fichier existe et contient un `sessionId`, verifier que la session existe sur le backend (`GET /api/sessions/{id}`)
     - Si oui → reutiliser cette session
     - Si non → creer une nouvelle session, ecrire le fichier
   - Si le fichier n'existe pas → creer une nouvelle session, ecrire le fichier
   - Format : `{ "sessionId": "xxx", "createdAt": "...", "template": "maestro-assistant" }`
   - S'assurer que le repertoire `.maestro/` est cree si absent

2. **Working directory indicator** :
   - Dans `AgentScreen.ts`, zone AGENT STATUS, ajouter le chemin du repo en cours
   - Format : `○ Agent: idle  |  C:/Cantante  |  Session: 7e165bc8`
   - Tronquer le chemin si trop long (garder les 2 derniers segments : `.../Cantante`)

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `packages/maestro-code/services/SessionManager.ts` | Ajouter lecture/ecriture `.maestro/session.json` dans `ensureSession()` |
| `packages/maestro-code/components/AgentScreen.ts` | Ajouter le working directory dans AGENT STATUS |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : Test session reuse
# Lancer le TUI avec --repo C:/Cantante, envoyer un message, noter le session ID
# Quitter, relancer, verifier que le meme session ID est reutilise
# Verifier que .maestro/session.json existe dans C:/Cantante
cat C:/Cantante/.maestro/session.json
# Resultat attendu : { "sessionId": "<meme ID>", ... }

# Commande 2 : Test working directory dans le TUI
# Lancer le TUI, verifier que "C:/Cantante" (ou equivalent) apparait dans AGENT STATUS

# Commande 3 : Tests
cd packages/maestro-code && npx vitest run tests/
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS stocker le session ID dans le homedir de l'utilisateur — il doit etre dans le `.maestro/` du repo cible
- Ne PAS lire le fichier de maniere synchrone — utiliser `fs.promises.readFile` avec try/catch

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-G : Session reuse
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**session.json** : [copier le contenu du fichier]
**Reuse test** : [session ID identique entre 2 lancements]
**Working dir** : [copier la ligne AGENT STATUS du frame PTY]
**Tests** : [pass/fail count]
```

---

## 44-B-H : Dogfooding de validation

### Lecture obligatoire [OBLIGATOIRE]
- `docs/guides/ai-agents/dogfooding-methodology.md` — protocole complet
- `docs/phases/PHASE-44/dogfood-session2-2026-02-27.md` — la session de reference (score 2.6/5)
- `docs/phases/PHASE-44/dogfood-notes-2026-02-27.md` — session 1 (score 3.5/5)

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Session de dogfooding complete** sur `C:/Cantante` avec le backend reel :
   - Demarrer les services (`dev-scripts/dev-start.ps1`)
   - Lancer `maestro code` via TuiDriver/PTY
   - Tester chaque fix de 44-B-A a 44-B-G dans un parcours utilisateur reel
   - Suivre la methodology : discovery → interaction → agent flow → API state → output evaluation

2. **Checklist de validation** (tous doivent PASS) :
   - [ ] Multi-turn conversation fonctionne (2+ messages avec contexte)
   - [ ] `/help` affiche les commandes
   - [ ] `/new` efface le contexte (message suivant = pas de reference)
   - [ ] `/clear` vide la conversation
   - [ ] `/stop` ou Ctrl+C arrete la tache sans tuer le TUI
   - [ ] Session reutilisee entre 2 lancements (meme ID)
   - [ ] Working directory visible dans AGENT STATUS
   - [ ] Models page : active model affiche, detail accessible via Enter
   - [ ] Foundry : scroll de 20 items sans ecran blanc
   - [ ] Agent : J/K scroll sans ecran blanc
   - [ ] Detail view : un seul StatusBar, pas de TaskInputBar parasite
   - [ ] Path traversal bloque (curl test)

3. **Score UX cible** : >= 4.0/5 (etait 2.6/5 en session 2)

4. **Creer le fichier de notes** : `docs/phases/PHASE-44-B/dogfood-notes-validation.md`

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-44-B/dogfood-notes-validation.md` | **Creer** — notes de dogfooding avec resultats |

### Verification [OBLIGATOIRE]
```bash
# Le dogfooding EST la verification.
# Critere de sortie : score UX >= 4.0/5, 0 bugs critiques, 12/12 checks PASS
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS declarer le dogfooding PASS si un check est en echec — noter le check comme FAIL et creer un ticket
- Ne PAS utiliser le demo mode pour le dogfooding final — toujours le backend reel
- Ne PAS scripter le dogfooding — l'agent doit observer directement via TuiDriver

### Checkpoint [OBLIGATOIRE]
```markdown
## 44-B-H : Dogfooding
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Score UX** : [X.X/5]
**Checks PASS** : [X/12]
**Checks FAIL** : [lister les checks en echec si applicable]
**Bugs trouves** : [0 ou lister]
**Notes** : [path vers le fichier de notes]
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-44-B/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 44-B (stabilisation) : conversation persistante (ADR Option B implementee), securite (path traversal + shell injection corriges), slash commands (/help /clear /new /stop), session reuse (.maestro/session.json)"
- Ajouter : "Conversation architecture : workflow `maestro-assistant-workflow` → 5 nodes (ensure-conversation, save-user, load-history, execute-agent, save-response). AgentBlockExecutor seeds from `conversationHistory` input."
- Mettre a jour : "Current Project State" — phase active = 44-C
- Retirer : les mentions de "agent has amnesia" / "zero conversation continuity" si presentes
