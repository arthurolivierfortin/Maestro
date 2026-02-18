# Phase 33 : `maestro code` — Mode interactif

**Statut** : A faire
**Prerequis** : Phase 32 COMPLETE (CLI polish, maestro init, aliases)
**Objectif** : Un mode interactif TUI pour le developpement, comme Claude Code mais avec les widgets Maestro et l'agent composite.

---

## Vision

`maestro code` est l'experience utilisateur finale. L'utilisateur ouvre un terminal
dans son projet, tape `maestro code`, et un agent autonome prend en charge le
developpement avec :
- Detection automatique du projet (via `.maestro/` cree par `maestro init`)
- Selection de l'agent/tier optimal
- Widgets TUI pour suivre la progression (reutilisation des composants du monitor)
- Interaction en temps reel (pause, questions, redirection)

---

## Sous-phases

| Phase | Titre | Objectif | Effort |
|-------|-------|----------|--------|
| 33-A | Prototype TUI interactive | Valider la faisabilite (Ink split: rendu + input) | 1-2 jours |
| 33-B | Mode interactif de base | La commande `maestro code` fonctionne E2E | 3-5 jours |
| 33-C | Test et amelioration | Iterer avec l'agent Tier 1 sur Cantante | 3-5 jours |

---

## 33-A : Prototype TUI interactive

Le moniteur actuel (Ink) prend le controle complet du terminal (fullscreen).
`maestro code` necessite de combiner :
- Un rendu TUI (widgets, execution tree, plan view)
- Un input utilisateur en temps reel (prompt, commandes)
- L'execution de l'agent en background (async)

**A valider AVANT de construire** :
1. Creer un prototype minimal Ink qui combine : un panel de rendu (auto-refresh)
   + un champ input utilisateur en bas
2. Verifier que Ink supporte le mode "split" (rendu + input dans le meme terminal)
3. Si Ink ne le supporte pas : evaluer les alternatives (raw terminal, deux panes)

---

## 33-B : Mode interactif de base

```
$ cd mon-projet
$ maestro code

Maestro v0.2.0 | Model: claude-sonnet | Tier: 1
Project: mon-projet (.maestro/ found)

> Ajouter une page de login avec email/password

[Planning] Analyzing project structure... done
[Planning] Created 5-step plan:
  1. Create LoginPage component
  2. Add authentication service
  3. Add login route
  4. Add form validation
  5. Add tests

Proceed? [Y/n/edit]
> y

[Step 1/5] Creating LoginPage component...
  ✓ Created src/components/LoginPage.tsx (42 lines)
  ✓ Created src/components/LoginPage.test.tsx (28 lines)

[Step 2/5] Adding authentication service...
  ✓ Created src/services/auth.ts (35 lines)
  ...

[Review] Score: 0.85 — Minor suggestions
[Commit] 3 files changed, 105 insertions
  → Committed: feat: add login page with email/password authentication

>
```

**Fonctionnalites** :
- REPL interactif (prompt → agent → resultat → prompt)
- Affichage du plan avec option d'edit avant execution
- Progression step-by-step en temps reel
- User approval gates (Proceed? [Y/n/edit])
- Retry/skip par etape en cas d'echec
- Widgets de progression (reutilisation de `shared/tui/`)

**Ce que `maestro code` fait en interne** :
1. Lit `.maestro/config.json` pour le template et les preferences
2. Cree automatiquement une session project-autonomous
3. Invoke le workflow via l'API (meme mecanisme que `session invoke`)
4. Stream les resultats de `_executionTree` et `_executionLog` en temps reel
5. Affiche les widgets de progression

**Principe** : `maestro code` est un FRONTEND pour l'agent — pas un prerequis.
L'agent fonctionne SANS `maestro code` (via `session invoke`).
`maestro code` ajoute : creation auto de session, interface interactive, widgets.

---

## 33-C : Test et amelioration

- Utiliser `maestro code` sur 5+ taches reelles (Cantante ou autre)
- Documenter chaque session : tache, resultat, problemes, temps
- Iterer sur les prompts, le flow interactif, l'affichage
- Comparer l'experience avec Claude Code : ou est-on meilleur, ou est-on pire

---

## Risque technique

Le defi principal est la TUI interactive inline. Options si Ink fullscreen ne
convient pas :
1. **Mode poll + prompt** : afficher l'etat, attendre l'input, re-afficher
2. **Split terminal** : agent dans une fenetre, input dans une autre
3. **Mode log** : output lineaire comme Claude Code (pas de widgets fullscreen)

L'option 3 (mode log) est la plus pragmatique si le prototype 33-A echoue.
C'est l'approche Claude Code : output lineaire avec des spinners et des indicateurs,
pas de layout fullscreen.

---

## Criteres de completion

- [ ] `maestro code` se lance et detecte le projet
- [ ] L'utilisateur peut donner une tache en langage naturel
- [ ] L'agent planifie et demande approbation
- [ ] L'agent execute etape par etape avec progression visible
- [ ] L'agent commit le resultat
- [ ] L'experience est fluide pour un developpeur habitue a Claude Code
