# Phase 37 : Premiere version distribuable

**Statut** : A faire
**Prerequis** : Phase 36 COMPLETE (adapt/optimize fonctionnels)
**Objectif** : Maestro est telechargeble, installable, et utilisable par quelqu'un d'autre.

---

## Vision

A ce stade, Maestro a :
- Un agent autonome fonctionnel avec plusieurs tiers (Phase 34)
- Un mode interactif `maestro code` (Phase 33)
- Un systeme de contexte/conversation/memoire formel (Phase 35)
- Une adaptation automatique aux modeles de l'utilisateur (Phase 36)
- Un CLI poli avec `maestro init` et aliases (Phase 32)

Phase 37 empaquette tout ca en un produit installable.

---

## Sous-phases

| Phase | Titre | Objectif | Effort |
|-------|-------|----------|--------|
| 37-A | Packaging et installation | Script d'installation, prerequisites, setup | 1 semaine |
| 37-B | Onboarding utilisateur | Premier lancement, configuration guidee | 3-5 jours |
| 37-C | Documentation utilisateur | Guides complets, FAQ, troubleshooting | 3-5 jours |
| 37-D | Beta testing | 3-5 testeurs reels, collecte de feedback | 2 semaines |

---

## 37-A : Packaging

L'utilisateur telecharge et installe :

```bash
# Option 1 : npm global
npm install -g @maestro/cli

# Option 2 : Script d'installation
curl -fsSL https://maestro.dev/install.sh | bash
```

Ce qui est installe :
- `maestro` CLI (disponible globalement)
- Backend .NET (demarre en background)
- Templates et blocks systeme (`content/system/`)
- Configuration par defaut (`~/.maestro/`)

Ce qui n'est PAS installe (optionnel) :
- Frontend web (a lancer separement si desire)
- LLM-Provider local (seulement si l'utilisateur veut des modeles locaux)
- Modeles locaux (telechargement separe)

---

## 37-B : Onboarding

Premier lancement :

```bash
$ maestro

Welcome to Maestro v1.0.0

Setup required. Let's configure your environment.

1. LLM Provider
   [ ] Claude Code (detected: claude CLI available)
   [ ] Anthropic API (enter API key)
   [ ] Azure OpenAI (enter endpoint)
   [ ] Local models (requires GPU)

2. Default model
   Recommended: claude-sonnet (via Claude Code)

3. Workspace
   Creating default workspace at ~/.maestro/workspace/

Setup complete! Try:
  maestro code     — Start coding with AI
  maestro health   — Check system status
  maestro help     — See all commands
```

---

## 37-C : Documentation

| Document | Contenu |
|----------|---------|
| Getting Started | Installation, setup, premier usage |
| User Guide | Toutes les commandes, workflows, configuration |
| Block Development | Comment creer ses propres blocks |
| Architecture | Pour les contributeurs |
| FAQ | Questions frequentes |
| Troubleshooting | Problemes connus et solutions |

---

## 37-D : Beta testing

- Recruter 3-5 developpeurs (cercle personnel)
- Leur donner l'installeur + Getting Started
- Observer : ou ils bloquent, ce qu'ils ne comprennent pas, ce qui manque
- Collecter le feedback systematiquement
- Iterer rapidement sur les problemes critiques

---

## Criteres de completion

- [ ] `npm install -g @maestro/cli` fonctionne
- [ ] `maestro` au premier lancement guide l'utilisateur
- [ ] Un developpeur sans contexte peut utiliser `maestro code` en < 10 minutes
- [ ] 3+ beta testeurs ont complete un flow complet avec feedback
