# Phase 63 : /adapt = block-forge avec baseBlockId + contractRef

> **Note** : Anciennement Phase 62. Decalee suite a l'insertion de la Phase 62 (Agents Fonctionnels).

**Statut** : A faire
**Prerequis** : Phase 62 COMPLETE (agents fonctionnels, fitness > 0.5, block-forge E2E)
**Objectif** : `/adapt` utilise block-forge pour creer des variantes d'un block optimisees pour un modele/hardware donne. La variante implemente le meme contract que l'original. Les workflows peuvent utiliser `contractRef` au lieu de `blockRef` pour resoudre au runtime vers le block choisi par l'utilisateur.
**Duree estimee** : 4-6 jours

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 63-A | Workflow /adapt : invoque block-forge avec baseBlockId + targetModel | 2-3 jours |
| 63-B | `contractRef` dans les workflows (resolution runtime + verification capabilities) | 1-2 jours |
| 63-C | Integration TUI : `/adapt` dans AgentPanel, `[A]` dans CatalogScreen | 1 jour |

---

## Gate

- [ ] Workflow `system:adapt-workflow` fonctionnel
- [ ] La variante creee implemente le meme contract que l'original
- [ ] Les capabilities sont verifiees, pas juste declarees
- [ ] `contractRef` fonctionne dans les workflows (resolution runtime + fallback + verification capabilities)
- [ ] `/adapt` et `[A]` fonctionnent dans le TUI
- [ ] CLI `maestro adapt` fonctionnel
- [ ] E2E dogfooding score >= 3.5/5

### NOT in scope
- Production des ~30 variantes (Phase 64)
- Catalogue communautaire (Phase 69)
