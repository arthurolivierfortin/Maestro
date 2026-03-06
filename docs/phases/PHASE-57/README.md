# Phase 57 : /adapt = Workflow Agent Creator + Contract Resolution

**Statut** : Planifie
**Prerequis** : Phase 56 COMPLETE (workflow block-forge, /create-agent TUI/CLI)
**Objectif** : `/adapt` utilise Agent Creator pour creer des variantes d'un block optimisees pour un modele/hardware donne. La variante implemente le **meme contract** que l'original. Les workflows peuvent utiliser `contractRef` au lieu de `blockRef` pour resoudre au runtime vers le block choisi par l'utilisateur.
**Duree estimee** : 4-6 jours

---

## Contexte

### /adapt avec contracts

```
/adapt maestro-assistant-workflow --target-model mistral-7b

1. Lit le block source → contract: "maestro-assistant"
2. Lit le contract definition → features + capabilities requises
3. Appelle Agent Creator :
   "Cree un block qui implemente le contract maestro-assistant
    optimise pour Mistral 7B.
    Le modele supporte tool-calling mais pas structured-output.
    Adapte les prompts en consequence."
4. Agent Creator genere le block :
   - contract: "maestro-assistant"
   - capabilities: ["conversation", "orchestration", "tool-calling"]
   - (structured-output absent → features json-config desactivee)
5. Test fitness → publish comme block utilisateur
```

### contractRef dans les workflows

Aujourd'hui un workflow fait `blockRef: "maestro-assistant-claude"` — hardcode.
Avec `contractRef`, le workflow fait `contractRef: "maestro-assistant"` et le systeme resout au runtime vers le block que l'utilisateur a choisi pour ce contract.

```json
{
  "config": {
    "nodes": [
      {
        "id": "assistant",
        "contractRef": "maestro-assistant",
        "requiredCapabilities": ["orchestration", "tool-calling"]
      }
    ]
  }
}
```

Si le block choisi pour ce contract n'a pas les `requiredCapabilities`, erreur claire au lieu d'un echec silencieux.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 55-A | Workflow `/adapt` (Agent Creator + contract) | 2-3 jours |
| 55-B | `contractRef` dans les workflows (resolution runtime) | 1-2 jours |
| 55-C | Integration TUI + Catalog | 1 jour |

---

## 55-A : Workflow /adapt

### Lecture obligatoire
- `content/system/blocks/workflows/` (workflows existants)
- Le block `system:agent-creator` (Phase 55)
- `content/system/contracts/` (contract definitions)
- `packages/maestro-cli/adapt-optimize.ts` (module adapt nettoye Phase 50)
- `packages/maestro-code/services/contract-resolver.ts` (Phase 50)
- `packages/maestro-code/services/hardware-detect.ts`

### Taches

1. **Creer le workflow `system:adapt-workflow`** :
   ```
   adapt-workflow (composite)
     |-- analyze-source
     |   Lit le block source, son contract, ses capabilities
     |   Identifie le modele cible (specifie ou detecte via hardware)
     |   Determine quelles capabilities le modele cible supporte
     |
     |-- create-variant (appelle Agent Creator)
     |   Contraintes :
     |     - Meme contract que l'original
     |     - Prompts adaptes pour le modele cible
     |     - Capabilities = intersection(contract.features, model.capabilities)
     |     - Temperature, max_tokens, tool-calling adaptes
     |
     |-- test-variant
     |   Mesure fitness
     |   Verifie les capabilities declarees
     |
     +-- publish-or-iterate
         fitness >= seuil → publish comme block utilisateur
         sinon → iterate (max 3)
   ```

2. **Le resultat** :
   - Block utilisateur dans `content/user/blocks/`
   - Meme contract que l'original
   - Capabilities verifiees (pas juste declarees)
   - Metadata : `adaptedFrom`, `targetModel`, `fitness`

3. **CLI** : `maestro adapt <block-id> [--target-model <model>] [--target-tier <tier>]`

---

## 55-B : contractRef dans les workflows

### Lecture obligatoire
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs`
- `apps/backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs`
- `apps/backend/src/Maestro.Domain/Entities/BlockDefinition.cs`

### Taches

1. **Ajouter `contractRef` comme alternative a `blockRef`** dans les nodes de workflow :
   - Si `contractRef` present → resoudre via config utilisateur
   - Si `blockRef` present → resolution directe (existant)
   - Si les deux → erreur

2. **Resolution** :
   - Lire `~/.maestro/config.json` → `contracts["maestro-assistant"]` → block ID
   - Fallback : si pas de config, utiliser le block par defaut du contract
   - Si `requiredCapabilities` sur le node → verifier que le block choisi les a
   - Si capability manquante → erreur claire : "Block X doesn't support Y required by this workflow"

3. **Tests** :
   - Test : contractRef resout vers le block configure
   - Test : contractRef sans config → fallback defaut
   - Test : requiredCapabilities manquante → erreur
   - Test : blockRef continue de fonctionner (backward compatible)

---

## 55-C : Integration TUI + Catalog

### Taches

1. **Slash command `/adapt`** dans AgentPanel :
   - `/adapt` → adapte le block du contract actif au hardware
   - `/adapt <block-id>` → adapte un block specifique
   - `/adapt <block-id> --model <model>` → pour un modele specifique
   - Progression dans le ConversationLog

2. **Touche `[A]` dans CatalogScreen** sur un block → lance /adapt pour ce block

3. **DemoApiClient** : mock pour adapt

4. **HelpOverlay** : ajouter `/adapt`

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

- [ ] Workflow `system:adapt-workflow` fonctionnel
- [ ] La variante creee implemente le meme contract que l'original
- [ ] Les capabilities sont verifiees, pas juste declarees
- [ ] `contractRef` fonctionne dans les workflows
- [ ] Resolution runtime avec fallback + verification capabilities
- [ ] `/adapt` et `[A]` fonctionnent dans le TUI
- [ ] CLI `maestro adapt` fonctionnel
- [ ] Tous les tests passent
- [ ] E2E dogfooding score >= 3.5/5

### NOT in scope
- Production des ~30 variantes (Phase 58)
- Catalogue communautaire (Phase 60)
