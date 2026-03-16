# Phase 60 : Model Playground — Tester et diagnostiquer les modeles

**Statut** : A faire
**Prerequis** : Phase 59 COMPLETE (agent isolation)
**Objectif** : Tester un modele directement dans le TUI (via la page Models ou `/playground`), lancer des tests de capability pre-configures, et voir les metriques. Aussi fixer la page Models (actuellement cassee) et ajouter une vue Model Detail utile.
**Duree estimee** : 2-3 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire le document de la sous-phase** avant de la commencer
3. **Ecrire dans `PHASE-60/checkpoint.md`** apres chaque sous-phase
4. **Le PlaygroundView est un COMPOSANT reutilisable** — pas du texte addLine
5. **Verification visuelle via MCP OBLIGATOIRE** pour 60-B

---

## Sous-phases

| Phase | Titre | Effort | Document |
|-------|-------|--------|----------|
| 60-A | Backend : endpoint playground + capability tests (6 tests pre-configures) | 0.5 jour | `PHASE-60-A.md` |
| 60-B | TUI : Models list fix + Model Detail + PlaygroundView + /playground | 1-1.5 jours | `PHASE-60-B.md` |
| 60-C | CLI : `maestro playground` + --test-all + tests unitaires | 0.5 jour | `PHASE-60-C.md` |
| 60-T | Tests : 20 tests (10 backend + 10 TUI) + 8 scenarios visuels | 0.5 jour | `PHASE-60-T.md` |

---

## Flow utilisateur

### Depuis la page Models

```
Page Models → j/k naviguer modeles → Enter → Model Detail → [T] → Playground
```

### Depuis la page Agent

```
/playground → liste modeles → choisir → Playground
/playground gpt-4o → Playground directement
```

### Dans le Playground

```
[1-6] → lance un test de capability pre-configure (✓ PASS / ✗ FAIL)
[/]   → focus input pour un prompt custom
[M]   → changer de modele
[Esc] → retour
```

---

## Definition of Done

- [ ] Page Models affiche les modeles disponibles (plus de "0 models")
- [ ] Model Detail affiche specs, pricing, usage
- [ ] PlaygroundView accessible depuis Models [T] et /playground
- [ ] 6 tests de capability pre-configures avec validation automatique
- [ ] Custom prompt avec reponse + tokens + cout + latence
- [ ] CLI `maestro playground --test-all` donne un score de compatibilite
- [ ] 20 tests passent (10 backend + 10 TUI)
- [ ] 8 scenarios visuels valides
- [ ] 0 regression

### NOT in scope
- Conversation multi-tour (un prompt → une reponse)
- Streaming de la reponse
- Historique des prompts
- Comparaison cote-a-cote de modeles (future phase)
