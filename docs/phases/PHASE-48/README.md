# Phase 48 : Bug Fixes Dogfooding + Agent Local Model

**Statut** : A faire
**Prerequis** : Phase 47 COMPLETE (condition quote-stripping fix confirmed working)
**Objectif** : Corriger les bugs critiques du dogfooding 2026-03-04 et obtenir un assistant Maestro GRATUIT fonctionnel utilisant des modeles locaux (GPU), independant de tout provider cloud payant.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-48/checkpoint.md`** apres chaque sous-phase
4. Ne PAS refactorer du code non lie aux bugs identifies
5. Ne PAS modifier l'architecture workflow/block au-dela du dynamic blockRef
6. Tester chaque fix individuellement avant de passer au suivant

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 48-A | Bug fixes dogfooding (4 bugs) | 1h |
| 48-B | Assistant local gratuit + dynamic blockRef | 2h |
| 48-C | Diagnostic provider Claude Code CLI | 30min |

---

## 48-A : Bug Fixes Dogfooding

### Lecture obligatoire
- `dogfooding/reports/dogfood-2026-03-04-15-13-06.md` — rapport complet des bugs
- `packages/maestro-code/components/SpacesScreen.ts` — comprendre le fetch de sessions
- `packages/maestro-code/components/HomeScreen.ts` — pattern .catch() a reproduire
- `packages/maestro-sidecar/src/config.ts` — bug __dirname ESM
- `packages/maestro-code/components/ConversationLog.ts` — indicateur de step echoue
- `content/system/blocks/system/maestro-assistant/mock-response.json` — fichier a supprimer

### Ce que cette sous-phase fait

#### A1. Supprimer mock-response.json (critique)
1. **Supprimer** `content/system/blocks/system/maestro-assistant/mock-response.json`
2. `LLMBlockExecutorBase.TryLoadMockResponse()` sert ce fichier au lieu d'appeler le LLM si present
3. Meme si le timeout suggere que le mock n'est pas servi, c'est une landmine — le supprimer

#### A2. Fix Spaces session list (missing .catch)
1. Dans `SpacesScreen.ts` ~ligne 302, ajouter `.catch((): any[] => [])` a `apiClient.listSessions()`
2. Pattern identique a `HomeScreen.ts` ligne 270
3. **Root cause** : Sans `.catch()`, une erreur au premier render laisse `data: null` permanent. HomeScreen masque ca avec `.catch()`

#### A3. Fix sidecar ESM __dirname
1. Dans `packages/maestro-sidecar/src/config.ts` ligne 26, remplacer :
   ```typescript
   // AVANT
   let dir = __dirname;
   // APRES
   import { fileURLToPath } from 'url';
   const __filename = fileURLToPath(import.meta.url);
   let dir = path.dirname(__filename);
   ```
2. Le package a `"type": "module"` — `__dirname` n'existe pas en ESM natif

#### A4. Fix indicateur step echoue
1. Dans `ConversationLog.ts` ou `AgentPanel.ts`, quand un step de pipeline timeout/echoue, afficher `✗` au lieu de `…`
2. Actuellement apres un timeout de 5min, "… Execute Agent" garde l'indicateur pending

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `content/system/blocks/system/maestro-assistant/mock-response.json` | SUPPRIMER |
| `packages/maestro-code/components/SpacesScreen.ts` | Modifier — ajouter `.catch()` ligne ~302 |
| `packages/maestro-sidecar/src/config.ts` | Modifier — remplacer `__dirname` par ESM equivalent |
| `packages/maestro-code/components/ConversationLog.ts` | Modifier — indicateur `✗` pour steps echoues |

### Verification
```bash
# Commande 1 : verifier mock supprime
ls content/system/blocks/system/maestro-assistant/mock-response.json
# Resultat attendu : fichier non trouve

# Commande 2 : type check
cd packages/maestro-code && npx tsc --noEmit
# Resultat attendu : pas d'erreurs

# Commande 3 : tests unitaires
cd packages/maestro-code && npm test
# Resultat attendu : tous les tests passent

