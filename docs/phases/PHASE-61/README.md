# Phase 61 : Premiere version deployable

**Statut** : Planifie
**Prerequis** : Phase 60 COMPLETE (catalogue, auth, contenu)
**Objectif** : `npm install -g @maestro/cli && maestro init && maestro code` fonctionne. L'utilisateur installe, voit les assistants compatibles avec son hardware et leurs features actives, choisit, et commence a travailler. C'est la V1 publique.
**Duree estimee** : 10-15 jours

---

## Ce que l'utilisateur recoit

```
$ npm install -g @maestro/cli
$ maestro init
  > Detecting hardware... RTX 3060 (12GB VRAM), 32GB RAM
  > Choose provider: [1] Local [2] Cloud [3] Hybrid
  >
  > Available assistants for contract "maestro-assistant":
  >   ★ maestro-assistant-mistral7b — 3/5 features (recommended)
  >     maestro-assistant-codellama13b — 4/5 features
  >     maestro-assistant-claude — 5/5 features (cloud, paid)
  >     maestro-assistant-phi3 — 2/5 features (fast, limited)
  >
  > Select [1-4]: 1
  > Ready! Run `maestro code` to start.

$ maestro code
  > Welcome to Maestro Code.
  > Assistant: maestro-assistant-mistral7b (3/5 features)
  > Type a message or /help for commands.
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 59-A | Packaging npm + commande globale + sidecar auto-start | 3-4 jours |
| 59-B | `maestro init` + onboarding complet (contracts, choix assistant) | 2-3 jours |
| 59-C | Documentation : README, Getting Started, exemples | 2-3 jours |
| 59-D | Beta testing (3-5 testeurs externes) | 3-5 jours |

---

## 59-A : Packaging npm

### Taches
1. Package npm `@maestro/cli` avec bin global
2. Sidecar embarque (backend + LLM-Provider)
3. Auto-start, health check, cleanup
4. Cross-platform (Windows, macOS, Linux)
5. `maestro --version`

---

## 59-B : maestro init

### Taches
1. `maestro init` : cree `~/.maestro/`, detecte hardware, config provider, choix assistant par contract
2. `maestro init` dans un projet : cree `.maestro/`, permissions, workspace
3. Idempotent : relancer ne casse rien

---

## 59-C : Documentation

### Taches
1. **README.md** : installation, screenshot, liens
2. **Getting Started** : install → first launch → first conversation → create agent → explore catalog
3. **3 exemples** : dev agent React, doc writer API, adapt for local GPU

---

## 59-D : Beta testing

### Taches
1. 3-5 testeurs developpeurs
2. Protocole : installer, Getting Started, 3 taches, questionnaire
3. Iterer : fixes critiques uniquement, pas de nouvelles features

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

- [ ] `npm install -g @maestro/cli` fonctionne cross-platform
- [ ] `maestro init` configure tout (hardware, provider, assistant par contract)
- [ ] `maestro code` demarre sans intervention manuelle
- [ ] L'utilisateur comprend ses options (features actives/inactives par contract)
- [ ] Le catalogue est accessible avec du contenu
- [ ] Documentation complete
- [ ] 3 testeurs externes reussissent sur leur projet

### Gate
3 testeurs externes installent, choisissent leur assistant, et accomplissent des taches reelles.
