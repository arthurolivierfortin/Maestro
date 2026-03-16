# Phase 59-PRE-2 : Cost Enforcement — Hard stop, Graceful shutdown, Auto-resume

**Statut** : A faire
**Prerequis** : Phase 59-PRE DONE (limites configurables, historique JSONL, API, TUI /costs, providers)
**Objectif** : Faire en sorte que les limites de couts arretent reellement l'execution, sans corrompre les sessions, avec resume manuel ou automatique.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire le document de la sous-phase AVANT de la commencer** (PHASE-59-PRE-2-A.md, etc.)
3. **Ecrire dans `docs/phases/PHASE-59-PRE-2/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS bloquer PENDANT un block** — seulement AVANT le suivant
5. **Ne PAS mettre la session en statut "error"** — utiliser "idle" (resumable)
6. **Ne PAS perdre les variables de session** lors d'un cost stop
7. **Chaque test planifie DOIT etre implemente** — 47 tests, pas de raccourci

---

## Sous-phases

| Phase | Titre | Effort | Document |
|-------|-------|--------|----------|
| 59-PRE-2-A | Backend : config enforcement + check avant execution + graceful stop | 1 jour | `PHASE-59-PRE-2-A.md` |
| 59-PRE-2-B | Backend : auto-resume detection + resume logic | 0.5 jour | `PHASE-59-PRE-2-B.md` |
| 59-PRE-2-C | TUI + CLI : affichage enforcement, /costs status, parsing | 0.5 jour | `PHASE-59-PRE-2-C.md` |
| 59-PRE-2-T | Tests : 47 tests (15+8+6+4+7+7) | 1 jour | `PHASE-59-PRE-2-T.md` |

---

## Definition of Done

- [ ] Config enforcement (block/warn) + autoResume par limite
- [ ] Backward compat ancien format (nombre simple)
- [ ] Hard stop AVANT le prochain block (pas pendant)
- [ ] Session reste idle apres stop (pas error)
- [ ] Toutes les variables preservees
- [ ] _costStopped* vars renseignees (at, entryPoint, nodeId, autoResume)
- [ ] Resume manuel apres augmentation de limite
- [ ] Resume manuel apres changement enforcement (block → warn)
- [ ] Auto-resume quand quota reset (V1 : detection au prochain appel)
- [ ] Status bar rouge (LIMIT) et jaune (!)
- [ ] Messages conversation rouge/jaune
- [ ] /costs status
- [ ] SpacesScreen indicateur PAUSED
- [ ] CLI --enforcement + --auto-resume
- [ ] 47 tests passent
- [ ] 0 regression sur tests existants

### NOT in scope
- Timer actif pour auto-resume (V1 = detection au prochain appel)
- Notifications push / webhooks
- Limites par provider
- UI de configuration graphique

---

## Analyse de reference

`cost-enforcement-analysis.md` — design complet, exigences, format config, 47 tests detailles

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-59-PRE-2/checkpoint.md`

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 59-PRE-2 : cost enforcement (hard stop, graceful shutdown, auto-resume, 47 tests)"
- Mettre a jour : "Current Project State"
