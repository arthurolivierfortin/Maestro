# Phase 63 : Production variantes — Benchmark multi-modeles sur contracts

**Statut** : A faire
**Prerequis** : Phase 62 COMPLETE (/adapt fonctionnel avec contractRef)
**Objectif** : Utiliser `/adapt` pour creer ~30 implementations du contract `maestro-assistant` avec capabilities verifiees. Configurer les providers cloud opensource.
**Duree estimee** : 6-10 jours

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 63-A | Configuration providers cloud opensource dans LLM-Provider .NET | 2-3 jours |
| 63-B | Execution de `/adapt` par profil hardware (capabilities verifiees par tier) | 3-5 jours |
| 63-C | Validation, tri, integration dans `content/system/blocks/` | 1-2 jours |

---

## Gate

- [ ] 3+ providers cloud opensource configures
- [ ] 15+ variantes avec fitness > 0.6 et contract `maestro-assistant`
- [ ] Capabilities verifiees (pas juste declarees)
- [ ] Features actives/inactives coherentes avec les capabilities
- [ ] Variantes integrees dans `content/system/blocks/`

### NOT in scope
- UI de choix au setup (Phase 64)
- Catalogue communautaire (Phase 68)
