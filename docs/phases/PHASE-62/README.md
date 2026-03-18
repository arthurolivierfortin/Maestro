# Phase 62 : Container Isolation — Solidification du modele Session/Workspace

**Statut** : EN COURS
**Prerequis** : Phase 61 COMPLETE
**Objectif** : Solidifier la logique d'arbre Session/Workspace qui est la fondation de Maestro. Permissions, couts, metriques — tout passe par cet arbre. Le system prompt des agents doit refleter les permissions de la session. Si le bottleneck est fragile, tout ce qui est construit dessus (agents, contract tests, sandboxing) est fragile.
**Duree estimee** : 3-4 jours
**Raison de l'insertion** : Decouvert pendant Phase 63-C (ex 62-C) que ToolDispatcherBlockExecutor n'enforçait aucune permission — un agent pouvait appeler n'importe quel block. Bug de securite fondamental. De plus, le system prompt des agents liste des tools en dur, ce qui est incoherent avec le modele container.

---

## Contexte — Pourquoi cette phase est critique

### Le modele container

Chaque session/workspace est un container isole :
```
Workspace (permissions ceiling)
  └─ Session (≤ parent)
    └─ Child Session (≤ parent)      ← TOUJOURS une child session pour un agent
      └─ Agent = process inside the container
```

L'agent ne fait pas directement les appels — c'est le block qui appelle le backend. Le backend recoit le session ID et filtre. C'est LE point d'enforcement unique.

**Un agent est TOUJOURS dans une child session**, meme s'il a toutes les permissions du parent. La child session fournit :
- **Isolation des variables** : l'etat interne de l'agent ne pollue pas le workflow parent
- **Couts par agent** : on sait exactement combien chaque agent a coute
- **Lifecycle propre** : l'agent peut etre annule, en erreur, termine — independamment du workflow
- **Possibilite future de restriction** : on peut restreindre sans changer l'architecture

### Problemes decouverts

1. **ToolDispatcherBlockExecutor n'enforçait aucune permission** — un agent pouvait appeler n'importe quel block du catalogue. Fix initial applique (CheckToolPermission), mais les tests sont incomplets et la logique doit etre solidifiee.

2. **Pas de test E2E Workspace → Session → Child Session → Agent tool call** — la propagation/intersection des permissions n'est jamais testee en profondeur.

3. **Le system prompt des agents est incoherent avec les permissions** — le system prompt liste des tools en dur (file-read, file-write, shell-execute, etc.) dans le block.json. Si la session retire `shell-execute`, l'agent le voit quand meme dans son prompt, l'appelle, se fait refuser, et gaspille des tokens a reessayer. Avec des modeles petits, il peut ne jamais comprendre et loop. C'est comme monter un container Docker avec un fichier de config qui reference des binaires absents du container.

4. **Les couts utilisent la meme logique d'arbre** — le parent accumule les couts de ses enfants. Cette logique doit utiliser le meme pattern que les permissions.

5. **La gestion des permissions par l'utilisateur est inexistante** — pas d'API ni de CLI pour gerer les permissions facilement.

### Impact sur la qualite des agents

Le bug du tool dispatch recursif (Phase 63-C) — ou un agent appelait `json-validator` en boucle — etait cause par l'absence d'enforcement des permissions. L'agent accedait a un tool reel non-mappe au lieu de recevoir une erreur. Si cette fondation n'est pas solide, les memes problemes resurgiront avec chaque nouvel agent.

De plus, si on cree des agents en Phase 63 avec des tools hardcodes dans le system prompt, il faudra tous les refactorer quand on rendra le prompt dynamique. Mieux vaut poser la fondation maintenant.

---

## Decisions architecturales

### 1. Agent = toujours une child session

Un agent est TOUJOURS execute dans une child session, meme avec `AllowedBlocks = ["*"]`. L'isolation est la pour les variables, les couts et le lifecycle — pas seulement les permissions.

### 2. L'injection des tools = infrastructure, pas un block

L'assemblage du system prompt (injection des tools disponibles) se fait dans `AgentBlockExecutor.PrepareExecutionAsync` (C# infrastructure). Ce n'est PAS un block dans config.nodes.

