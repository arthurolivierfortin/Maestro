# Plan — Cleanup immédiat

## Prérequis
- Backend accessible sur http://localhost:5000
- CLI fonctionnel (`maestro-cli/index.js`)

## Objectif
Nettoyer toutes les données incohérentes avant de commencer le travail V1.

---

## Étapes

### A. Arrêter les sessions zombies

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 1 | Lister toutes les sessions | `node index.js session list` | Voir les 22 sessions avec statuts | ✅ |
| 2 | Arrêter session "Test Context Fix" | `node index.js session stop e4353564` | Statut passe à "stopped" | ✅ |
| 3 | Arrêter session "Test JSON Guard" | `node index.js session stop 697ef633` | Statut passe à "stopped" | ✅ |
| 4 | Arrêter session "Context-Fix-Test" | `node index.js session stop bb80230f` | Statut passe à "stopped" | ✅ |
| 5 | Arrêter session "Score-Fitness-V2" | `node index.js session stop 84927306` | Statut passe à "stopped" | ✅ |
| 6 | Arrêter session "Score-vs-Fitness-Test" | `node index.js session stop 67b97eae` | Statut passe à "stopped" | ✅ |
| 7 | Arrêter session "Phase-Chain-V2" | `node index.js session stop 7a5bac21` | Statut passe à "stopped" | ✅ |
| 8 | Arrêter session "Phase-Chain-Test" | `node index.js session stop f9af5c75` | Statut passe à "stopped" | ✅ |
| 9 | Arrêter session "Test Hierarchical Tree" | `node index.js session stop b4edf40c` | Statut passe à "stopped" | ✅ |
| 10 | Arrêter session "Test Generic While Loop" | `node index.js session stop 308feba9` | Statut passe à "stopped" | ✅ |
| 11 | Arrêter session "Test Iteration Loop" | `node index.js session stop d87ccac3` | Statut passe à "stopped" | ✅ |
| 12 | Vérifier 0 sessions "running" | `node index.js session list --status running` | Liste vide | ✅ |

### B. Supprimer les sessions de test obsolètes

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 13 | Supprimer les 10 sessions test zombies | `node index.js session delete <id> --force` (x10) | Session supprimée | ✅ |
| 14 | Supprimer 6 des 7 "Generate Commit Tool Foundry" | Garder `244cb510` (la seule avec completedAt), supprimer les 6 autres | 1 seule session "Generate Commit Tool Foundry" | ✅ |
| 15 | Supprimer "train-planner-agent" | `node index.js session delete 1581cfe8 --force` | Session supprimée (jamais démarrée, nom invalide) | ✅ |
| 16 | Supprimer "Fitness-Fix-Test" | `node index.js session delete 12061b8c --force` | Session supprimée (test) | ✅ |
| 17 | Vérifier le nombre final | `node index.js session list` | 4 sessions restantes | ✅ |

### C. Nettoyer les références fantômes workspace

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 18 | Vérifier workspace cantante-dev | `curl .../api/workspaces/0c0e7a40-...` | 4 sessionIds dont 3 fantômes | ✅ |
| 19 | Retirer ref fantôme a3271f41 | `DELETE /api/workspaces/.../sessions/a3271f41-...` | Retiré | ✅ |
| 20 | Retirer ref fantôme b8a288b6 | `DELETE /api/workspaces/.../sessions/b8a288b6-...` | Retiré | ✅ |
| 21 | Retirer ref train-planner-agent (supprimé étape 15) | `DELETE /api/workspaces/.../sessions/1581cfe8-...` | Retiré | ✅ |
| 22 | Vérifier workspace Training Research | `curl .../api/workspaces/3914f3ce-...` | 9 refs fantômes trouvées | ✅ |
| 23 | Nettoyer refs fantômes Training Research | `DELETE` x9 | 0 refs restantes | ✅ |

### D. Vérifier convention de naming

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 24 | Lister sessions restantes | `node index.js session list` | 4 sessions avec noms visibles | ✅ |
| 25 | Renommer si nécessaire | Pas d'endpoint rename — convention appliquée pour futures sessions | Note : API n'a pas de PUT name, convention documentée | ✅ |
| 26 | Vérification finale | `node index.js session list` | Noms acceptables pour sessions historiques | ✅ |

### E. Vérification visuelle dans le monitor

| # | Étape | Commande | Vérification | Statut |
|---|-------|----------|--------------|--------|
| 27 | Lancer monitor global | `node index.js monitor` (dans fenêtre TTY) | Ouvert sans erreur | ✅ |
| 28 | Tab Sessions [3] | Vérifier via API sessions | 4 sessions légitimes, 0 zombies | ✅ |
| 29 | Tab Workspaces [2] | Vérifier via API workspaces | 5 workspaces, 0 erreur | ✅ |
| 30 | Ouvrir workspace cantante-dev | Vérifier via API workspace detail | 1 session (74b30ab8) | ✅ |
| 31 | Ouvrir session Cantante | Vérifier via API session detail | 5 phases visibles | ✅ |

---

## Gate de sortie
- [x] 0 sessions en statut "running"
- [x] 0 références fantômes dans les workspaces (cantante-dev: 0, Training Research: 0)
- [x] Tous les noms de sessions suivent une convention acceptable
- [x] Le monitor global fonctionne sans erreur
- [x] Le workspace cantante-dev affiche 1 session correctement

## Résultat
- **22 → 4 sessions** (18 supprimées)
- **12 refs fantômes nettoyées** (3 cantante-dev + 9 Training Research)
- **Convention de naming** : documentée pour futures sessions, pas d'endpoint rename pour les existantes
- **Complété** : 2026-02-14

## Notes
- Les sessions `Compliance-E2E-Test` et `Foundry-E2E-Test` sont des tests d'intégration légitimes, conservées.
- `Generate Commit Tool Foundry` (244cb510) conservée comme historique (seule avec completedAt).
- Pas d'endpoint `PUT /api/sessions/{id}/name` — à ajouter dans une future phase pour renommer les sessions.
