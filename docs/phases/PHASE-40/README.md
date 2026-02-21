# Phase 40 : Premiere version distribuable

**Statut** : A faire
**Prerequis** : Phase 39 COMPLETE (adapt/optimize fonctionnels)
**Objectif** : Maestro est telechargeble, installable, et utilisable par quelqu'un d'autre — incluant le SDK pour construire des apps Maestro.

---

## Vision

A ce stade, Maestro a :
- Un agent autonome fiable avec degradation multi-tiers (Phase 35)
- Un systeme de contexte/conversation/memoire formel (Phase 36)
- Un SDK pour embarquer Maestro dans des apps (Phase 37)
- Des sandboxes reproductibles pour tester des agents (Phase 38)
- Une adaptation automatique aux modeles de l'utilisateur (Phase 39)
- Un mode interactif `maestro code` avec vocal (Phase 37)
- Un CLI poli avec `maestro init` et aliases (Phase 32)

Phase 40 empaquette tout ca en un produit installable.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 40-A | Packaging et installation | 1 semaine |
| 40-B | Onboarding utilisateur | 3-5 jours |
| 40-C | Documentation utilisateur | 3-5 jours |
| 40-D | Beta testing | 2 semaines |

---

## 40-A : Packaging

L'utilisateur telecharge et installe :

```bash
# Option 1 : npm global (CLI + SDK)
npm install -g @maestro/cli

# Option 2 : Script d'installation
curl -fsSL https://maestro.dev/install.sh | bash

# Pour les developpeurs d'apps Maestro
npm install @maestro/client    # SDK client
npm install @maestro/sidecar   # Embarquer le backend
```

Ce qui est installe :
- `maestro` CLI (disponible globalement)
- Backend .NET (demarre en background ou via sidecar)
- Templates et blocks systeme (`content/system/`)
- Configuration par defaut (`~/.maestro/`)
- `@maestro/client` et `@maestro/sidecar` disponibles sur npm

Ce qui n'est PAS installe (optionnel) :
- Frontend web (a lancer separement si desire)
- LLM-Provider local (seulement si l'utilisateur veut des modeles locaux)
- Modeles locaux (telechargement separe)

---

## 40-B : Onboarding

Premier lancement :

```bash
$ maestro

Welcome to Maestro v1.0.0

Setup required. Let's configure your environment.

1. LLM Provider
   [x] Claude Code (detected: claude CLI available)
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

## 40-C : Documentation

| Document | Contenu |
|----------|---------|
| Getting Started | Installation, setup, premier usage |
| User Guide | Toutes les commandes, workflows, configuration |
| Block Development | Comment creer ses propres blocks |
| Building Maestro Apps | Comment utiliser @maestro/client et @maestro/sidecar |
| Architecture | Pour les contributeurs |
| FAQ | Questions frequentes |
| Troubleshooting | Problemes connus et solutions |

---

## 40-D : Beta testing

- Recruter 3-5 developpeurs (cercle personnel)
- Leur donner l'installeur + Getting Started
- Observer : ou ils bloquent, ce qu'ils ne comprennent pas, ce qui manque
- Collecter le feedback systematiquement
- Iterer rapidement sur les problemes critiques
- Tester specifiquement : CLI, maestro code, mode vocal, SDK

---

## Criteres de completion

- [ ] `npm install -g @maestro/cli` fonctionne
- [ ] `npm install @maestro/client` fonctionne
- [ ] `maestro` au premier lancement guide l'utilisateur
- [ ] Un developpeur sans contexte peut utiliser `maestro code` en < 10 minutes
- [ ] La doc "Building Maestro Apps" permet de creer une app avec le SDK
- [ ] 3+ beta testeurs ont complete un flow complet avec feedback
