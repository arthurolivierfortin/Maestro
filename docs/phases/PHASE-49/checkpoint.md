# Phase 49 : Checkpoint

**Derniere mise a jour** : 2026-03-04 15:00
**Sous-phase en cours** : TERMINEE
**Agent** : Claude Opus 4.6 — session unique

---

## 49-C : Restauration metriques provider
**Statut** : DONE
**Date** : 2026-03-04

**Ce qui a ete fait** :
- Backend : DTOs (`LLMProviderStats`, `PerModelStats`, `LLMQueueStats`, `LLMPerformanceProfile`, `LLMSwitchEvent`) dans `apps/backend/src/Maestro.Application/DTOs/LLMDtos.cs`
- Backend : 4 methodes dans `ILLMProviderService.cs` + implementation dans `LLMProviderService.cs` (appels HTTP vers LLM-Provider .NET)
- Backend : 4 endpoints dans `ProviderController.cs` (`GET stats`, `stats/queue`, `stats/performance`, `stats/switching`)
- SDK : types TypeScript dans `packages/maestro-client/src/types.ts`, methodes dans `domains/llm.ts`, exports barrel dans `index.ts`
- CLI adapter : 4 methodes dans `packages/maestro-cli/api-client.ts`
- TUI : `MetricsPanel` et `QueuePanel` dans `ModelsScreen.ts`, layout 2 lignes (Status|Metrics|Queue en haut, Providers|Models en bas)
- Demo : `getLLMStats()` et `getLLMQueueStats()` dans `DemoApiClient.ts`
- Visual gate : assertions METRICS et QUEUE dans `visual-gate.test.ts`
- Tests : 8 tests dans `ModelsScreen.test.ts`

**Verification** :
```
Type check: 0 errors
Backend build: 0 errors, 69 warnings (pre-existants)
Tests: 8/8 pass (ModelsScreen.test.ts)
Visual gate Models page: toutes assertions passent (METRICS, QUEUE inclus)
Real demo check: 4/4 PASS
```

---

## 49-A : Hardware-aware first-run flow
**Statut** : DONE (partiel — voir items reportes)
**Date** : 2026-03-04

**Ce qui a ete fait** :
- `packages/maestro-code/services/hardware-detect.ts` : detection GPU (nvidia-smi), RAM, CPU, 6 modeles recommandes, save/load `~/.maestro/capabilities.json`
- `packages/maestro-code/components/ProviderSetupScreen.ts` : composant `LocalSetup` — affiche hardware detecte, modeles recommandes, selection j/k
- Backend : `GetSystemCapabilitiesAsync` de-stubbe dans `LLMProviderService.cs` — lit `~/.maestro/capabilities.json`
- SDK : `capabilities?: string[]` ajoute a `BlockDefinition` dans types.ts
- Demo data : capabilities ajoutees aux 12 blocs demo
- Tests : 10 tests (hardware-detect.test.ts) + 5 tests (LocalSetup.test.ts)

**Items reportes (hors scope Phase 49)** :
- `LoadModelAsync` reste stubbe — pas d'endpoint model load dans LLM-Provider .NET
- Pas de flow de telechargement post-setup (le `recommendedModel` est stocke mais pas telecharge)
- Pas de proxy `GET /api/v1/system/capabilities` dans LLM-Provider .NET
- Fix CPU-only Python (`use_system_ram` pas wire)

**Verification** :
```
Type check: 0 errors
Tests: 15/15 pass
Real demo check: 4/4 PASS
```

---

## 49-B : Modele de capacites agent
**Statut** : DONE
**Date** : 2026-03-04

**Ce qui a ete fait** :
- SDK : `capabilities?: string[]` dans `BlockDefinition` TypeScript type
- TUI : tags inline (3 max, comma-separes) + badges `[tag]` en vue expanded dans `CatalogScreen.ts`
- Block IDs tronques a 18 chars (au lieu de 12)
- Separateur `|` entre tags et description
- Demo data : capabilities sur les 12 blocs
- Tests : 5 tests (CatalogCapabilities.test.ts)

**Verification** :
```
Type check: 0 errors
Tests: 5/5 pass
E2E dogfooding: score 4/5 (Models 4.5/5, Catalog 3.5/5, Navigation 5/5)
```

---

## Post-implementation : corrections E2E
**Date** : 2026-03-04

- "Complet." → "Compl:" dans MetricsPanel
- Separateur `|` entre capability tags et description dans CatalogScreen
- Block ID truncation 12 → 18 chars

---

## Post-implementation : Testing Protocol
**Date** : 2026-03-04

- Cree `docs/system/TESTING-PROTOCOL.md` — 6 couches obligatoires pour toutes les phases
- Mis a jour `docs/system/AGENT-PROTOCOL.md` Regle 2c — reference au Testing Protocol
- Mis a jour `CLAUDE.md` Testing Requirements — reecrit pour referencer le protocole
- Mis a jour `CLAUDE.md` Key Reference Documents — ajoute TESTING-PROTOCOL.md

---

## Bilan final

| Metrique | Valeur |
|----------|--------|
| Tests crees | 28 (8 + 10 + 5 + 5) |
| Tests totaux maestro-code | 129 (128 pass + 1 pre-existant Catalog) |
| Fichiers crees | 4 (hardware-detect.ts, ModelsScreen.test.ts, hardware-detect.test.ts, LocalSetup.test.ts, CatalogCapabilities.test.ts, TESTING-PROTOCOL.md) |
| Fichiers modifies | 12 (LLMDtos.cs, ILLMProviderService.cs, LLMProviderService.cs, ProviderController.cs, types.ts, llm.ts, index.ts, api-client.ts, ModelsScreen.ts, ProviderSetupScreen.ts, CatalogScreen.ts, DemoApiClient.ts, demo-data.ts, visual-gate.test.ts, AGENT-PROTOCOL.md, CLAUDE.md) |
| Score E2E | 4/5 |
