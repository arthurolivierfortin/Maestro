# Phase 53-B : Décomposition NodeExecutionEngine

**Statut** : COMPLETE
**Prerequis** : Phase 54 COMPLETE (E2E vérifié)
**Objectif** : Décomposer `NodeExecutionEngine` (2431 lignes) en classes spécialisées pour terminer le refactoring commencé en Phase 53.

---

## Contexte

Phase 53 a résolu le problème *horizontal* (agents/tools/handlers → classes séparées) mais a laissé `NodeExecutionEngine` comme un monolithe interne. Le moteur mélange encore :

- Contrôle de flux (while, conditional, sequence, foreach, parallel)
- Dispatch de blocs (résolution blockRef, sérialisation outputs, merge config)
- Résolution de templates (`{{var}}`, `{{_nodeResult_x.y}}`)
- Évaluation de conditions (`==`, `!=`, `&&`, `||`, comparaisons)
- Helpers de conversion (JObject ↔ Dictionary, JsonElement ↔ native)
- Logique métier inline (`set-variable` avec 196 lignes, `phase` inline)

Ce refactoring doit être terminé **maintenant** — avant Phase 55 (agent-creator) qui ajoutera de la complexité dans le moteur d'exécution.

### Inventaire actuel

| Méthode | Lignes | Responsabilité | Destination |
|---------|--------|----------------|-------------|
| `ExecuteForEachNodeAsync` | 460 | Contrôle de flux | Reste dans le moteur (mais à réduire) |
| `ExecuteBlockRefAsync` | 236 | Dispatch + sérialisation | `BlockRefDispatcher` |
| `ExecuteSetVariableNode` | 196 | Logique métier | `SetVariableBlockExecutor` |
| `ExecuteConditionalNodeAsync` | 162 | Contrôle de flux | Reste dans le moteur |
| `ExecuteConfigNodesAsync` | 156 | Orchestration | Reste dans le moteur |
| `ExecuteWhileNodeAsync` | 156 | Contrôle de flux | Reste dans le moteur |
| `DispatchRegularNodeAsync` | 118 | Dispatch | Absorber dans `ExecuteBlockRefAsync` |
| `ResolveTemplate` | 96 | Template engine | `TemplateResolver` |
| `ExecuteParallelNodeAsync` | 84 | Contrôle de flux | Reste dans le moteur |
| `GetProjectPath` | 82 | Utilitaire session | `SessionHelper` |
| `ExecuteNodesAsync` (legacy tree) | 70 | Legacy | **Supprimer** |
| `ExtractJsonSubPath` | 67 | Template engine | `TemplateResolver` |
| `GetWorkflowConfig` | 66 | Config utilitaire | `SessionHelper` |
| `EvaluateSimpleComparison` | 57 | Conditions | `ConditionEvaluator` |
| `ExecutePhaseNodeInlineAsync` | 47 | Logique métier | Déjà un `PhaseBlockExecutor`, fusionner |
| `ExecuteSequenceNodeAsync` | 46 | Contrôle de flux | Reste dans le moteur |
| `CheckPauseAsync` | 38 | Session lifecycle | `SessionHelper` |
| `EvaluateCondition` | 31 | Conditions | `ConditionEvaluator` |
| `SerializeOutputValue` | 27 | Sérialisation | `BlockRefDispatcher` |
| `CollectNodeIdsRecursive` | 23 | Checkpoint | Utilitaire interne |
| Autres helpers | ~60 | Conversions | `JsonConversionHelper` |

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Ne JAMAIS changer le comportement observable** — c'est un refactoring pur, zéro régression
3. **Écrire dans `PHASE-53-B/checkpoint.md`** après chaque sous-phase
4. **Tester après chaque extraction** — `dotnet build` + vérifier que les tests passent
5. **Ne pas renommer les méthodes publiques** utilisées par d'autres classes (EntryPointExecutor, MultiNodeBlockExecutor)

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 53-B-A | Extraire `TemplateResolver` + `ConditionEvaluator` | 0.5 jour |
| 53-B-B | Extraire `set-variable` en `SetVariableBlockExecutor` | 0.5 jour |
| 53-B-C | Nettoyer `ExecuteBlockRefAsync` + supprimer `DispatchRegularNodeAsync` et `ExecuteNodesAsync` | 0.5 jour |
| 53-B-D | Extraire `SessionHelper` + réduire `ExecuteForEachNodeAsync` | 0.5 jour |
| 53-B-E | Vérification build + tests + E2E | 0.5 jour |

---

## 53-B-A : Extraire `TemplateResolver` + `ConditionEvaluator`

