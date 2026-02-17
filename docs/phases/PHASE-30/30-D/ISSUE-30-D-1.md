# Issue 30-D-1 : Creer le workspace Phase 30

**Statut** : A faire
**Estimation** : 10 minutes
**Prerequis** : Aucun

---

## Description

Creer un workspace dedie a la Phase 30 pour tracer toutes les sessions foundry et projet.

---

## Tache

```bash
cd maestro-cli
node index.js workspace create --name "Phase-30 autonomous-dev Tier 1"
# Noter le workspace-id
```

---

## Critere de completion

- [ ] Le workspace est cree
- [ ] `workspace info <id>` retourne les informations
- [ ] Le workspace-id est note pour les issues suivantes