**Pourquoi** :
- C'est du setup universel — chaque agent en a besoin
- L'utilisateur ne devrait pas avoir a ajouter un node `tool-schema-resolver` dans chaque agent
- C'est au meme niveau que "creer la conversation" et "injecter l'historique" — de la plomberie
- Les block.json des tools fournissent le contenu (descriptions, schemas) — l'infrastructure le lit

**Analogie Docker** : le montage des volumes est de l'infrastructure Docker, pas une instruction dans l'application. L'application voit juste les fichiers montes.

### 3. Tous les agents ont le system prompt dynamique

Ce n'est pas une feature optionnelle. C'est comment les agents fonctionnent. `AgentBlockExecutor` est le point d'entree de TOUS les agents, donc tous beneficient automatiquement de l'injection dynamique.

### 4. La black box est renforcee

De l'exterieur : un agent est `prompt → response`. Le caller ne sait pas ce qui se passe a l'interieur.

Avec le system prompt dynamique, la separation est encore plus nette :
- Le **block.json** definit le comportement (role, instructions, format de reponse)
- La **session** definit l'environnement (tools disponibles, couts, acces fichiers)
- Le **runtime** combine les deux

C'est exactement Docker : image (comportement) + config container (environnement) = container qui tourne. Et ca ouvre la porte a la portabilite IDE en V2 sans rien changer — on change juste la source des tools.

---

## Architecture cible

### Principe : le backend filtre par session ID

```
Agent → response-parser → tool-dispatcher
                              ↓
                    CheckToolPermission(context, toolId)
                         ↓                    ↓
                    Layer 1:              Layer 2:
                    BlockPermission       AllowedBlocks
                    rules (deny/allow)    whitelist (ceiling)
                         ↓                    ↓
                    First match wins      Must be in list
                         ↓                    ↓
                    If denied → error     If not in list → error
                    to agent              to agent
                         ↓
                    Tool mapping (_toolMapping)
                         ↓
                    Block discovery → execute
```

### Principe : fail-closed

Si les permissions ne sont pas dans le context d'execution, le tool est REFUSE. Pas de fallthrough silencieux. Les sessions ont un default-all (`ContextPermissions.Full` avec `AllowedBlocks = ["*"]`), donc ce n'est jamais vide sauf bug.

### Principe : intersection pour les enfants

```
Parent: AllowedBlocks = ["*"]
Child:  AllowedBlocks = ["file-read", "file-write"]
Effective: ["file-read", "file-write"]  (intersection)

Child cannot ESCALATE — the intersection guarantees it.
```

### Principe : le prompt reflète le container

Le system prompt de l'agent ne liste QUE les tools disponibles dans sa session. L'injection est faite par l'infrastructure (`AgentBlockExecutor`), pas par un block.

