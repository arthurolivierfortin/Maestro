# Phase 55 : Block Dependency Resolution

**Statut** : COMPLETE
**Prerequis** : Phase 54 COMPLETE
**Objectif** : Infrastructure fondamentale pour la resolution, validation et visualisation de l'arbre de dependances des blocks multi-noeud.
**Duree estimee** : 2 jours

---

## Contexte — Pourquoi maintenant

L'arbre de dependances est une fondation utilisee **partout** dans Maestro :

| Fonctionnalite | Besoin |
|---|---|
| **Catalog** | "Ce block utilise 3 sous-blocks et 2 modeles" |
| **Publication** | "Pour installer ce block, il faut aussi installer X, Y, Z" |
| **/adapt** | "Quels modeles sont utilises dans cet arbre? Peut-on les substituer?" |
| **Setup** | "Votre provider supporte 2/3 modeles requis par ce block" |
| **Suppression** | "Ce block est utilise par 3 autres — etes-vous sur?" |
| **Propagation des couts** | "Le cout total = somme des couts de tous les sous-blocs" |
| **Validation pre-execution** | "Block X reference block Y qui n'existe pas" |
| **Execution tree** | Visualiser la structure AVANT execution, pas seulement pendant |

Actuellement, les dependances sont **implicites** dans `config.nodes`. Il n'y a aucun service backend pour les extraire. L'API `GET /api/blocks/{id}/children` existe mais est incomplete (ne gere pas while/conditional/for-each). Le seul code complet est `extractManifest()` dans `adapt-optimize.ts` (CLI), mais il n'est pas expose comme service reutilisable.

**Phase 56 (Metrics Pipeline)** en depend : la propagation des couts multi-modele necessite de connaitre l'arbre complet pour accumuler correctement.

---

## Etat actuel — Ce qui existe

### 1. `GET /api/blocks/{id}/children` (BlocksController.cs, lignes 225-319)
- Walk de `config.nodes` au premier niveau
- Resout les `blockRef` via `_blockDiscovery.GetByIdAsync()`
- Recursif si `recursive=true` et block non-atomic
- **Manques** : ne gere PAS `while`, `conditional` (then/else), `for-each`, nested `nodes`
- **Manques** : n'extrait PAS `config.model` des nodes
- **DTO** : `BlockChildInfo` (lignes 727-738) — NodeId, NodeName, BlockRef, NodeType, ResolvedBlock*, IsAtomic, Children

### 2. `extractManifest()` (adapt-optimize.ts, lignes 143-245)
- Walk recursif complet avec detection de cycles (`visited` Set)
- Gere tous les niveaux d'imbrication : `nodes`, `while`, `conditional` (then/else), `for-each`
- Extrait `config.model` ET `config.planningModel` au niveau block et node
- **DTO** : `BlockManifest` — blockId, blockType, model, planningModel, childBlocks[]
- **Probleme** : CLI seulement, pas expose comme API backend

### 3. `flattenModels()` + `collectModelBlocks()` (adapt-optimize.ts, lignes 250-286)
- Aplatit l'arbre en `model → [blockIds]`
- Collecte les blocks feuilles avec modeles

### 4. `BlockRefHandler` (lignes 40-119)
- Resolution runtime des blockRef
- `_blockDiscovery.GetByIdAsync()` — crash si block introuvable (InvalidOperationException)
- **Aucune validation pre-execution** — l'erreur arrive seulement quand on atteint le node

---

## Decisions architecturales

### 1. Service backend, pas CLI
Le walk de l'arbre doit etre dans `Application/` ou `Infrastructure/`, pas dans le CLI. Le CLI, le TUI, l'API et le backend interne doivent tous pouvoir appeler la meme logique.

### 2. Enrichir, pas remplacer
L'endpoint existant `GET /api/blocks/{id}/children` sera enrichi plutot que d'en creer un nouveau. On ajoute les champs modele et la gestion du deep nesting. Un nouvel endpoint `/manifest` fournit la vue aplatie.

### 3. Validation = service separe
La validation pre-execution (toutes les dependances existent-elles?) est un service distinct de l'extraction. L'extraction donne l'arbre. La validation le verifie.

