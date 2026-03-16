# Phase 64 : Choix assistant au setup + Catalog par contract

**Statut** : A faire
**Prerequis** : Phase 63 COMPLETE (~30 variantes pre-testees avec contracts et capabilities)
**Objectif** : Au premier lancement, l'utilisateur voit tous les blocks qui implementent le contract `maestro-assistant`, avec leurs capabilities et features actives/inactives. Il choisit celui qu'il veut. Le Catalog est organise par contract et permet de changer a tout moment.
**Duree estimee** : 3-5 jours

---

## Contexte

### Le flow utilisateur

```
┌─ CHOOSE YOUR ASSISTANT ─────────────────────────────────────────┐
│                                                                   │
│  Your hardware: RTX 3060 (12GB VRAM), 32GB RAM                   │
│  Contract: maestro-assistant                                      │
│                                                                   │
│  Compatible implementations (5):                                  │
│                                                                   │
│  > maestro-assistant-mistral7b     ★ Recommended                  │
│    Fitness: 0.82 | Model: Mistral 7B | Tier: standard            │
│    Features: 3/5 active                                           │
│      ✓ conversation  ✓ orchestration  ✓ tool-execution           │
│      ✗ json-config (needs structured-output)                     │
│      ✗ multi-step-plans (needs long-context)                     │
│                                                                   │
│    maestro-assistant-codellama13b                                  │
│    Fitness: 0.78 | Model: CodeLlama 13B | Tier: heavy            │
│    Features: 4/5 active                                           │
│      ✓ conversation  ✓ orchestration  ✓ tool-execution           │
│      ✓ multi-step-plans                                          │
│      ✗ json-config (needs structured-output)                     │
│                                                                   │
│    maestro-assistant-claude                                        │
│    Fitness: 0.95 | Model: Claude (cloud) | Tier: cloud-paid      │
│    Features: 5/5 active — ALL FEATURES                           │
│                                                                   │
│    maestro-assistant-phi3                                          │
│    Fitness: 0.55 | Model: Phi-3 Mini | Tier: light               │
│    Features: 2/5 active                                           │
│      ✓ conversation  ✓ tool-execution                            │
│                                                                   │
│  Not compatible with your hardware (3):                           │
│    maestro-assistant-mixtral (needs 24GB VRAM)                    │
│    ...                                                            │
│                                                                   │
│  [j/k] Navigate  [Enter] Select  [Space] Details                 │
└───────────────────────────────────────────────────────────────────┘
```

L'utilisateur voit **exactement** ce qu'il gagne et perd avec chaque choix.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 64-A | Filtrage compatibilite + feature gating UI | 1 jour |
| 64-B | UI de choix dans le setup flow | 1.5-2 jours |
| 64-C | Catalog organise par contract + changement | 1 jour |
| 64-D | Dogfooding complet | 0.5 jour |

---

## 64-A : Filtrage compatibilite + feature gating UI

### Lecture obligatoire
- `packages/maestro-code/services/contract-resolver.ts` (Phase 50)
- `packages/maestro-code/services/hardware-detect.ts`
- `content/system/contracts/maestro-assistant.contract.json`

### Taches

1. **Enrichir le contract resolver** :
   - `getImplementations(contractId, hardware?)` → compatible + incompatible, tries par fitness
   - Pour chaque block : calculer les features actives/inactives via `getActiveFeatures(block, contract)`
   - Pour les incompatibles : raison (ex: "needs 24GB VRAM, you have 12GB")
   - Output :
     ```typescript
     interface ContractImplementation {
       block: BlockDefinition;
       fitness: number;
       activeFeatures: string[];
       inactiveFeatures: FeatureGap[];
       isRecommended: boolean;
       incompatibleReason?: string;
     }
     interface FeatureGap {
       feature: string;
       missingCapability: string;
       description: string;
     }
     ```

2. **Tests** :
   - Test : block avec toutes les capabilities → 5/5 features actives
   - Test : block avec capabilities partielles → features filtrees + raisons
   - Test : tri par fitness, recommended = meilleur compatible
   - Test : incompatibles avec raisons

---

## 64-B : UI de choix dans le setup flow

### Taches

1. **Composant `ContractChooser`** :
   - Affiche hardware + contract en haut
   - Liste les implementations compatibles avec j/k navigation
   - Chaque block montre : nom, fitness, modele, tier, features X/Y actives
   - Le recommended est marque avec une etoile
   - `[Space]` pour details : liste complete features ✓/✗ avec raisons
   - Section "Not compatible" en bas (grisee)
   - `[Enter]` pour selectionner

2. **Sauvegarde** : `~/.maestro/config.json` → `contracts.maestro-assistant: "<block-id>"`

3. **Message post-selection** : "You can change this anytime from the Catalog."

---

## 64-C : Catalog organise par contract + changement

### Lecture obligatoire
- `packages/maestro-code/components/CatalogScreen.ts`

### Taches

1. **Groupement par contract dans le Catalog** :
   - Les blocks qui partagent un contract sont groupes visuellement
   - Header : "maestro-assistant (3 implementations)" avec features du contract
   - Sous le header : les blocks avec leurs capabilities

2. **Badges** :
   - `[active]` sur le block actuellement choisi pour ce contract
   - `[recommended]` sur le meilleur pour ce hardware
   - `[X/Y features]` indiquant les features actives

3. **Changer de block pour un contract** :
   - `[Enter]` sur un block compatible → "Switch to this for maestro-assistant? [Y/N]"
   - Met a jour la config, recharge

4. **Filtre par contract** : onglet ou touche pour "Show by contract"

---

## 64-D : Dogfooding

- Fresh install (supprimer `~/.maestro/`)
- Verifier le flow complet : setup → choix → utilisation → changement via Catalog
- 3 profils hardware : CPU-only, GPU moyen, cloud-only

---

## Definition of Done

- [ ] Le setup affiche tous les blocks par contract avec features actives/inactives
- [ ] L'utilisateur choisit en comprenant les tradeoffs
- [ ] Features desactivees montrent la raison (capability manquante)
- [ ] Le Catalog est organise par contract
- [ ] Changement de block possible depuis le Catalog
- [ ] 3 profils hardware testes
- [ ] Tous les tests passent
- [ ] E2E dogfooding score >= 3.5/5

### Gate
L'utilisateur comprend ce qu'il gagne et perd avec chaque choix.

### NOT in scope
- Onboarding + Packaging npm (Phase 65)
- Catalogue communautaire (Phase 68, V2)