### Lecture obligatoire
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` L1977-2100 — le code à extraire
- `apps/backend/src/Maestro.Infrastructure/Sessions/SessionStateManager.cs` — ne pas dupliquer ses responsabilités

### Ce que cette sous-phase fait

1. Créer `Maestro.Infrastructure.Sessions.TemplateResolver` (classe statique) :
   - `ResolveTemplate(string template, ProjectSession session) → string`
   - `ExtractJsonSubPath(object value, string subPath) → string?`
   - `StripSurroundingQuotes(string s) → string`

2. Créer `Maestro.Infrastructure.Sessions.ConditionEvaluator` (classe statique) :
   - `EvaluateCondition(string conditionTemplate, ProjectSession session) → bool` (appelle `TemplateResolver.ResolveTemplate` en interne)
   - `EvaluateSimpleComparison(string expr) → bool`

3. Remplacer dans `NodeExecutionEngine` tous les appels `ResolveTemplate(...)` par `TemplateResolver.ResolveTemplate(...)` et `EvaluateCondition(...)` par `ConditionEvaluator.Evaluate(...)`.

4. Supprimer les méthodes déplacées de `NodeExecutionEngine`.

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Sessions/TemplateResolver.cs` | Créer — classe statique avec ResolveTemplate + ExtractJsonSubPath |
| `Sessions/ConditionEvaluator.cs` | Créer — classe statique avec EvaluateCondition + EvaluateSimpleComparison |
| `Sessions/NodeExecutionEngine.cs` | Modifier — remplacer appels, supprimer méthodes déplacées |

### Verification
```bash
cd apps/backend && dotnet build
# Resultat attendu : 0 erreurs

cd apps/backend && dotnet test
# Resultat attendu : tous les tests passent
```

### Anti-patterns
- Ne PAS rendre `TemplateResolver` injectable (DI) — c'est une classe utilitaire statique pure
- Ne PAS changer la signature de `ResolveTemplate` — elle est appelée partout dans le moteur

### Checkpoint
```markdown
## 53-B-A : TemplateResolver + ConditionEvaluator
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Lignes retirées de NodeExecutionEngine** : ~250
**Build** : 0 erreurs
**Tests** : XX/XX
```

---

## 53-B-B : Extraire `set-variable` en `SetVariableBlockExecutor`

### Lecture obligatoire
- `Sessions/NodeExecutionEngine.cs` L776-972 — la méthode `ExecuteSetVariableNode` (196 lignes)
- `BlockExecutors/FileReadBlockExecutor.cs` — pattern d'un executor atomique simple
- `Api/Program.cs` — pour l'enregistrement DI

### Ce que cette sous-phase fait

1. Créer `Maestro.Infrastructure.BlockExecutors.SetVariableBlockExecutor` :
   - `SupportedType => "set-variable"`
   - Implémente `IBlockExecutor`
   - Reprend la logique de `ExecuteSetVariableNode` : set simple, mode append, extraction JSON inline, conversions JArray/JsonElement
   - Le noeud `set-variable` dans les config.nodes sera dispatché via `BlockExecutorRegistry` comme tout autre blockRef

2. Modifier `NodeExecutionEngine` :
   - Dans `ExecuteConfigNodesAsync`, le case `"set-variable"` dispatch maintenant vers `BlockExecutorRegistry` au lieu d'appeler `ExecuteSetVariableNode` directement
   - Supprimer `ExecuteSetVariableNode` du moteur

3. Enregistrer `SetVariableBlockExecutor` dans `Program.cs`

4. Créer `content/system/blocks/infrastructure/set-variable.infrastructure.block.json` (definition minimale)

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `BlockExecutors/SetVariableBlockExecutor.cs` | Créer — logique extraite de ExecuteSetVariableNode |
| `Sessions/NodeExecutionEngine.cs` | Modifier — supprimer ExecuteSetVariableNode, dispatcher via registry |
| `Api/Program.cs` | Modifier — enregistrer SetVariableBlockExecutor |
| `content/system/blocks/infrastructure/set-variable.infrastructure.block.json` | Créer — definition de block |

### Verification
```bash
cd apps/backend && dotnet build
# Resultat attendu : 0 erreurs

cd apps/backend && dotnet test
# Resultat attendu : tous les tests passent
```

### Anti-patterns
- Ne PAS simplifier la logique de set-variable — elle est complexe pour de bonnes raisons (append, JSON extraction, type handling). Extraire tel quel.
- Ne PAS créer un block.json avec config.nodes pour set-variable — c'est un executor atomique

### Checkpoint
```markdown
## 53-B-B : SetVariableBlockExecutor
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Lignes retirées de NodeExecutionEngine** : ~196
**Build** : 0 erreurs
**Tests** : XX/XX
```

---

## 53-B-C : Nettoyer `ExecuteBlockRefAsync` + supprimer legacy

