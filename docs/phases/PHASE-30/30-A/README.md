# Phase 30-A : Nettoyage et infrastructure

**Statut** : A faire
**Prerequis** : Aucun (c'est le point de depart)
**Objectif** : Nettoyer la dette technique legacy et corriger les bugs bloquants avant tout travail sur les blocs.

---

## Vue d'ensemble

4 issues independantes qui preparent le terrain :

| Issue | Titre | Bloquant ? | Estimation |
|-------|-------|-----------|------------|
| 30-A-1 | Supprimer les fichiers agents legacy | Non | 30min |
| 30-A-2 | Debugger le bug tools-in-session-context | **OUI** | 2-4h |
| 30-A-3 | Infrastructure for-each sur donnees dynamiques | Non | 1h |
| 30-A-4 | Template session projet pour autonomous-dev | Non | 30min |

**Ordre** : 30-A-1 peut se faire en parallele. 30-A-2 est BLOQUANT pour toute la suite. 30-A-3 et 30-A-4 sont independants.

---

## Dependances vers la suite

- 30-A-2 bloque 30-B (les sous-blocs ont besoin que les tools fonctionnent en session)
- 30-A-3 bloque 30-C (le composite utilise for-each sur les resultats du planner)
- 30-A-4 bloque 30-E (les tests E2E utilisent le template)
