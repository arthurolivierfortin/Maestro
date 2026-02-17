# Phase 30-B : Construction bottom-up des sous-blocs

**Statut** : A faire
**Prerequis** : 30-A-2 (tools-in-session-context DOIT fonctionner)
**Objectif** : Chaque sous-bloc du composite est teste INDIVIDUELLEMENT avant integration.

---

## Vue d'ensemble

6 issues, une par sous-bloc. Chaque bloc est mis a jour, teste standalone via `node index.js run`, et valide.

| Issue | Bloc | Type | Modele | Estimation |
|-------|------|------|--------|------------|
| 30-B-1 | project-preparer | agent | Opus | 1-2h |
| 30-B-2 | task-planner | agent | Opus | 1-2h |
| 30-B-3 | implement-single-step | agent | Sonnet | 1-2h |
| 30-B-4 | test-executor | agent | Sonnet | 1h |
| 30-B-5 | code-reviewer | inference | Opus | 30min |
| 30-B-6 | git-committer | agent | Sonnet | 30min |

**Ordre recommande** : 30-B-1 → 30-B-2 → 30-B-3 (les trois plus importants, dans l'ordre du pipeline). 30-B-4, 30-B-5, 30-B-6 sont plus independants.

---

## Principe

- **Test standalone obligatoire** : `node index.js run <block-id> --input ...`
- **Pas de test via session** : les tests session viendront en 30-C/30-E
- **`run` ne depend PAS de 30-A-2** : le chemin `run` (execution directe) fonctionne deja. Le bug 30-A-2 affecte uniquement le chemin `session invoke`. Les tests 30-B peuvent donc commencer AVANT que 30-A-2 soit corrige.
- **3 tentatives minimum** : si le premier test echoue, ajuster le prompt et retester
- **Si un modele ne fonctionne pas** : essayer un autre modele avant de declarer echec
- **Utiliser des sandboxes** : tester dans `/tmp/` ou un dossier temporaire, jamais directement sur Cantante