### 4. Pas de champ `dependencies` dans block.schema.json
Les dependances restent implicites dans `config.nodes`. Ajouter un champ explicite creerait une duplication source d'erreur. L'extraction automatique est la source de verite.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 55-A | IBlockDependencyService + API endpoints | 1 jour |
| 55-B | Validation pre-execution | 0.25 jour |
| 55-C | SDK + CLI + refactor adapt-optimize | 0.5 jour |
| 55-T | Tests (unitaires backend + integration API + TypeScript) | 0.5 jour |

Chaque sous-phase a son propre document detaille.

---

## Resume des modifications par fichier

### Backend (C#)
| Fichier | Modification | Sous-phase |
|---------|-------------|------------|
| `Application/Interfaces/IBlockDependencyService.cs` | **NOUVEAU** — interface | 55-A |
| `Application/DTOs/BlockManifestDtos.cs` | **NOUVEAU** — BlockManifest, DependencyValidationResult, MissingDependency | 55-A |
| `Infrastructure/BlockStore/BlockDependencyService.cs` | **NOUVEAU** — implementation avec cache | 55-A |
| `Api/Controllers/BlocksController.cs` | Enrichir children + nouveaux endpoints manifest | 55-A |
| `Api/Program.cs` | Enregistrer IBlockDependencyService | 55-A |
| `Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Message d'erreur enrichi | 55-B |
| `Infrastructure/Sessions/EntryPointExecutor.cs` | Validation pre-execution (warning) | 55-B |

### SDK/CLI (TypeScript)
| Fichier | Modification | Sous-phase |
|---------|-------------|------------|
| `packages/maestro-client/src/types.ts` | Ajouter BlockManifest, ModelRequirement, DependencyValidationResult | 55-C |
| `packages/maestro-client/src/domains/blocks.ts` | Ajouter manifest(), manifestModels(), validate() | 55-C |
| `packages/maestro-cli/cli.ts` | Ajouter commande `block deps` | 55-C |
| `packages/maestro-cli/adapt-optimize.ts` | Refactorer — utiliser SDK au lieu de code local | 55-C |

---

## Verification globale Phase 55

```bash
# Backend
cd apps/backend && dotnet build              # 0 errors
cd apps/backend && dotnet test               # tous tests passent

# TypeScript
cd packages/maestro-client && npx tsc --noEmit
cd packages/maestro-cli && npx tsc --noEmit

# Fonctionnel (services demarres)
curl http://localhost:5000/api/blocks/maestro-assistant/manifest | jq '.children | length'
curl http://localhost:5000/api/blocks/maestro-assistant/manifest/models | jq '.'
curl http://localhost:5000/api/blocks/maestro-assistant/manifest/validate | jq '.isValid'
node packages/maestro-cli/index.js block deps maestro-assistant
```

---

## Definition of Done

- [ ] `IBlockDependencyService` cree avec GetManifestAsync, GetRequiredModelsAsync, ValidateAsync, GetDependentsAsync
- [ ] Walk recursif complet : config.nodes, while, conditional (then/else), for-each, nested nodes
- [ ] Detection de cycles (visited set)
- [ ] `GET /api/blocks/{id}/manifest` retourne l'arbre complet avec modeles
- [ ] `GET /api/blocks/{id}/manifest/models` retourne la carte modeles aplatie
- [ ] `GET /api/blocks/{id}/manifest/validate` retourne les dependances manquantes
- [ ] `BlockChildInfo` enrichi avec Model et PlanningModel
- [ ] Validation pre-execution dans EntryPointExecutor (warning, pas bloquant)
- [ ] Message d'erreur enrichi dans BlockRefHandler
- [ ] SDK `client.blocks.manifest()`, `.manifestModels()`, `.validate()`
- [ ] CLI `maestro block deps <id>` avec affichage arbre + modeles + validation
- [ ] `adapt-optimize.ts` refactore pour utiliser le SDK
- [ ] `dotnet build` : 0 errors
- [ ] `dotnet test` : tous tests passent
- [ ] `npx tsc --noEmit` : 0 errors sur maestro-client et maestro-cli

### NOT in scope
- Visualisation de l'arbre dans le TUI (sera fait quand le Catalog affiche les details)
- Edition des dependances (les dependances sont gerees par config.nodes, pas editable via API)
- Resolution de dependances a la publication (sera un check dans le workflow de publish)
- Reverse dependency index persistent (le scan a la demande suffit pour V1)
