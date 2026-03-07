# Phase 55-C : SDK + CLI + refactor adapt-optimize

**Statut** : A FAIRE
**Effort estime** : 0.5 jour
**Prerequis** : Phase 55-A COMPLETE

---

## Objectif

Exposer l'arbre de dependances dans le SDK TypeScript et le CLI. Refactorer `adapt-optimize.ts` pour utiliser le backend au lieu de la logique locale. L'utilisateur peut voir les dependances d'un block depuis la ligne de commande.

---

## Lecture obligatoire

- `packages/maestro-client/src/types.ts` — types existants du SDK. Les nouveaux types `BlockManifest`, `DependencyValidationResult` s'ajoutent ici.
- `packages/maestro-client/src/domains/blocks.ts` — domaine blocks existant. Les methodes `manifest()`, `manifestModels()`, `validate()` s'ajoutent ici.
- `packages/maestro-cli/cli.ts` — CLI existant. Reperer la section des commandes `block` pour ajouter `block deps`.
- `packages/maestro-cli/adapt-optimize.ts` (lignes 80-286) — les types et fonctions locaux a supprimer : `BlockManifest`, `FlatModelMap`, `extractManifest()`, `flattenModels()`, `collectModelBlocks()`.

---

## Ce que cette sous-phase fait

### Tache 1 : Types SDK

#### Fichier

`packages/maestro-client/src/types.ts`

#### Types a ajouter

```typescript
export interface BlockManifest {
  blockId: string;
  blockType: string;
  model: string | null;
  planningModel: string | null;
  isAtomic: boolean;
  children: BlockManifest[];
}

export interface ModelRequirement {
  model: string;
  blockIds: string[];
}

export interface MissingDependency {
  blockRef: string;
  referencedBy: string;
  nodeId: string;
}

export interface DependencyValidationResult {
  isValid: boolean;
  missingBlocks: MissingDependency[];
  circularReferences: string[];
}
```

---

### Tache 2 : Domaine blocks enrichi

#### Fichier

`packages/maestro-client/src/domains/blocks.ts`

#### Actions

Ajouter dans le domaine blocks existant :

```typescript
manifest: (id: string) =>
  http.get<BlockManifest>(`/api/blocks/${id}/manifest`),

manifestModels: (id: string) =>
  http.get<ModelRequirement[]>(`/api/blocks/${id}/manifest/models`),

validate: (id: string) =>
  http.get<DependencyValidationResult>(`/api/blocks/${id}/manifest/validate`),

dependents: (id: string) =>
  http.get<string[]>(`/api/blocks/${id}/dependents`),
```

---

### Tache 3 : CLI `maestro block deps`

#### Fichier

`packages/maestro-cli/cli.ts`

#### Commande

```
maestro block deps <blockId> [--json] [--models]
```

#### Affichage par defaut

```
Block: maestro-assistant (agent)
Model: claude-sonnet-4-6

Dependencies (12 blocks, 2 models):
  maestro-assistant (agent) -> claude-sonnet-4-6
  |-- response-parser (inference) -> claude-sonnet-4-6
  |-- tool-dispatcher (workflow)
  |   |-- session-create (tool)
  |   |-- session-invoke (tool)
  |   |-- workspace-manage (tool)
  |   +-- block-search (tool)
  |-- conversation-read (tool)
  |-- conversation-append (tool)
  +-- message-builder (tool)

Models required:
  claude-sonnet-4-6  -> 2 blocks (maestro-assistant, response-parser)

Validation: OK (all 12 blockRefs resolved)
```

#### Options

- `--json` : retourne le JSON brut du manifest
- `--models` : retourne seulement la carte modeles

#### Implementation

1. Appeler `client.blocks.manifest(blockId)` pour l'arbre
2. Appeler `client.blocks.manifestModels(blockId)` pour les modeles
3. Appeler `client.blocks.validate(blockId)` pour la validation
4. Formatter l'arbre avec indentation (`|--`, `+--` pour le dernier enfant)
5. Compter le nombre total de blocks et modeles uniques

---

### Tache 4 : Refactorer adapt-optimize.ts

