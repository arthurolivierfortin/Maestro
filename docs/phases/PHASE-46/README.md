# Phase 46 : Solidification de la base de code

**Statut** : A faire
**Prerequis** : Phase 45-PREP COMPLETE
**Objectif** : Eliminer le bug critique du flux provider-setup, ajouter le typage TypeScript et les tests d'integration a `packages/maestro-code/` pour que le premier lancement fonctionne sans erreur.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire UNIQUEMENT le fichier de la sous-phase en cours** (ex: `46-A.md`) — ne PAS lire les fichiers des autres sous-phases pour eviter le biais
3. **Ecrire dans `docs/phases/PHASE-46/checkpoint.md`** apres chaque sous-phase
4. **Aucune fonctionnalite nouvelle** — cette phase est pure stabilisation
5. **Aucune modification backend** — tout le travail est dans `packages/maestro-code/` et `packages/tui/types/`
6. **Les tests doivent passer a chaque etape** — `npm run test:fast` doit rester vert apres chaque fichier modifie
7. **Committer apres chaque sous-phase**

---

## Analyse detaillee

Voir `docs/analysis/MAESTRO-CODE-HONEST-ASSESSMENT.md` pour l'analyse complete du probleme.

---

## Sous-phases

| Phase | Titre | Fichier | Effort |
|-------|-------|---------|--------|
| 46-A | Corriger le bug critique `importSessionTemplate` | `46-A.md` | 1h |
| 46-B | Tests d'integration SessionManager | `46-B.md` | 3h |
| 46-C | Typage TypeScript — fichiers critiques | `46-C.md` | 4h |
| 46-D | Typage TypeScript — composants | `46-D.md` | 3h |
| 46-E | Polish UX (messages, input, erreurs) | `46-E.md` | 2h |
| 46-F | Test end-to-end du flux premier lancement | `46-F.md` | 2h |

**Total estime** : 15h (~2 jours)

---

## NOT in scope

- Refactoring du SessionManager en plusieurs classes
- Ajout de nouvelles pages ou composants
- Modification du backend C#
- Migration vers `strict: true` complet (juste `noImplicitAny` pour V1)
- Tests E2E avec backend reel (couvert par le dogfooding)
- Refactoring de l'architecture des composants revele par le typage

---

## Definition of Done

1. Le bug est corrige : apres provider setup, le premier message fonctionne
2. SessionManager a >= 15 tests couvrant toutes les methodes publiques
3. Zero `@ts-nocheck` dans le package maestro-code
4. `noImplicitAny: true` active dans tsconfig.json
5. `npx tsc --noEmit` passe sans erreur
6. Les messages d'erreur sont actionables
7. Le test `first-run.test.ts` existe et passe
8. `npm run test:fast` passe avec >= 80 tests
9. `npm run test:visual` passe (pas de regression)

---

## Gestion de la memoire

### Checkpoint global
`docs/phases/PHASE-46/checkpoint.md`

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 46 DONE — @ts-nocheck elimine, SessionManager teste, bug provider-setup corrige, noImplicitAny: true"
- Ajouter : "`packages/maestro-code/types.ts` — types centralises (IMaestroCodeApiClient, InteractiveOptions)"
- Mettre a jour le compteur de tests
- Retirer les references aux 35 fichiers @ts-nocheck