```
AgentBlockExecutor.PrepareExecutionAsync (infrastructure C#)
  │
  ├─ 1. Lit system-prompt.md du block (contenu statique : role, instructions, format)
  ├─ 2. Lit AllowedBlocks de la session (permissions du container)
  ├─ 3. Pour chaque tool autorise :
  │     └─ Charge sa description + schema depuis son block.json (via IBlockDiscoveryService)
  ├─ 4. Genere la section "## Available Tools" avec les JSON schemas
  ├─ 5. Remplace {{available_tools}} dans le system prompt
  └─ 6. Cree la conversation avec le prompt assemble

L'utilisateur ecrit :              L'agent recoit :
┌──────────────────┐              ┌──────────────────┐
│ # Role           │              │ # Role           │
│ You are a ...    │              │ You are a ...    │
│                  │              │                  │
│ ## Available Tools│             │ ## Available Tools│
│ {{available_tools}}│ ────────►  │ ### file-read    │
│                  │              │ {"name": ...}    │
│ ## Response Format│             │ ### file-write   │
│ Use THINK/ACTION │              │ {"name": ...}    │
└──────────────────┘              │                  │
                                  │ ## Response Format│
                                  │ Use THINK/ACTION │
                                  └──────────────────┘
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 62-A | Permission enforcement dans ToolDispatcherBlockExecutor (fail-closed) | 0.5 jour |
| 62-B | Tests E2E de l'arbre Workspace → Session → Child → Agent | 1 jour |
| 62-C | System prompt dynamique (tools injectes par la session via AgentBlockExecutor) | 1-1.5 jours |
| 62-D | API et CLI de gestion des permissions | 0.5-1 jour |
| 62-E | TUI FocusProvider + visibilite permissions/arbre/couts | 1-1.5 jours |
| 62-T | Tests + validation | 0.5 jour |

**Ordre d'execution** : A → B → C → D → T (puis E en discussion)

62-A et 62-B solidifient l'enforcement. 62-C rend les agents coherents avec le container. 62-D expose la gestion a l'utilisateur.

---

## 62-A : Permission enforcement (EN COURS)

### Ce qui est fait
- `CheckToolPermission()` dans ToolDispatcherBlockExecutor — 2 couches (BlockPermission rules + AllowedBlocks whitelist)
- `BuildExecutionContext` propage `_permissions_allowedBlocks` et `_permissions_blockRules`
- Fail-closed : permissions absentes → tool refuse
- Tests unitaires : EN COURS (besoin de finaliser apres correction fail-closed)

### Ce qui reste
- Finaliser les tests (corriger ceux affectes par le changement fail-closed)
- Verifier que les sessions existantes ne sont pas cassees (ContextPermissions.Full = AllowedBlocks = ["*"])
- Verifier le ContractTestRunner : doit definir AllowedBlocks dans les sessions de test

---

## 62-B : Tests E2E de l'arbre (A FAIRE)

### Scenarios a tester

1. **Workspace → Session → tool call** : permissions du workspace limitent la session
2. **Session → Child Session → tool call** : intersection des permissions
3. **Child ne peut pas escalader** : meme si child demande plus, effective = intersection
4. **Couts remontent dans l'arbre** : child accumule → parent accumule le child
5. **_toolMapping + permissions** : mapping redirige, permissions filtrent
6. **ContractTestRunner** : session de test avec permissions restreintes (seuls les tools mappes)
7. **Agent toujours en child session** : meme avec AllowedBlocks = ["*"], l'agent est isole

---

## 62-C : System prompt dynamique (A FAIRE)

### Probleme actuel

Les system prompts des agents listent les tools en dur dans `system-prompt.md` :

```markdown
## Available Tools
### file-read
{"name": "file-read", "description": "Read a file", "parameters": {...}}
### file-write
{"name": "file-write", "description": "Write a file", "parameters": {...}}
### shell-execute
{"name": "shell-execute", "description": "Execute a command", "parameters": {...}}
```

C'est statique. Si la session retire `shell-execute` des permissions, l'agent le voit quand meme, l'appelle, se fait refuser, gaspille des tokens.

### Solution

L'injection des tools est de l'infrastructure (`AgentBlockExecutor`), pas un block.

#### 1. Retirer la section tools du system prompt statique

Dans chaque `system-prompt.md` d'agent, remplacer la section "Available Tools" (avec les JSON schemas) par un marqueur :

```markdown
## Available Tools