#### Fichier

`packages/maestro-cli/adapt-optimize.ts`

#### Actions

1. **Supprimer** les types locaux (lignes 80-90) :
   - `BlockManifest` (local) → utiliser `import { BlockManifest } from '@maestro/client'`
   - `FlatModelMap` → utiliser `ModelRequirement[]` du SDK

2. **Supprimer** les fonctions locales (lignes 143-286) :
   - `extractManifest()` → remplacer par `client.blocks.manifest(blockId)`
   - `flattenModels()` → remplacer par `client.blocks.manifestModels(blockId)`
   - `collectModelBlocks()` → deriver de `ModelRequirement[]`

3. **Adapter** les appelants pour utiliser les nouvelles signatures

4. **Verifier** que `AdaptClient` n'a plus besoin de `getBlock()` pour le manifest (il en a peut-etre encore besoin pour d'autres operations)

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-client/src/types.ts` | Ajouter BlockManifest, ModelRequirement, MissingDependency, DependencyValidationResult |
| `packages/maestro-client/src/domains/blocks.ts` | Ajouter manifest(), manifestModels(), validate(), dependents() |
| `packages/maestro-cli/cli.ts` | Ajouter commande `block deps` avec options --json et --models |
| `packages/maestro-cli/adapt-optimize.ts` | Supprimer extractManifest/flattenModels/collectModelBlocks locaux, utiliser SDK |

---

## Verification

```bash
# TypeScript compile
cd packages/maestro-client && npx tsc --noEmit  # 0 errors
cd packages/maestro-cli && npx tsc --noEmit      # 0 errors

# CLI fonctionnel (services demarres)
node packages/maestro-cli/index.js block deps maestro-assistant
# Attendu : arbre avec blocks et modeles

node packages/maestro-cli/index.js block deps maestro-assistant --json | jq '.children | length'
# Attendu : nombre > 0

node packages/maestro-cli/index.js block deps maestro-assistant --models
# Attendu : liste de modeles avec blockIds
```

---

## Anti-patterns

- Ne PAS garder `extractManifest()` local en plus du SDK — single source of truth. Si les deux existent, ils vont diverger
- Ne PAS ajouter de logique de walk dans le CLI — tout le walk est cote backend. Le CLI ne fait que formatter l'affichage
- Ne PAS utiliser `console.log` pour le formatage de l'arbre — utiliser les fonctions de formatage du CLI existant (chalk/colors si disponible)
- Ne PAS oublier de tester `adapt-optimize.ts` apres le refactoring — `npx tsc --noEmit` ne suffit pas, verifier que les imports sont corrects

---

## Checkpoint

```markdown
## 55-C : SDK + CLI + refactor
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**SDK types** : BlockManifest, ModelRequirement, DependencyValidationResult ajoutes
**SDK methods** : manifest(), manifestModels(), validate(), dependents()
**CLI** : `maestro block deps` fonctionne avec --json et --models
**adapt-optimize.ts** : extractManifest/flattenModels supprimes, SDK utilise
**tsc maestro-client** : [0 errors / N errors]
**tsc maestro-cli** : [0 errors / N errors]
**CLI output** : [copier output de `block deps maestro-assistant`]
```

---

## Definition of Done 55-C + Phase 55 Complete

Quand 55-A + 55-B + 55-C sont termines :

- [ ] Le backend extrait l'arbre de dependances complet via `IBlockDependencyService`
- [ ] Walk recursif gere : config.nodes, while, conditional (then/else), for-each, nested nodes
- [ ] L'API expose manifest, models, validate, dependents
- [ ] La validation pre-execution avertit des dependances manquantes (sans bloquer)
- [ ] Le SDK TypeScript expose les 4 methodes
- [ ] Le CLI `maestro block deps` affiche l'arbre, les modeles, et la validation
- [ ] `adapt-optimize.ts` utilise le SDK au lieu de code local (single source of truth)
- [ ] `dotnet build` + `dotnet test` : 0 errors
- [ ] `npx tsc --noEmit` : 0 errors sur maestro-client et maestro-cli