# Commande 4 : type check sidecar
cd packages/maestro-sidecar && npx tsc --noEmit
# Resultat attendu : pas d'erreurs
```

### Anti-patterns
- Ne PAS ajouter de fallback silencieux pour le mock — le supprimer, point final
- Ne PAS modifier le pattern usePolling/useApiData — corriger seulement l'appel dans SpacesScreen

### Checkpoint
```markdown
## 48-A : Bug Fixes Dogfooding
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**mock-response.json** : supprime (oui/non)
**SpacesScreen .catch()** : ajoute (oui/non)
**Sidecar __dirname** : corrige (oui/non)
**Step echoue indicator** : corrige (oui/non)
**tsc --noEmit** : PASS/FAIL
**npm test** : X/Y tests pass
```

---

## 48-B : Assistant Local Gratuit + Dynamic blockRef

### Lecture obligatoire
- `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json` — agent actuel
- `content/system/blocks/workflows/maestro-assistant-workflow.block.json` — workflow a modifier
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — comprendre ExecuteConfigNodesAsync, resolution de blockRef (~ligne 2106)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — comprendre ResolveChildNodeConfig
- `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` — config providers

### But : un assistant Maestro gratuit sur GPU local

L'objectif principal de cette sous-phase est d'avoir un assistant Maestro fonctionnel qui tourne sur des modeles locaux (GPU) — **zero cout**, pas de dependance a un provider cloud. Ceci :
1. Permet d'utiliser Maestro gratuitement avec ses propres modeles
2. Diagnostique si le timeout du provider Claude Code CLI est le vrai probleme (si le local marche, le pipeline est OK)
3. Ouvre la porte a des agents custom avec n'importe quel mix de modeles

### Architecture : blockRef dynamique + agents par capacite

**Probleme** : `blockRef` dans les noeuds workflow est lu comme string brute (pas de `ResolveTemplate`). On ne peut pas changer dynamiquement quel agent est invoque.

**Principe de nommage** : Les agents ne sont PAS nommes d'apres leur modele, ni d'apres local/cloud. Un agent peut utiliser un MIX de modeles locaux et cloud (ex: planning model cloud + execution model local). Le nom reflete la **capacite ou le purpose** de l'agent :
- `maestro-assistant` — agent complet, full-featured (actuellement Claude Sonnet)
- `maestro-assistant-compact` — agent leger, prompt simplifie, moins de tools (pour modeles locaux ou petits modeles cloud)
- Agents custom de l'utilisateur avec leur propre mix de modeles dans config.nodes

**Solution** : Ajouter `ResolveTemplate()` sur la valeur de `blockRef` dans `EntryPointExecutor.cs` (~ligne 2108). Changement minimal (~2 lignes) :
```csharp
// AVANT
resolvedBlockRef = blockRefProp.GetString();
// APRES
resolvedBlockRef = ResolveTemplate(blockRefProp.GetString(), session);
```

La variable session `_activeAgent` determine quel block agent est invoque. Par defaut = `"system:maestro-assistant"` (comportement actuel preserve).

### Ce que cette sous-phase fait

#### B1. Ajouter resolution de template sur blockRef
1. Dans `EntryPointExecutor.cs`, appliquer `ResolveTemplate()` sur la valeur de `blockRef`
2. Ceci active le pattern `"blockRef": "{{variable}}"` pour TOUS les workflows (pas juste maestro-assistant)
3. Verifier que si la variable n'existe pas, le blockRef brut est utilise tel quel (fallback safe)

#### B2. Creer un agent variant compact
Creer un agent `maestro-assistant-compact` — version allegee pour modeles plus petits :

1. **`system:maestro-assistant-compact`** dans `content/system/blocks/system/maestro-assistant-compact/`
2. Base sur `maestro-assistant.agent.block.json` mais :
   - System prompt simplifie — moins de tools, instructions plus directes
   - `maxTokens: 2048` (vs 4096)
   - `maxIterations: 5` (vs 20)
   - `config.nodes[0].config.model` : un modele local (ex: deepseek, qwen, configurable)
   - Le point cle : le modele EST dans le block config, l'agent EST la combinaison prompt+tools+model
3. L'utilisateur peut creer ses propres variants dans son workspace (ex: `my-assistant-gpu` avec un mix local/cloud)

#### B3. Modifier le workflow pour utiliser blockRef dynamique
Dans `maestro-assistant-workflow.block.json`, changer le step `execute-agent` :
```json
{
  "id": "execute-agent",
  "blockRef": "{{_activeAgent}}",
  "inputs": {
    "message": "{{message}}",
    "repoPath": "{{repoPath}}",
    "conversationHistory": "{{_nodeResult_load-history}}"
  }
}
```
Ajouter `_activeAgent: "system:maestro-assistant"` comme variable par defaut dans le session template.

#### B4. Ajouter commande `/agent` dans le TUI
1. Dans `TaskInputBar.ts`, ajouter `/agent <block-id>` qui set `_activeAgent` via API
   - `/agent compact` → `_activeAgent = "system:maestro-assistant-compact"`
   - `/agent default` ou `/agent` sans arg → `_activeAgent = "system:maestro-assistant"`
   - `/agent my-custom-agent` → `_activeAgent = "my-custom-agent"` (block custom de l'utilisateur)
   - `/agent` (sans arg) → afficher l'agent actif
2. Pas de mapping hardcode — le block-id est passe directement (avec prefix `system:maestro-assistant-` comme shortcut si pas de `:`)
3. Afficher confirmation + agent actif dans le conversation log
4. Afficher l'agent actif dans le status bar de l'AgentPanel

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Modifier — `ResolveTemplate()` sur blockRef (~ligne 2108) |
| `content/system/blocks/system/maestro-assistant-compact/maestro-assistant-compact.agent.block.json` | CREER — agent compact (prompt simplifie, pour modeles legers) |
| `content/system/blocks/workflows/maestro-assistant-workflow.block.json` | Modifier — blockRef dynamique `{{_activeAgent}}` |
| `content/system/templates/sessions/maestro-assistant.session.json` | Modifier — ajouter default `_activeAgent` variable |
| `packages/maestro-code/components/TaskInputBar.ts` | Modifier — ajouter /agent command |
| `packages/maestro-code/components/AgentPanel.ts` | Modifier — afficher agent actif dans le status |

### Verification
```bash
# Commande 1 : verifier block cree
cat content/system/blocks/system/maestro-assistant-compact/maestro-assistant-compact.agent.block.json | head -20
# Resultat attendu : JSON valide avec blockType agent

