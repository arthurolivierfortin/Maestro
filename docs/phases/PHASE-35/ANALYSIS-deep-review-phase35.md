# Analyse approfondie — Etat du projet a la Phase 35

**Date** : 2026-02-21
**Auteur** : Claude Code (analyse demandee par l'utilisateur)
**Contexte** : Post dogfooding (27 sessions, 29 bugs, $3.14), mi-parcours Phase 35

---

## 1. Sommes-nous encore sur la bonne voie ?

### Le roadmap initial vs la realite

Le roadmap definit une progression logique :

```
34 (Agent v4) → 35 (Dogfooding) → 36 (Context/Memory blocks) → 37 (adapt/optimize) → 38 (Distribution)
```

**Verdict : la direction est bonne, mais le contenu des phases a mute.**

| Phase planifiee | Ce qui s'est reellement passe | Ecart |
|-----------------|-------------------------------|-------|
| 35-A : Pipeline setup | Fix template none, dispatch agent vs workflow, DI deadlock | Devenu "fix infrastructure de base" |
| 35-B : Scaffold Cantante | Scaffold OK + 7 bugs agent comportementaux | Scaffold fait, mais le gros du travail = corriger l'agent |
| 35-C : Monaco integration | Tab, search, theme, terminal, line numbers + 13 infra fixes | Monaco jamais fait. Devenu "iteration amelioration agent" |
| 35-D : Agent improvement | For-each JsonElement debugging (6 sessions pour 1 bug) | Devenu "debugging serialisation .NET" |

**Ce qu'on observe** : chaque sous-phase planifiee comme "feature Cantante" est devenue en realite "decouvrir et corriger des bugs Maestro". C'est EXACTEMENT ce que le dogfooding devait reveler — le plan a mute mais l'objectif (solidifier Maestro par l'usage reel) est atteint.

### Metriques de sante

| Indicateur | Valeur | Interpretation |
|------------|--------|----------------|
| Taux de reussite sessions | 59% (16/27) | Correct pour un alpha. Les echecs sont informatifs. |
| Cout moyen par task OK | ~$0.13 | Raisonnable pour Claude Code comme backend LLM |
| Bugs trouves et corriges | 29 | Excellent ROI du dogfooding |
| Premier E2E workflow complet | Session 25 | Milestone reel — le pipeline marche de bout en bout |
| Build Cantante | PASS (43 modules, 165 KB) | Le code genere compile — l'agent produit du code valide |

### Points d'alerte

1. **Le roadmap ne reflete plus la realite** : Les sous-phases 35-C a 35-G sont decalees. 35-C etait "Monaco" mais n'a jamais touche Monaco. Le roadmap devrait etre mis a jour pour documenter ce qui a ete fait, pas ce qui avait ete planifie.

2. **Le cost du code-reviewer Opus** : Le reviewer consomme ~75% du cout sur les taches simples. Pour des sessions a $0.50, c'est genable mais pour du volume, ca ne scale pas. La degradation multi-tiers (Phase 34-F) n'a jamais ete faite.

3. **L'agent a 59% de succes** : Bon pour explorer les limites, mais pas pret pour un utilisateur externe. Phase 38 (distribution) ne peut pas arriver tant que ce taux n'est pas > 80%.

4. **Pas de tests automatises pour le pipeline agent** : Les 76 tests existants couvrent le TUI, pas le pipeline d'execution agent. On teste manuellement a chaque session.

### Conclusion sur la trajectoire

**On est sur la bonne voie strategiquement** (profondeur avant largeur, usage reel avant features). Mais **le roadmap operationnel a besoin d'un realignement** : les sous-phases 35-C+ doivent etre renommees pour refleter ce qui a ete fait, et les phases 36-37 doivent etre reevaluees a la lumiere de la nouvelle vision (apps propulsees par Maestro).

---

## 2. L'agent autonome : ou en est-on vraiment ?

### Ce qui marche

- **Pipeline complet** : task → plan → implement → review fonctionne (session 25, 27)
- **Recuperation d'erreurs** : nudge sur reponse vide, context reduction, retry LLM, resume limiter
- **Multi-model** : Opus pour la planification, Sonnet pour l'execution — verifie
- **Tool dispatch** : JSON direct, normalisation des noms, file-edit partiel
- **Isolation** : chaque session est jetable, pas d'etat partage corrompu

### Ce qui ne marche pas encore

- **Minimap** : 2 echecs consecutifs (timeout 600s, --resume corruption)
- **Taches complexes multi-fichiers** : le planner genere du prose au lieu de JSON (session 26)
- **Pas de memoire inter-session** : chaque session repart de zero
- **Pas de validation fonctionnelle** : l'agent ne peut pas verifier que ce qu'il a construit FONCTIONNE (pas de tests, pas de preview)

