# Phase 31 : CLI `maestro code`

**Statut** : A faire
**Prerequis** : Phase 30 COMPLETE (agent autonomous-dev publie, >= 4/5 E2E reussis)
**Objectif** : Un mode interactif TUI pour le developpement, comme Claude Code mais avec les widgets Maestro et l'agent composite.

---

## Vision

`maestro code` est l'experience utilisateur finale. L'utilisateur ouvre un terminal dans son projet, tape `maestro code`, et un agent autonome prend en charge le developpement avec :
- Detection automatique du projet
- Selection de l'agent/tier optimal
- Widgets TUI pour suivre la progression
- Interaction en temps reel (pause, questions, redirection)

---

## Sous-phases

| Phase | Titre | Objectif |
|-------|-------|----------|
| 31-A | Mode interactif de base | La commande `maestro code` fonctionne |
| 31-B | Test et amelioration | Iterer avec l'agent Tier 1 sur Cantante |

---

## Dependances

- Phase 30 fournit l'agent `autonomous-dev` publie et teste
- Les composants TUI existent deja dans `shared/tui/` et `maestro-cli/monitor/ink/`
- Le template `project-autonomous` (30-A-4) est reutilise

---

## Principe

`maestro code` est un FRONTEND pour l'agent — pas un prerequis. L'agent doit fonctionner SANS `maestro code` (via `session invoke`). `maestro code` ajoute :
1. La creation automatique de session
2. L'interface interactive
3. Les widgets de progression

## Risque technique : TUI interactive inline

Le moniteur actuel (Ink) prend le controle complet du terminal (fullscreen). `maestro code` necessite de combiner :
- Un rendu TUI (widgets, execution tree, plan view)
- Un input utilisateur en temps reel (prompt, commandes)
- L'execution de l'agent en background (async)

C'est un defi technique non trivial. Avant de construire les 3 issues de 31-A, **valider la faisabilite** :

### Prototype a faire EN PREMIER (avant 31-A-1)

1. Creer un prototype minimal Ink qui combine : un panel de rendu (texte auto-refresh) + un input utilisateur en bas
2. Verifier que Ink supporte le mode "split" (rendu + input dans le meme terminal)
3. Si Ink ne le supporte pas nativement : evaluer les alternatives (blessed mode, raw terminal, deux panes)

**Si le prototype echoue** : l'alternative est un mode split terminal (agent dans une fenetre, input dans une autre) ou un mode "poll + prompt" (afficher l'etat, attendre l'input, re-afficher).

Le plan 31-A doit etre ajuste apres ce prototype.