# Commande 2 : verifier workflow modifie
cat content/system/blocks/workflows/maestro-assistant-workflow.block.json | grep _activeAgent
# Resultat attendu : blockRef utilise {{_activeAgent}}

# Commande 3 : type check
cd packages/maestro-code && npx tsc --noEmit
# Resultat attendu : pas d'erreurs

# Commande 4 : tests
cd packages/maestro-code && npm test
# Resultat attendu : tous les tests passent

# Commande 5 : test reel (si services demarres)
# Lancer maestro-code en mode real, envoyer /model local, puis un message
# Resultat attendu : le workflow prend la branche local
```

### Anti-patterns
- Ne PAS nommer les agents d'apres leur modele — nommer d'apres la capacite/purpose (compact, specialized, etc.)
- Ne PAS presumer local vs cloud — un agent peut mixer les deux dans ses config.nodes
- Ne PAS simplifier le system prompt au point qu'il soit inutile — garder les fonctions de base (repondre, expliquer)
- Ne PAS dupliquer le workflow entier — seul le blockRef du step execute-agent devient dynamique
- Ne PAS ajouter de validation stricte sur `_activeAgent` — si le block n'existe pas, le executor remontera une erreur claire

### Checkpoint
```markdown
## 48-B : Assistant Local Gratuit + Dynamic blockRef
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**ResolveTemplate sur blockRef** : ajoute dans EntryPointExecutor (oui/non)
**Agent variant compact** : cree (oui/non)
**Workflow blockRef dynamique** : modifie (oui/non)
**Default _activeAgent** : ajoute dans session template (oui/non)
**Commande /agent** : implementee (oui/non)
**tsc --noEmit** : PASS/FAIL (backend + maestro-code)
**npm test** : X/Y tests pass
**dotnet build** : PASS/FAIL
**Test reel** : [resultat du test avec agent compact, si possible]
```

---

## 48-C : Diagnostic Provider Claude Code CLI

### Lecture obligatoire
- `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` — config ClaudeCode provider
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — comment le model est passe au LLM gateway
- `apps/backend/src/Maestro.Infrastructure/LLM/LLMProviderGateway.cs` — comment la requete est envoyee

### Ce que cette sous-phase fait
1. **Test direct LLM Provider** :
   ```bash
   curl -X POST http://localhost:5010/api/v1/llm/complete \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Say hello"}],"maxTokens":100}'
   ```
   Si timeout → bug dans LLM-Provider → ClaudeCode provider chain
   Si OK → bug dans AgentBlockExecutor request construction

2. **Test Claude Code CLI direct** :
   ```bash
   claude --print "Say hello"
   ```
   Si OK → LLM-Provider ClaudeCode provider misconfigure l'appel CLI

3. **Comparaison avec local model** :
   Si 48-B est fait et le Python server tourne, envoyer `/model local` puis un message.
   Si reponse → pipeline OK, probleme isole au provider ClaudeCode.

4. **Documenter les resultats** dans checkpoint.md avec les outputs exacts

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-48/checkpoint.md` | Creer — resultats du diagnostic |