{{available_tools}}
```

Le reste du system prompt (role, instructions, format de reponse, exemples) reste statique dans le fichier.

#### 2. AgentBlockExecutor.PrepareExecutionAsync assemble le prompt

Quand l'agent demarre, dans `PrepareExecutionAsync` (C# infrastructure, PAS un block) :

1. Charger le system prompt depuis `system-prompt.md`
2. Lire les `AllowedBlocks` de la session (depuis le context d'execution)
3. Pour chaque tool autorise, charger sa description depuis son `block.json` via `IBlockDiscoveryService`
4. Generer la section "Available Tools" avec les JSON schemas
5. Remplacer `{{available_tools}}` dans le system prompt
6. Creer la conversation avec le system prompt assemble

#### 3. Les block.json des tools contiennent deja les schemas

Chaque tool block (`file-read.tool.block.json`, etc.) a deja un champ `description` et `config.inputs` qui decrit ses parametres. On n'a pas besoin de dupliquer — on lit le block.json et on genere le schema.

#### 4. Aucun changement pour l'utilisateur qui cree des blocks

L'utilisateur qui cree un agent via block-forge n'a PAS besoin de lister les tools. Il ecrit son system prompt avec `{{available_tools}}` et les tools sont injectes automatiquement. C'est plus simple qu'avant, pas plus complexe.

### Ce qui change

| Avant | Apres |
|-------|-------|
| Tools listes en dur dans system-prompt.md | `{{available_tools}}` dans system-prompt.md |
| Agent voit tous les tools, meme ceux interdits | Agent ne voit que les tools de sa session |
| Modifier les tools = modifier le system prompt | Modifier les tools = modifier les permissions de la session |
| Chaque agent duplique les memes schemas | Schemas charges depuis les block.json des tools |
| L'agent est lie a ses tools | L'agent est portable (memes instructions, tools differents) |

### Verification 62-C

- [ ] `{{available_tools}}` resolu par AgentBlockExecutor.PrepareExecutionAsync
- [ ] Tools generes depuis les block.json (pas dupliques)
- [ ] Seuls les tools autorises par la session sont injectes
- [ ] Les agents existants fonctionnent (migration des 19 system prompts)
- [ ] Contract tests : l'agent ne voit que les tools mappes
- [ ] Agent avec AllowedBlocks=["*"] voit tous les tools (comportement par defaut)
- [ ] Agent avec AllowedBlocks restreints ne voit que les tools autorises
- [ ] Tests unitaires pour l'assemblage du system prompt

---

## 62-D : API et CLI de gestion des permissions (A FAIRE)

### API

- `GET /api/sessions/{id}/permissions/effective` — permissions effectives (apres intersection parents)
- `PUT /api/sessions/{id}/permissions` — definir les AllowedBlocks
- `PUT /api/sessions/{id}/block-rules` — definir les regles BlockPermission (deny/allow/requires-approval)
- `GET /api/workspaces/{id}/tree` — arbre de sessions avec permissions et couts par niveau

### CLI

- `maestro session permissions <id>` — voir les permissions effectives
- `maestro session restrict <id> --allow file-read,file-write --deny shell-execute`
- `maestro workspace tree <id>` — voir l'arbre avec permissions et couts

---

## 62-E : TUI — FocusProvider + Visibilite (DECIDEE)

**Decision (2026-03-18)** : Rester sur Ink mais construire un `FocusProvider` (React Context) avec layers de priorite (modal > input > panel > page). Resout le probleme fondamental de focus management sans changer de framework. Alternatives evaluees et rejetees : web app locale, Electron/Tauri, Textual/Bubbletea, reduction de scope.

Points a implementer :
- FocusProvider + useManagedInput hook (~200-300 lignes)
- Migration incrementale de tous les useInput existants
- Page Spaces : arbre avec permissions et couts
- AgentPanel : permissions de l'agent en cours (lecture seule V1)

Voir `62-E-tui-visibility.md` pour les details complets.

---

## Definition of Done

- [ ] `CheckToolPermission` fonctionne en fail-closed
- [ ] Tests E2E : Workspace → Session → Child → Agent tool call
- [ ] Permissions propagees correctement (intersection parents)
- [ ] Child ne peut pas escalader les permissions
- [ ] Agent toujours en child session (meme avec toutes les permissions)
- [ ] Couts remontent dans l'arbre
- [ ] System prompt dynamique : `{{available_tools}}` resolu par AgentBlockExecutor (infrastructure)
- [ ] Injection des tools = infrastructure, pas un block dans config.nodes
- [ ] Tous les agents beneficient automatiquement (via AgentBlockExecutor)
- [ ] Agents existants migres (tools retires du system prompt statique, remplaces par marqueur)
- [ ] ContractTestRunner configure les permissions dans les sessions de test
- [ ] API de gestion des permissions (GET effective, PUT permissions, PUT block-rules)
- [ ] CLI : `maestro session permissions`, `maestro session restrict`
- [ ] Tous les tests passent, 0 regression
- [ ] `dotnet build` : 0 erreurs

### NOT in scope
- Migration complete du TUI vers un autre framework (Ink reste, FocusProvider ajouté en 62-E)
- Agents fonctionnels / creation de nouveaux agents (Phase 63)
- Portabilite IDE / tools fournis par un systeme externe (V2 — l'architecture le permet mais on ne l'implemente pas)
- /adapt workflow (Phase 64)