### Gap critique : l'agent ne peut pas verifier son travail

L'agent ecrit du code qui compile (`npx tsc --noEmit` passe) mais ne peut pas :
- Executer des tests
- Voir le rendu visuel
- Valider le comportement
- Comparer avec une spec

C'est le prochain levier d'amelioration majeur. Les sandbox images (FEATURE-sandbox-foundry.md) addressent partiellement ce besoin.

---

## 3. Vision : Apps propulsees par Maestro

### Le concept

Aujourd'hui Maestro sert a **developper** des apps. La vision est qu'il serve aussi a les **faire tourner** :

```
Aujourd'hui :
  Maestro CLI/Code → [genere du code] → App standalone

Vision :
  Maestro CLI/Code → [genere du code] → App propulsee par Maestro
                                           ↓
                                    L'app UTILISE des blocks/agents Maestro
                                    comme partie de son fonctionnement
```

Concretement pour Cantante :
- L'editeur de code est construit AVEC `maestro code` (dogfooding actuel)
- L'editeur de code TOURNE SUR des blocks Maestro (navigation vocale = agent Maestro)
- L'agent "Jarvis" dans l'app = un agent block qui recoit de l'audio, dispatch vers d'autres blocks, retourne une reponse audio

### Architecture a deux niveaux

```
Niveau 1 : Maestro comme OUTIL DE DEVELOPPEMENT (existe)
  maestro code → dev-orchestrator → [file-read, file-write, file-edit, shell-execute]
  L'humain demande → l'agent code → les fichiers sont modifies

Niveau 2 : Maestro comme RUNTIME APPLICATIF (a construire)
  App Cantante → agent "jarvis" block → [speech-to-text block, intent-router block, tts block]
  L'utilisateur parle → l'agent comprend → l'action est executee → la reponse est parlee
```

Le niveau 2 necessite que Maestro puisse etre **embarque** dans une application, pas seulement utilise depuis un terminal.

### Ce que ca implique architecturalement

| Composant | Existe | A creer | Notes |
|-----------|--------|---------|-------|
| Backend API (port 5000) | Oui | - | Deja un serveur REST + SignalR |
| Block execution engine | Oui | - | Dispatch generique via `BlockExecutorRegistry` |
| Agent agentic loop | Oui | - | `AgentBlockExecutor` multi-turn |
| MCP bridge | Oui | - | 40+ operations exposees |
| SDK client (JS/TS) | Partiel | **SDK npm embarquable** | `MaestroApiClient` existe mais pas packagee |
| Speech-to-text block | Non | **Block STT** | Wrapper Web Speech API ou Whisper |
| Text-to-speech block | Non | **Block TTS** | Wrapper Web Speech API ou piper-tts |
| Intent router block | Non | **Block intent** | LLM qui classifie l'intention |
| Embedded mode | Non | **Maestro embedded** | Backend embarque dans Electron (pas de serveur separe) |
| Vocal agent template | Non | **Template session** | Config du "Jarvis" comme session Maestro |

### Le point crucial : Maestro embedded

Aujourd'hui l'architecture est :

```
Terminal → CLI → HTTP → Backend API (port 5000) → Block executors → LLM-Provider (port 5010)
```

Pour qu'une app comme Cantante soit "propulsee par Maestro", il faut pouvoir faire :

```
App Electron → [Maestro SDK embarque] → Block executors → LLM-Provider
```

**Deux approches possibles :**

**A) Sidecar** : L'app lance le backend Maestro comme process enfant (port local)
```
Cantante.exe
  └── spawn Maestro.Api.exe (port 5000, local only)
  └── spawn LLMProvider.Web.exe (port 5010, local only)
  └── renderer process ← MaestroApiClient → localhost:5000
```
- Avantage : zero changement architectural, fonctionne aujourd'hui
- Inconvenient : 2 process .NET supplementaires, installation lourde

**B) SDK natif** : Un package npm qui parle directement aux blocks sans HTTP
```
Cantante.exe
  └── renderer process
       └── import { MaestroRuntime } from '@maestro/runtime'
       └── runtime.executeBlock('jarvis-agent', { input: audioText })
```
- Avantage : leger, rapide, pas de process supplementaires
- Inconvenient : il faut reimplementer l'execution engine en JS/TS (ou WASM)

**Recommandation : commencer par A (sidecar), evoluer vers B.**

