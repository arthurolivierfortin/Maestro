# Phase 41 : Cantante v1 — Premiere app propulsee par Maestro

**Statut** : A faire
**Prerequis** : Phase 40 COMPLETE (Maestro distribue et installe), Phase 37 COMPLETE (SDK + sidecar + vocal)
**Objectif** : Faire de Cantante la premiere application publique propulsee par Maestro, avec navigation vocale et assistance IA embarquee.

---

## Vision

Cantante est un editeur de code accessible pour les personnes malvoyantes, construit AVEC Maestro (dogfooding Phase 35) et propulse PAR Maestro (cette phase).

```
Construit AVEC Maestro (Phase 35) :
  maestro code → dev-orchestrator → fichiers Cantante

Propulse PAR Maestro (Phase 41) :
  Cantante.exe → @maestro/sidecar → @maestro/client
    → Agent Jarvis specialise → navigation vocale
    → Blocks STT/TTS → interaction voix
    → dev-orchestrator → aide au code en temps reel
```

Cantante est le **showcase** qui demontre que Maestro n'est pas juste un wrapper CLI — c'est une plateforme runtime pour des apps intelligentes.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 41-A | Integration @maestro/client dans Cantante | 1 semaine |
| 41-B | Agent Jarvis specialise Cantante | 1-2 semaines |
| 41-C | Case study public | 3-5 jours |

---

## 41-A : Integration @maestro/client

### Ce que cette sous-phase fait

1. Ajouter `@maestro/client` et `@maestro/sidecar` comme dependances de Cantante
2. Demarrer le sidecar Maestro dans le process Electron main
3. Creer le hook React `useMaestro()` pour appeler des blocks depuis le renderer
4. Creer le hook React `useVoiceAgent()` pour le mode vocal
5. Creer le composant `VoiceControl.tsx` (bouton micro, feedback visuel, TTS output)

### Structure dans Cantante

```
Cantante/
  package.json                    ← + @maestro/client, @maestro/sidecar
  src/
    main/
      index.ts                    ← + sidecar.start() au demarrage
      maestro-sidecar.ts          ← configuration du sidecar
    renderer/
      hooks/
        useMaestro.ts             ← hook generique pour appeler des blocks
        useVoiceAgent.ts          ← hook pour le Jarvis vocal
      components/
        VoiceControl.tsx          ← bouton micro, feedback, TTS
```

### Anti-patterns
- Ne PAS reimplementer le client HTTP — utiliser @maestro/client
- Ne PAS hardcoder les blocks dans le code React — tout passe par le SDK
- Ne PAS rendre le sidecar obligatoire au demarrage — mode offline si Maestro pas dispo

---

## 41-B : Agent Jarvis specialise Cantante

### Ce que cette sous-phase fait

1. Creer `cantante-jarvis.agent.block.json` — specialisation du Jarvis generique (Phase 37-E)
2. System prompt avec les intents specifiques a Cantante :
   - `open_file` : ouvrir un fichier dans l'editeur
   - `navigate` : aller a une ligne/fonction
   - `read_aloud` : lire le contenu d'un fichier
   - `edit_code` : modifier du code via commande vocale
   - `search` : chercher dans le projet
   - `run_command` : executer une commande dans le terminal integre
   - `dev_task` : dispatch vers dev-orchestrator pour les taches de dev
3. Tester dans une foundry session avec sandbox (Phase 38)
4. Mesurer la fitness sur 10+ scenarios vocaux
5. Publier le block quand fitness >= 0.80

### Anti-patterns
- Ne PAS mettre la logique d'intents dans le code TypeScript — tout dans le system prompt du block
- Ne PAS contourner le workflow foundry — tester et publier correctement
- Ne PAS sur-specialiser — garder la possibilite d'ajouter des intents via le prompt

---

## 41-C : Case study public

### Ce que cette sous-phase fait

1. Documenter le parcours complet : Phase 35 (dogfooding) → Phase 41 (app Maestro)
2. Metriques :
   - Combien de sessions de dogfooding, cout total, taux de succes
   - Fitness du Jarvis Cantante par intent
   - Modeles utilises et couts
3. Publier comme guide : "Comment on a construit Cantante avec Maestro"
4. Le guide sert de tutorial pour d'autres developpeurs voulant creer des apps Maestro

### Delivrables

| Document | Contenu |
|----------|---------|
| `case-study-cantante.md` | Recit complet : vision → dogfooding → app Maestro |
| Video demo | 5 minutes : commande vocale ouvre fichier, lit code, modifie |
| Template | `maestro-app-electron` template pour bootstrapper une app Maestro Electron |

---

## Gestion de la memoire

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 41 : Cantante v1 — premiere app propulsee par Maestro. @maestro/client + sidecar dans Electron. Jarvis vocal avec 7+ intents."
- Ajouter : "Template maestro-app-electron disponible"

---

## Criteres de completion

- [ ] Cantante demarre avec le sidecar Maestro (transparent pour l'utilisateur)
- [ ] La commande vocale fonctionne : dicter → intent → action dans l'editeur
- [ ] Au moins 7 intents vocaux fonctionnels (open, navigate, read, edit, search, run, dev)
- [ ] Fitness du Jarvis Cantante >= 0.80 sur sandbox de test
- [ ] Case study publie avec metriques
- [ ] Template `maestro-app-electron` disponible pour d'autres projets
