# Phase 53-C : NodeExecutionEngine Handler Decomposition

**Statut** : COMPLETE
**Prerequis** : Phase 53-B COMPLETE (checkpoint.md verifie)
**Objectif** : Extraire les types de noeuds (for-each, blockRef, set-variable) dans des INodeHandler independants pour respecter Open/Closed et permettre l'ajout de nouveaux types sans modifier l'engine.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-53-C/checkpoint.md`** apres chaque sous-phase
4. Ne PAS modifier le comportement observable — pure extraction structurelle
5. Ne PAS ajouter de nouvelles fonctionnalites — uniquement deplacer du code existant
6. Tous les tests existants doivent passer sans modification

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 53-C-1 | Interface INodeHandler + NodeExecutionContext + INodeExecutionCallback | 30 min |
| 53-C-2 | Extraction des 3 handlers (ForEach, BlockRef, SetVariable) | 2h |
| 53-C-3 | Refactoring NodeExecutionEngine vers dispatch par handlers | 1h |
| 53-C-4 | DI registration + verification | 30 min |

---

## 53-C-1 : Interface INodeHandler + contexte partage

### Lecture obligatoire
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` — comprendre les types de noeuds et leurs signatures
- `docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md` — comprendre la hierarchie d'execution

### Ce que cette sous-phase fait
1. Creer `INodeHandler` interface dans `Maestro.Application/Interfaces/`
2. Creer `NodeExecutionContext` record pour encapsuler le contexte partage (session, workflowConfig, workingDir, workflowId, activePhaseId, displayTree)
3. Creer `INodeExecutionCallback` interface pour le callback recursif (ExecuteConfigNodesAsync, ExecuteBlockRefAsync)

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Application/Interfaces/INodeHandler.cs` | Creer — interface + context + callback |

### Verification
```bash
# Build doit passer (interface seule, pas encore utilisee)
cd C:\Meastro\apps\backend && dotnet build --no-restore
# Resultat attendu : 0 errors
```

### Anti-patterns
- Ne PAS mettre les interfaces dans Infrastructure — elles appartiennent a Application (Clean Architecture)
- Ne PAS inclure de dependances sur des classes concretes dans le contexte — uniquement des types du domaine

### Checkpoint
```markdown
## 53-C-1 : Interface INodeHandler
**Statut** : DONE
**Date** : 2026-03-06
**Fichier cree** : INodeHandler.cs (85 lignes)
**Build** : 0 errors
```

---

## 53-C-2 : Extraction des 3 handlers

### Lecture obligatoire
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` — localiser ExecuteForEachNodeAsync, ExecuteBlockRefAsync, ExecuteSetVariableNode
- `apps/backend/src/Maestro.Application/Interfaces/INodeHandler.cs` — interface creee en 53-C-1

### Ce que cette sous-phase fait
1. Extraire `ForEachNodeHandler` — logique for-each + resolution de source + resume checkpoint
2. Extraire `BlockRefHandler` — dispatch blockRef via BlockExecutorRegistry + build inputs/context
3. Extraire `SetVariableNodeHandler` — stockage de variables + parsing JSON + mode append

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/ForEachNodeHandler.cs` | Creer — 503 lignes extraites de NodeExecutionEngine |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Creer — 273 lignes extraites de NodeExecutionEngine |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/SetVariableNodeHandler.cs` | Creer — 183 lignes extraites de NodeExecutionEngine |

### Verification
```bash
# Build (handlers existent mais pas encore branches)
cd C:\Meastro\apps\backend && dotnet build --no-restore
# Resultat attendu : 0 errors
```

### Anti-patterns
- Ne PAS dupliquer du code — deplacer, pas copier. Les methodes originales dans l'engine seront supprimees en 53-C-3
- Ne PAS changer la logique — copie exacte avec adaptation de signature uniquement

### Checkpoint
```markdown
## 53-C-2 : Extraction des 3 handlers
**Statut** : DONE
**Date** : 2026-03-06
**ForEachNodeHandler** : 503 lignes
**BlockRefHandler** : 273 lignes
**SetVariableNodeHandler** : 183 lignes
**Build** : 0 errors
```

---

## 53-C-3 : Refactoring NodeExecutionEngine vers dispatch par handlers

### Lecture obligatoire
- Les 3 handlers crees en 53-C-2
- `NodeExecutionEngine.cs` — identifier les methodes a supprimer et le point de dispatch

### Ce que cette sous-phase fait
1. Modifier le constructeur de NodeExecutionEngine pour accepter `IEnumerable<INodeHandler>`
2. Construire un dictionnaire `Dictionary<string?, INodeHandler>` (nodeType → handler)
3. Remplacer les appels directs (ExecuteForEachNodeAsync, ExecuteBlockRefAsync, ExecuteSetVariableNode) par dispatch via le dictionnaire
4. Supprimer les methodes extraites de l'engine
5. Implementer `INodeExecutionCallback` sur NodeExecutionEngine

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` | Modifier — nouveau constructeur, dispatch par handlers, suppression methodes extraites (1792 → 834 lignes) |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Modifier — cast vers INodeExecutionCallback pour ExecuteBlockRefAsync |

### Verification
```bash
# Build
cd C:\Meastro\apps\backend && dotnet build --no-restore
# Resultat attendu : 0 errors, 0 warnings

# Tests
cd C:\Meastro\apps\backend && dotnet test --no-restore
# Resultat attendu : 93/93 pass
```

### Anti-patterns
- Ne PAS garder les anciennes methodes comme fallback — supprimer completement
- Ne PAS exposer ExecuteBlockRefAsync comme methode publique — passer par INodeExecutionCallback

### Checkpoint
```markdown
## 53-C-3 : Refactoring engine
**Statut** : DONE
**Date** : 2026-03-06
**NodeExecutionEngine** : 1792 → 834 lignes (-53.5%)
**Build** : 0 errors, 0 warnings
**Tests** : 93/93 pass
```

---

## 53-C-4 : DI registration + verification finale

### Lecture obligatoire
- `apps/backend/src/Maestro.Api/Program.cs` — registration DI existante

### Ce que cette sous-phase fait
1. Enregistrer les 3 INodeHandler dans le container DI (scoped)
2. Mettre a jour la factory de NodeExecutionEngine pour injecter les handlers
3. Verification complete (build + tests + review)

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Api/Program.cs` | Modifier — ajouter registration des 3 handlers + mise a jour factory NodeExecutionEngine |

### Verification
```bash
# Build propre
cd C:\Meastro\apps\backend && dotnet build --no-restore
# Resultat attendu : 0 errors, 0 warnings

# Tests complets
cd C:\Meastro\apps\backend && dotnet test --no-restore
# Resultat attendu : 93/93 pass, 0 skip, 0 fail
```

### Anti-patterns
- Ne PAS utiliser AddSingleton pour les handlers — ils dependent de services scoped (repository, stateManager)
- Ne PAS resoudre BlockExecutorRegistry dans le constructeur du handler — lazy resolution via DI scope

### Checkpoint
```markdown
## 53-C-4 : DI + verification
**Statut** : DONE
**Date** : 2026-03-06
**Build** : 0 errors, 0 warnings
**Tests** : 93/93 pass
**DI** : 3 handlers registered (ForEach, BlockRef, SetVariable)
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-53-C/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 53-C: NodeExecutionEngine 834 lignes, INodeHandler pattern, 3 handlers extraits"
- Modifier : architecture.md avec details INodeHandler
- Modifier : backend-file-tree.md avec nouveau repertoire NodeHandlers/