Le sidecar fonctionne immediatement. La configuration `docker-compose.full.yml` fait deja quelque chose de similaire. L'important est de le rendre invisible a l'utilisateur final (l'app lance les services automatiquement, l'utilisateur ne sait pas que Maestro tourne derriere).

---

## 4. Le "Jarvis" : anatomie d'un agent vocal

### Ce que Jarvis serait

```
Utilisateur (voix)
    │ "Ouvre le fichier App.tsx et ajoute un bouton de sauvegarde"
    ▼
┌─────────────────────────────────┐
│  Speech-to-Text Block           │
│  (Web Speech API / Whisper)     │
└───────────────┬─────────────────┘
                │ "Ouvre le fichier App.tsx et ajoute un bouton de sauvegarde"
                ▼
┌─────────────────────────────────┐
│  Jarvis Agent Block             │
│  (LLM intent classification)   │
│  Determine: c'est une tache    │
│  de developpement               │
└───────────────┬─────────────────┘
                │ dispatch vers dev-orchestrator
                ▼
┌─────────────────────────────────┐
│  dev-orchestrator Agent Block   │
│  (pipeline existant)            │
│  plan → implement → review      │
└───────────────┬─────────────────┘
                │ "J'ai ajoute un bouton Save dans App.tsx"
                ▼
┌─────────────────────────────────┐
│  Text-to-Speech Block           │
│  (Web Speech API / piper-tts)   │
└───────────────┬─────────────────┘
                │ audio
                ▼
Utilisateur (entend la reponse)
```

### Ce qui est specifique a Cantante vs generique a Maestro

| Element | Ou ca vit | Pourquoi |
|---------|-----------|----------|
| Speech-to-Text block | **Maestro** (block generique) | Reutilisable par toute app |
| Text-to-Speech block | **Maestro** (block generique) | Reutilisable par toute app |
| Jarvis agent block | **Maestro** (block generique) | Router d'intentions generique |
| Intent vocabulary (ouvrir fichier, ajouter composant...) | **Cantante** (system prompt specifique) | Specifique au domaine de l'app |
| dev-orchestrator | **Maestro** (existe deja) | Reutilisable |
| Voice UI (microphone button, audio output) | **Cantante** (React composant) | Specifique a l'app |
| Voice settings (langue, vitesse, voix) | **Les deux** | Config dans le block TTS + UI dans l'app |

**Ceci respecte la regle cardinale** : l'infrastructure (STT/TTS/router blocks) est generique, le contenu (quels intents, quels prompts) est specifique et vit dans les block configs.

---

## 5. Quand faire quoi ? Proposition de resequencement

### Le probleme avec le roadmap actuel

Le roadmap actuel dit :
```
35 Dogfooding → 36 Context/Memory → 37 adapt/optimize → 38 Distribution → 39+ Communaute
```

Mais la vision "Maestro-powered apps" + "Jarvis" est une **nouvelle dimension** qui traverse ces phases. Si on attend Phase 42 (Agent Creator) pour ca, on perd 6+ mois de temps ou Cantante aurait pu etre le showcase.

### Proposition : inserer "Maestro Runtime" entre 36 et 37

```
35  Dogfooding (en cours — finaliser)
    └── Objectif : agent autonome fiable a > 75% de succes
    └── Delivrable : Cantante v0.1 avec 30+ composants

35-POST  Stabilisation agent
    └── Tests automatises du pipeline agent (pas juste manuels)
    └── Degradation multi-tiers (le 34-F jamais fait)
    └── Cout par task < $0.10 pour les taches simples

36  Context/Memory blocks (tel que planifie)
    └── Necessaire pour Jarvis (memoire conversationnelle)
    └── Necessaire pour l'agent autonome (contexte inter-session)

NEW — 36-B ou 37-ALT : Maestro Runtime
    └── 36-B-A : SDK client npm (@maestro/client)
         Extraire MaestroApiClient en package npm publiable
         Ajouter des helpers haut niveau : executeBlock(), createSession(), etc.
    └── 36-B-B : Mode sidecar
         Script/module qui lance backend + LLM-provider comme process enfants
         Auto-detection des ports, healthcheck, shutdown propre
    └── 36-B-C : Blocks audio
         speech-to-text.tool.block.json (Web Speech API wrapper)
         text-to-speech.tool.block.json (Web Speech API wrapper)
         Les deux fonctionnent comme des blocks normaux dans le pipeline
    └── 36-B-D : Agent Jarvis (template)
         jarvis.agent.block.json — router d'intentions + dispatch
         Session template "vocal-assistant"
         Integration dans maestro shell ou maestro code (commande vocale)

37  maestro adapt + optimize (tel que planifie)

38  Distribution (tel que planifie, mais maintenant INCLUT le SDK)
    └── npm install -g @maestro/cli
    └── npm install @maestro/client  ← NOUVEAU
    └── La doc inclut "Comment construire une app Maestro"

39  Cantante v1 comme showcase
    └── Cantante utilise @maestro/client pour le vocal
    └── Cantante est le premier exemple public d'une "app Maestro"
    └── Publier le case study
```