### Verification
```bash
# Les commandes de test SONT la verification pour cette sous-phase
# Documenter chaque output dans le checkpoint
```

### Anti-patterns
- Ne PAS modifier le code du provider sans avoir diagnostique — comprendre d'abord
- Ne PAS supposer que le bug est X sans avoir teste — chaque niveau doit etre verifie independamment
- Ne PAS ignorer les logs du LLM Provider — verifier `llm-provider/dotnet/src/LLMProvider.Web/logs/`

### Checkpoint
```markdown
## 48-C : Diagnostic Provider Claude Code CLI
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**curl LLM Provider** : [timeout/success + response time]
**claude --print** : [success/fail + response]
**Local model test** : [success/fail + response]
**Diagnostic** : [conclusion — ou est le bug]
**Action requise** : [description du fix necessaire, si identifie]
```

---

## Definition of Done

- [ ] mock-response.json supprime
- [ ] Spaces affiche les sessions (pas 0)
- [ ] Sidecar demarre sans erreur __dirname
- [ ] Steps echoues montrent ✗
- [ ] ResolveTemplate sur blockRef dans EntryPointExecutor
- [ ] Agent variant compact cree (maestro-assistant-compact)
- [ ] blockRef dynamique {{_activeAgent}} dans workflow
- [ ] Default _activeAgent dans session template
- [ ] Commande /agent implementee
- [ ] Diagnostic provider Claude Code CLI documente
- [ ] `tsc --noEmit` passe pour maestro-code et sidecar
- [ ] Tous les tests passent

## NOT in scope
- Refactoring du provider Claude Code CLI (sera fait apres diagnostic)
- Onboarding/getting-started hints (Phase future)
- Bulk session cleanup (Phase future)
- Model deduplication sur la page Models (cosmetic)
- Streaming/progress pour Execute Agent (necessite SignalR changes — Phase future)

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-48/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 48: bug fixes dogfooding + dynamic blockRef + agent variants"
- Ajouter : "Dynamic blockRef: ResolveTemplate on blockRef in EntryPointExecutor enables {{variable}} in workflow nodes"
- Ajouter : "maestro-assistant-compact block at content/system/blocks/system/maestro-assistant-compact/"
- Ajouter : "/agent command for switching between agent variants"
- Mettre a jour : Current Project State avec Phase 48
