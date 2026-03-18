# Phase 65 : Choix assistant au setup + Catalog par contract

> **Note** : Anciennement Phase 64. Decalee suite a l'insertion de la Phase 62 (Agents Fonctionnels).

**Statut** : A faire
**Prerequis** : Phase 64 COMPLETE (~30 variantes pre-testees avec contracts et capabilities)
**Objectif** : Au premier lancement, l'utilisateur voit tous les blocks qui implementent le contract `maestro-assistant`, avec leurs capabilities et features actives/inactives. Il choisit celui qu'il veut. Le Catalog est organise par contract et permet de changer a tout moment.
**Duree estimee** : 3-5 jours

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 65-A | Filtrage compatibilite + feature gating UI | 1 jour |
| 65-B | UI de choix dans le setup flow | 1.5-2 jours |
| 65-C | Catalog organise par contract + changement | 1 jour |
| 65-D | Dogfooding complet | 0.5 jour |

---

## Gate

- [ ] Le setup affiche tous les blocks par contract avec features actives/inactives
- [ ] L'utilisateur choisit en comprenant les tradeoffs
- [ ] Features desactivees montrent la raison (capability manquante)
- [ ] Le Catalog est organise par contract
- [ ] Changement de block possible depuis le Catalog
- [ ] 3 profils hardware testes
- [ ] Tous les tests passent
- [ ] E2E dogfooding score >= 3.5/5

### NOT in scope
- Onboarding + Packaging npm (Phase 66)
- Catalogue communautaire (Phase 69, V2)
