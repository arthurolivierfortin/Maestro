# Phase 68 (V2) : Catalogue communautaire + Auth

**Statut** : Vision
**Prerequis** : Phase 66 COMPLETE (V1 deployee, utilisateurs reels)
**Objectif** : Les utilisateurs peuvent publier et importer des blocks. Le catalogue est organise par contract : on cherche "un code-reviewer" et on voit toutes les implementations disponibles avec leurs capabilities et compatibilite hardware. Systeme d'auth pour identification.

---

## Vision

- Auth locale (bcrypt) + OAuth GitHub
- API catalogue : publish, search, import par contract + capabilities + hardware
- Catalogue organise par contracts (pas une liste plate)
- Recherche par role (contract), filtrage par hardware, comparaison capabilities
- Publication avec contract + capabilities verifiees + fitness >= 0.7
- TUI : onglets Local | Community | All, import intelligent par contract
