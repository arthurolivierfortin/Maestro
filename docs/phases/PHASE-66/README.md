# Phase 66 : Onboarding + Packaging npm

> **Note** : Anciennement Phase 65. Decalee suite a l'insertion de la Phase 62 (Agents Fonctionnels).

**Statut** : A faire
**Prerequis** : Phase 65 COMPLETE (choix par contract au setup, Catalog organise)
**Objectif** : `npm install -g @maestro/cli && maestro init && maestro code` — premiere experience utilisateur complete, du install au premier message.
**Duree estimee** : 8-10 jours

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 66-A | Packaging npm, commande globale, sidecar auto-start | 3-4 jours |
| 66-B | `maestro init` + onboarding (provider + choix assistant par contract) | 2-3 jours |
| 66-C | Documentation : README, Getting Started, 3 exemples | 2-3 jours |

---

## Gate

- [ ] `npm install -g @maestro/cli` installe correctement
- [ ] `maestro init` configure provider + assistant
- [ ] `maestro code` lance le TUI
- [ ] Un utilisateur externe accomplit une tache reelle

### NOT in scope
- Beta testing (Phase 67)
- Catalogue communautaire (Phase 69)