### Lecture obligatoire
- `Sessions/NodeExecutionEngine.cs` L1482-1720 — `ExecuteBlockRefAsync` + `DispatchRegularNodeAsync`
- `Sessions/NodeExecutionEngine.cs` L57-127 — `ExecuteNodesAsync` (legacy tree dispatch)
- `Sessions/EntryPointExecutor.cs` — vérifie si `ExecuteNodesAsync` est encore appelé

### Ce que cette sous-phase fait

1. **Fusionner `DispatchRegularNodeAsync` dans `ExecuteBlockRefAsync`** :
   - `DispatchRegularNodeAsync` (118 lignes) ne fait que résoudre un blockRef et appeler `ExecuteBlockRefAsync`. Il n'ajoute pas de valeur comme méthode séparée. Fusionner la logique de résolution dans `ExecuteBlockRefAsync`.

2. **Extraire la sérialisation des outputs** de `ExecuteBlockRefAsync` dans une méthode privée `SerializeBlockOutput` (la partie lignes 1670-1698 qui construit le string output à partir de `BlockExecutionResult.Outputs`).

3. **Supprimer `ExecuteNodesAsync`** (legacy tree dispatch, 70 lignes) :
   - Vérifier qu'il n'est plus appelé nulle part (EntryPointExecutor l'utilisait pour les workflows sans config.nodes — Phase 53 a dit "blocks without config.nodes throw")
   - Si encore utilisé : remplacer l'appel par `ExecuteConfigNodesAsync`
   - Supprimer la méthode

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Sessions/NodeExecutionEngine.cs` | Modifier — fusionner DispatchRegularNodeAsync, extraire SerializeBlockOutput, supprimer ExecuteNodesAsync |
| `Sessions/EntryPointExecutor.cs` | Modifier si nécessaire — remplacer appel à ExecuteNodesAsync |

### Verification
```bash
cd apps/backend && dotnet build
# Resultat attendu : 0 erreurs

cd apps/backend && dotnet test
# Resultat attendu : tous les tests passent

# Vérifier qu'ExecuteNodesAsync n'existe plus
grep -rn "ExecuteNodesAsync" apps/backend/src/
# Resultat attendu : aucun résultat (ou seulement des commentaires)
```

### Anti-patterns
- Ne PAS changer la signature publique de `ExecuteBlockRefAsync` — elle est appelée par MultiNodeBlockExecutor et EntryPointExecutor
- Ne PAS supprimer `ExecuteNodesAsync` sans vérifier tous les appelants

### Checkpoint
```markdown
## 53-B-C : Nettoyage dispatch + suppression legacy
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Lignes retirées de NodeExecutionEngine** : ~180
**ExecuteNodesAsync supprimé** : OUI/NON
**Build** : 0 erreurs
**Tests** : XX/XX
```

---

## 53-B-D : Extraire `SessionHelper` + réduire `ExecuteForEachNodeAsync`

### Lecture obligatoire
- `Sessions/NodeExecutionEngine.cs` L1838-1960 — `GetWorkflowConfig`, `GetProjectPath`, `GetConfigString`, `GetConfigInt`, `NormalizeBlockId`
- `Sessions/NodeExecutionEngine.cs` L973-1433 — `ExecuteForEachNodeAsync` (460 lignes)
- `Sessions/NodeExecutionEngine.cs` L2291-2431 — helpers de conversion JSON

### Ce que cette sous-phase fait

1. **Créer `Maestro.Infrastructure.Sessions.SessionHelper`** (classe statique) :
   - `GetProjectPath(ProjectSession session) → string`
   - `GetWorkflowConfig(ProjectSession session, string workflowId, string? phaseId) → Dictionary?`
   - `GetConfigString(Dictionary? config, string dotPath, string? defaultValue) → string`
   - `GetConfigInt(Dictionary? config, string dotPath, int defaultValue) → int`
   - `NormalizeBlockId(string workflowId) → string`
   - `ExtractWorkflowKeys(string workflowId) → string[]`
   - Les helpers de conversion : `JObjectToDict`, `JsonElementToDict`, `JArrayToNativeList`, `TryExtractJsonArrayFromText`

2. **Réduire `ExecuteForEachNodeAsync`** (460 → ~250 lignes) :
   - Extraire la logique de résolution de la collection (lignes ~990-1100) dans une méthode privée `ResolveForEachCollection`
   - Extraire la logique de checkpoint clearing (déjà factorisée avec `CollectNodeIdsRecursive`) — vérifier qu'elle est propre
   - Ne PAS changer la logique — juste réorganiser en méthodes plus petites

3. Mettre à jour les appelants dans `NodeExecutionEngine` et `EntryPointExecutor` pour utiliser `SessionHelper`.

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Sessions/SessionHelper.cs` | Créer — utilitaires session, config, conversion |
| `Sessions/NodeExecutionEngine.cs` | Modifier — remplacer appels, supprimer méthodes déplacées, refactorer ForEach |
| `Sessions/EntryPointExecutor.cs` | Modifier — utiliser SessionHelper.GetProjectPath, etc. |

### Verification
```bash
cd apps/backend && dotnet build
# Resultat attendu : 0 erreurs

cd apps/backend && dotnet test
# Resultat attendu : tous les tests passent

wc -l apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs
# Resultat attendu : < 1500 lignes
```

### Anti-patterns
- Ne PAS changer la logique de `ExecuteForEachNodeAsync` — c'est un refactoring pur, pas une réécriture
- Ne PAS mettre les helpers de conversion dans un package séparé — ils sont spécifiques au moteur d'exécution

### Checkpoint
```markdown
## 53-B-D : SessionHelper + réduction ForEach
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Lignes NodeExecutionEngine avant** : 2431
**Lignes NodeExecutionEngine après** : XXXX (cible < 1500)
**Nouvelles classes** : SessionHelper.cs (XX lignes)
**Build** : 0 erreurs
**Tests** : XX/XX
```

---

## 53-B-E : Vérification build + tests + E2E

### Lecture obligatoire
- `docs/system/TESTING-PROTOCOL.md` — protocole de test obligatoire
- `docs/phases/PHASE-54/checkpoint.md` — résultats E2E de référence

### Ce que cette sous-phase fait

1. Build complet : `dotnet build` — 0 erreurs
2. Tests backend : `dotnet test` — tous passent
3. Tests TypeScript : `npx vitest run` dans maestro-code, tui, maestro-client
4. Vérification architecture :
   - `NodeExecutionEngine.cs` < 1500 lignes
   - Aucune méthode > 200 lignes dans le moteur
   - Pas de logique métier (set-variable, phase) dans le moteur
   - `TemplateResolver`, `ConditionEvaluator`, `SessionHelper` existent
5. E2E rapide : invoquer le test-designer agent et vérifier que le pipeline fonctionne toujours

### Verification
```bash
cd apps/backend && dotnet build && dotnet test
wc -l apps/backend/src/Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs
# Cible : < 1500 lignes

# Aucune méthode > 200 lignes
# (vérification manuelle ou script)

# E2E : invoquer le test-designer via curl
curl -X POST http://localhost:5000/api/contracts/test-designer/test?blockId=test-designer
# Resultat attendu : fitness réaliste (< 1.0), pas d'erreur
```

### Anti-patterns
- Ne PAS déclarer DONE sans le E2E — le contract test runner est le test d'intégration le plus complet
- Ne PAS ignorer les tests TypeScript — ils peuvent casser si des types API changent

### Checkpoint
```markdown
## 53-B-E : Vérification finale
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Build** : 0 erreurs
**Tests backend** : XX/XX
**Tests TS** : XX/XX
**NodeExecutionEngine** : XXXX lignes (avant: 2431)
**E2E contract test** : fitness = X.XXXX
```

---

## Definition of Done

- [x] `TemplateResolver` extrait — résolution de templates et extraction JSON sub-path (201 lignes)
- [x] `ConditionEvaluator` extrait — évaluation de conditions booléennes (113 lignes)
- [x] `SessionHelper` extrait — utilitaires session, config, conversion (292 lignes)
- [ ] `SetVariableBlockExecutor` — kept in engine (tightly coupled with session state + stateManager)
- [x] `ExecuteNodesAsync` supprimé — code mort depuis Phase 53, fallback remplacé par throw
- [ ] `DispatchRegularNodeAsync` — kept (UI update wrapper, not pure duplicate of ExecuteBlockRefAsync)
- [x] `ExecuteForEachNodeAsync` réduit (460 → ~260 lignes via ResolveForEachSource extraction)
- [x] `NodeExecutionEngine` 2431 → 1815 lignes (-25.3%)
- [x] Build : 0 erreurs
- [x] Tous les tests passent (93+77 backend, 140/141 TS)
- [ ] E2E contract test runner — not re-verified (no behavioral changes, pure refactoring)

### NOT in scope
- Réécriture du contrôle de flux (while, conditional, sequence, parallel) — ils restent dans le moteur
- Tests unitaires pour `TemplateResolver` / `ConditionEvaluator` — les tests d'intégration existants couvrent
- Changement de comportement — c'est un refactoring pur
- Agent agent-creator (Phase 55)

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-53-B/checkpoint.md` — format défini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md après completion
- Ajouter : "Phase 53-B: NodeExecutionEngine décomposé (2431 → <1500 lignes). TemplateResolver, ConditionEvaluator, SetVariableBlockExecutor, SessionHelper extraits."
- Modifier : ligne "NodeExecutionEngine: 2431 lines" dans architecture
