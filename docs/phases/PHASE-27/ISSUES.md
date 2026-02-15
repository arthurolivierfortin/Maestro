# Journal des problèmes — Phase 27

> Chaque problème découvert pendant l'exécution est logué ici.

---

## Problèmes ouverts

| # | Date | Phase | Description | Impact | Statut |
|---|------|-------|-------------|--------|--------|
| I1 | 2026-02-14 | Audit | 10 sessions zombies "running" depuis 8 jours | Les données sont incohérentes, le monitor affiche des sessions fantômes | Ouvert — Cleanup étape A |
| I2 | 2026-02-14 | Audit | 2 refs fantômes dans workspace cantante-dev | Workspace detail crash ou affiche des erreurs | Ouvert — Cleanup étape C |
| I3 | 2026-02-14 | Audit | Backend ne récupère pas les sessions running au restart | Cause racine des zombies | Ouvert — Phase 22 étape 1-6 |
| I4 | 2026-02-14 | Audit | Pas de cascade delete session → workspace | Cause racine des refs fantômes | Ouvert — Phase 22 étape 7-11 |
| I5 | 2026-02-14 | Audit | Workspace status icon hardcodé dans SpacesScreen | Tous les workspaces montrent "running" | Ouvert — Phase 24 étape 37 |
| I6 | 2026-02-14 | Audit | Scroll max hardcodé à 100 dans SessionMonitor | Scroll incorrect si > 100 ou < 100 nodes | Ouvert — Phase 24 étape 38 |
| I7 | 2026-02-14 | Audit | Error detail tronqué à 80 chars | Perte d'information d'erreur | Ouvert — Phase 24 étape 39 |
| I8 | 2026-02-14 | Audit | Sérialisation Newtonsoft vs System.Text.Json | Corrigé dans cette session mais fragile | Corrigé — Surveiller |
| I9 | 2026-02-14 | Audit | 7 sessions nommées identiquement "Generate Commit Tool Foundry" | Impossible de les distinguer | Ouvert — Cleanup étape B |
| I10 | 2026-02-14 | Audit | 4 conventions de naming différentes | Incohérence, confusion | Ouvert — Cleanup étape D |

| I11 | 2026-02-14 | Cleanup | Pas d'endpoint PUT pour renommer une session | Impossible de corriger les noms des sessions existantes | Ouvert — Ajouter dans une future phase |

## Problèmes résolus

| # | Date résolu | Description | Solution |
|---|-------------|-------------|----------|
| I1 | 2026-02-14 | 10 sessions zombies "running" | Stop + Delete toutes les 10 |
| I2 | 2026-02-14 | 2+9 refs fantômes dans workspaces | DELETE /api/workspaces/{id}/sessions/{sid} x12 |
| I9 | 2026-02-14 | 7 sessions "Generate Commit Tool Foundry" identiques | Supprimé 6, gardé 1 historique (244cb510) |
| I10 | 2026-02-14 | 4 conventions de naming | Convention documentée pour futures sessions |

## Leçons apprises

| # | Date | Leçon |
|---|------|-------|
| L1 | 2026-02-14 | Toujours vérifier par l'interface utilisateur (monitor/CLI), pas par l'API brute |
| L2 | 2026-02-14 | Ne pas sauter de version dans le roadmap — les prérequis existent pour une raison |
| L3 | 2026-02-14 | Nettoyer les sessions de test après chaque phase de travail |
| L4 | 2026-02-14 | Program.cs utilise .AddNewtonsoftJson() → les variables sont JArray/JObject, pas JsonElement |
| L5 | 2026-02-14 | Le coder-agent retournait du texte décrivant les actions, pas des actions réelles — vérifier l'output concrètement |