### Pourquoi PAS maintenant (pendant 35)

La tentation est de commencer le vocal tout de suite dans Cantante. Mais :

1. **L'agent autonome a 59% de succes** — pas pret pour etre embarque dans une app utilisateur
2. **Pas de Context/Memory blocks** (Phase 36) — Jarvis sans memoire conversationnelle est un jouet
3. **Pas de SDK** — Cantante devrait parler HTTP directement au backend, ce qui cree du couplage
4. **Le dogfooding n'est pas fini** — il reste des bugs a trouver (minimap echoue, taches complexes echouent)

### Pourquoi PAS en Phase 42+ (trop tard)

1. **Cantante perd son sens** — sans le vocal, Cantante est juste un editeur de code de plus
2. **Maestro perd son differenciateur** — "construisez des apps propulsees par des agents" est le pitch
3. **On perd le feedback loop** — chaque phase de Cantante revele des bugs Maestro, retarder = moins de cycles d'amelioration
4. **Les blocks STT/TTS sont simples** — Web Speech API existe deja dans Cantante (`useSpeechSynthesis.ts`). Les blocks sont des wrappers.

### Timing recommande

```
Maintenant (35-rest)    : Finir le dogfooding, stabiliser l'agent
Prochain    (36)        : Context/Memory blocks + SDK client npm
Suivant     (36-B)      : Blocks audio + Jarvis template + mode sidecar
Apres       (37)        : adapt/optimize
Apres       (38)        : Distribution (CLI + SDK + showcase Cantante vocal)
```

**Estimation** : le "Jarvis basique" (STT → intent → dispatch → TTS) pourrait etre un prototype fonctionnel en Phase 36-B, soit ~3-4 semaines apres le debut de Phase 36. Pas besoin d'attendre Phase 42.

---

## 6. Impact sur l'architecture de Cantante

### Aujourd'hui : Cantante est un projet test

```
Cantante/
  .maestro/project.json     ← "je suis un projet Maestro"
  src/                       ← code genere par l'agent
  rien d'autre de Maestro
```

L'integration Maestro se limite a : `.maestro/project.json` + les sessions. Cantante ne DEPEND pas de Maestro au runtime.

### Demain : Cantante est une app Maestro

```
Cantante/
  .maestro/project.json
  package.json               ← dependencies: { "@maestro/client": "..." }
  src/
    main/
      maestro-sidecar.ts     ← lance backend + LLM-provider
    renderer/
      hooks/
        useMaestro.ts        ← hook React pour appeler des blocks
        useVoiceAgent.ts     ← hook pour le mode vocal (Jarvis)
      components/
        VoiceControl.tsx     ← bouton micro, feedback audio
```

**La question architecturale cle** : quand ce changement doit-il etre fait ?

**Reponse** : le `.maestro/project.json` et les sessions sont deja en place. Le vrai changement est d'ajouter `@maestro/client` comme dependance npm. Ca ne peut pas arriver avant que le SDK existe (Phase 36-B proposee).

**En attendant**, on peut preparer le terrain :
- Continuer a construire Cantante avec `maestro code` (dogfooding)
- Le `useSpeechSynthesis.ts` qui existe deja dans Cantante est un prototype du futur block TTS
- Quand le SDK sera pret, on branchera le vocal sur le pipeline Maestro au lieu du Web Speech API direct

---

## 7. Mode vocal dans Maestro lui-meme

### Ou le vocal vit dans Maestro

Le user mentionne que le mode vocal pourrait etre dans `maestro shell` ou `maestro code`. Les deux ont des merites :

| Candidat | Avantage | Inconvenient |
|----------|----------|--------------|
| `maestro shell` | REPL interactif, commandes texte, naturel pour le vocal | Pas de TUI riche, pas de monitoring visuel |
| `maestro code` (TUI) | Interface riche, panels, suivi visuel | L'audio + Ink TUI = complexe |
| `maestro code --headless` | Stdin/stdout, facile d'ajouter audio comme source | Pas d'interface visuelle |
| **Nouveau : `maestro voice`** | Dedie, optimise pour l'usage vocal | Un binaire de plus a maintenir |

**Recommandation** : commencer par `maestro code --voice` (flag sur l'existant). Ca ajoute :
1. STT capture en continu (microphone → texte)
2. Le texte est envoye comme input task (meme pipeline que `--headless --task "..."`)
3. La reponse est lue par TTS

C'est un wrapper autour du mode headless, pas un nouveau mode. Si ca prend de l'ampleur, on peut l'extraire en `maestro voice` plus tard.

### Le Jarvis dans Maestro vs dans Cantante

```
Dans Maestro :
  maestro code --voice
  → STT → "ajoute un test pour le composant Button"
  → headless pipeline → dev-orchestrator → fichiers modifies
  → TTS → "J'ai cree Button.test.tsx avec 3 tests unitaires"

Dans Cantante :
  Bouton micro dans l'UI
  → STT → "ouvre le fichier App.tsx"
  → Jarvis agent → intent: open_file, target: App.tsx
  → Action Cantante → fichier ouvert dans l'editeur
  → TTS → "App.tsx est ouvert"
```

**Difference cle** : dans Maestro, le vocal controle le pipeline de DEV (generer du code). Dans Cantante, le vocal controle l'APP (naviguer, editer, lire). Les deux utilisent les memes blocks STT/TTS mais des agents differents.

---

## 8. Risques et recommandations

### Risques identifies

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Over-engineering le SDK avant d'avoir un cas d'usage solide | Elevee | Perte de temps | Faire le SDK minimal (executeBlock + createSession), iterer |
| Le sidecar .NET est trop lourd pour une app Electron | Moyenne | Cantante inutilisable | Prevoir le mode "remote" (backend sur un serveur, pas en local) |
| Le vocal distrait du core (agent autonome fiable) | Elevee | 59% de succes reste a 59% | Finir le dogfooding avant de commencer le vocal |
| Cantante devient un "toy project" jamais fini | Moyenne | Pas de showcase | Definir un MVP Cantante clair et mesurable |
| Le Jarvis est trop ambitieux | Faible | Scope creep | V1 = seulement 5 commandes vocales basiques |

### Recommandations concretes

1. **Finir Phase 35** : porter le taux de succes de l'agent a > 75%. Les sessions 25 et 27 montrent que c'est possible.

2. **Mettre a jour le roadmap** : les sous-phases 35-C+ doivent refleter la realite. Ajouter Phase 36-B (Maestro Runtime) au roadmap.

3. **Creer le FEATURE doc** pour "Maestro-powered apps" dans `docs/TODOS/` (ce qui devrait etre un document distinct de cette analyse).

4. **Ne PAS toucher a l'architecture de Cantante maintenant** : continuer le dogfooding tel quel. Le vocal viendra quand le SDK existera.

5. **Extraire `MaestroApiClient` en package npm** : c'est le premier pas concret vers le SDK et ca peut etre fait des Phase 36.

6. **Prototyper le STT block** : `useSpeechSynthesis.ts` de Cantante montre que Web Speech API marche. Ecrire le block wrapper est ~1 jour de travail.

---

## 9. Synthese

### La question "sommes-nous sur la bonne voie ?"

**Oui**, strategiquement. Le dogfooding a revele 29 bugs en 27 sessions — c'est exactement le but. L'agent fonctionne de bout en bout. Cantante compile et a 31 fichiers generes par l'agent.

**Non**, operationnellement. Le roadmap ne reflete plus les sous-phases reelles. Le taux de succes a 59% n'est pas pret pour la distribution. Et la vision "apps Maestro" n'apparait nulle part dans les phases planifiees.

### La question "quand faire le vocal ?"

**Phase 36-B** (apres Context/Memory blocks, avant adapt/optimize). Pas maintenant (agent pas pret), pas en Phase 42 (trop tard pour Cantante).

### La question "Cantante construit sur Maestro ?"

**Oui, mais par etapes** :
1. Maintenant : construit AVEC Maestro (dogfooding) ← on y est
2. Phase 36-B : premiers blocks audio dans Maestro, mode sidecar
3. Phase 38 : Cantante depend de `@maestro/client` pour le vocal
4. Phase 39 : Cantante est le showcase public d'une "app Maestro"

### Le vrai differenciateur

La vision ou Maestro est a la fois l'outil qui CONSTRUIT les apps ET le runtime qui les FAIT TOURNER est extremement puissante. C'est ce qui distingue Maestro d'un simple wrapper autour de Claude Code. Le fait que les memes blocks (STT, TTS, agents) soient utilisables dans le CLI ET embarquables dans des apps tierces est le vrai moat.

La cle est de ne pas essayer de tout faire en meme temps. L'ordre propose (agent fiable → context/memory → SDK/runtime → vocal → distribution) construit chaque couche sur la precedente.
