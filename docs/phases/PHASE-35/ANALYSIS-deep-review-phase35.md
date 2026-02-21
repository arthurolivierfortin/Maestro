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

## 5. Refonte des phases — Proposition complete

### Le probleme avec le roadmap actuel

Le roadmap actuel dit :
```
35 Dogfooding → 36 Context/Memory → 37 adapt/optimize → 38 Distribution → 39+ Communaute
```

Trois problemes :
1. La vision "Maestro-powered apps" + "Jarvis" n'apparait nulle part
2. Les features planifiees (docs attachees, sandbox foundry) n'ont pas de phase assignee
3. Les sous-phases 35-C+ ne refletent plus la realite

### Roadmap propose (refonte complete)

```
PHASE 35 — Dogfooding & Stabilisation agent (EN COURS)
├── 35-PRE : Agent composite + tool dispatch                      DONE
├── 35-A  : Pipeline setup + DI fixes                             DONE
├── 35-B  : Scaffold Cantante + corrections agent                 DONE
├── 35-C  : Iterations amelioration (tab, search, theme, etc.)    DONE
├── 35-D  : For-each pipeline + JsonElement fix                   DONE
├── 35-E  : Stabilisation finale
│     ├── Taux de succes agent > 75%
│     ├── Tests automatises du pipeline agent (pas juste manuels)
│     ├── Degradation multi-tiers (le 34-F jamais fait)
│     └── Cout par task simple < $0.10
└── 35-F  : Bilan dogfooding
      ├── Metriques finales, documentation
      └── Cantante v0.1 — 30+ composants, build OK
```

```
PHASE 36 — Contexte, Memoire et Documentation
├── 36-A : Conversation Block
│     └── Extraction formelle de AgentBlockExecutor
├── 36-B : Context Block
│     └── Formalisation du context assembler comme block
├── 36-C : Memory Block
│     └── Connaissances persistantes inter-session
│     └── Prerequis pour Jarvis (memoire conversationnelle)
├── 36-D : Documentation attachee (FEATURE-attached-docs.md)
│     ├── metadata.docs dans BlockDefinition
│     ├── Companion files (README.md, RESEARCH.md, CHANGELOG.md, FITNESS.md)
│     ├── Auto-generation de RESEARCH.md depuis les foundry sessions
│     ├── Variable _docs pour sessions
│     ├── Index global (.maestro/docs/)
│     └── CLI : maestro docs show/edit/search/index
└── 36-E : TUI Context Panel
      └── Observabilite en temps reel du contexte/memoire
```

```
PHASE 37 — Maestro Runtime & SDK
├── 37-A : SDK client npm (@maestro/client)
│     ├── Extraction de MaestroApiClient en package npm publiable
│     ├── Helpers haut niveau : executeBlock(), createSession(), streamExecution()
│     └── Types TypeScript, documentation API
├── 37-B : Mode sidecar
│     ├── Module qui lance backend + LLM-provider comme process enfants
│     ├── Auto-detection des ports, healthcheck, shutdown propre
│     └── npm : @maestro/sidecar
├── 37-C : Blocks audio
│     ├── speech-to-text.tool.block.json (Web Speech API / Whisper wrapper)
│     ├── text-to-speech.tool.block.json (Web Speech API / piper-tts wrapper)
│     └── Fonctionnent comme des blocks normaux dans le pipeline
├── 37-D : Mode vocal dans maestro code
│     ├── Toggle voice ON/OFF a chaud (Ctrl+V ou commande)
│     ├── STT → texte dans le champ input (peripherique d'entree)
│     ├── TTS optionnel pour les reponses
│     └── L'agent ne change pas — il recoit du texte comme d'habitude
└── 37-E : Agent Jarvis (template)
      ├── jarvis.agent.block.json — router d'intentions generique
      ├── Session template "vocal-assistant"
      └── Cantante : premier branchement via @maestro/client
```

```
PHASE 38 — Sandbox Foundry & Tests reproductibles
├── 38-A : Sandbox images (FEATURE-sandbox-foundry.md)
│     ├── SandboxImage entity, SandboxCheckpoint value object
│     ├── ISandboxManager interface
│     ├── GitWorktreeSandboxManager (V1, sans Docker)
│     └── CLI : maestro sandbox create/list/inspect
├── 38-B : Integration foundry sessions
│     ├── maestro session create --sandbox <id> --checkpoint <id>
│     ├── maestro session reset --checkpoint <id>
│     └── Volume de sortie (/output/) pour extraire docs/artifacts
├── 38-C : Batch testing
│     ├── maestro foundry test --sandbox <id> --all-checkpoints
│     ├── Rapport de fitness par checkpoint
│     └── Alimentation automatique du RESEARCH.md (lien Phase 36-D)
└── 38-D : Docker sandbox (V2)
      ├── DockerSandboxManager implementation
      └── Support types non-git (project, data, broken, docs)
```

```
PHASE 39 — maestro adapt + maestro optimize
├── 39-A : maestro adapt
│     ├── Adaptation automatique aux modeles de l'utilisateur
│     └── Manifeste dans les blocks publies (models, fitness, substitutes)
└── 39-B : maestro optimize
      ├── Strategies pluggables d'optimisation
      └── Reduction de cout automatique
```

```
PHASE 40 — Distribution
├── 40-A : Packaging et installation
│     ├── npm install -g @maestro/cli
│     ├── npm install @maestro/client   ← SDK pour apps
│     ├── npm install @maestro/sidecar  ← embarquer Maestro
│     └── Backend .NET comme service installe ou sidecar
├── 40-B : Onboarding premier lancement
│     ├── Detection LLM provider (Claude Code, Anthropic, Azure, Local)
│     ├── Selection modele par defaut
│     └── maestro code fonctionne en < 10 minutes
├── 40-C : Documentation utilisateur
│     ├── Getting Started, User Guide, Block Development
│     ├── "Comment construire une app Maestro" (tutorial @maestro/client)
│     └── FAQ + Troubleshooting
└── 40-D : Beta testing (3-5 testeurs)
```

```
PHASE 41 — Cantante v1 (showcase)
├── 41-A : Integration @maestro/client dans Cantante
│     ├── Sidecar dans le process Electron
│     ├── hooks React : useMaestro, useVoiceAgent
│     └── VoiceControl.tsx (bouton micro, feedback)
├── 41-B : Agent Jarvis specialise Cantante
│     ├── System prompt avec intents specifiques (open file, navigate, read, edit)
│     ├── Foundry session + fitness mesure sur sandbox
│     └── Publication du block
└── 41-C : Case study public
      ├── Documentation du parcours (phases 35 → 41)
      ├── Metriques : cout, fitness, modeles testes
      └── "Comment on a construit Cantante avec Maestro"
```

```
PHASE 42+ — Futur
├── 42 : Catalogue communautaire (publier/importer blocks + docs + sandboxes)
├── 43 : Auth et subscriptions
├── 44 : Evaluateur cloud
├── 45 : Agent Creator (meta-programmation)
└── 46+ : Multi-domaine
```

### Placement des features TODOS

| Feature | Phase | Justification |
|---------|-------|---------------|
| Documentation attachee | **36-D** | Depend de Memory Block (36-C) pour le RESEARCH.md auto-genere. Naturellement place avec les blocks de contexte/memoire — c'est du "savoir attache". |
| Sandbox foundry | **38** | Depend de la documentation attachee (36-D) pour que le batch testing alimente le RESEARCH.md. Ne bloque pas le SDK/vocal, peut etre fait en parallele ou apres. |
| Maestro Runtime (SDK + sidecar) | **37** | Prereq pour les apps Maestro. Doit exister avant la distribution (40) et avant Cantante v1 (41). |
| Mode vocal maestro code | **37-D** | Depend des blocks STT/TTS (37-C). Pas un nouveau mode — un toggle d'input dans maestro code. |
| Jarvis agent | **37-E** (template) + **41-B** (specialise Cantante) | Le template generique arrive avec le SDK. La specialisation Cantante arrive quand Cantante integre le SDK. |

### Pourquoi cet ordre

```
36 (Contexte/Memoire/Docs)
   ↓ prerequis
37 (SDK/Runtime/Vocal)        ← le SDK a besoin du systeme de docs pour les blocks publies
   ↓ prerequis                ← le vocal a besoin de la memoire conversationnelle
38 (Sandbox/Tests)            ← les sandboxes alimentent la doc attachee (36-D)
   ↓ peut etre parallele
39 (adapt/optimize)           ← utilise la fitness des sandboxes pour optimiser
   ↓ prerequis
40 (Distribution)             ← tout doit etre stable pour distribuer
   ↓ prerequis
41 (Cantante showcase)        ← premiere app Maestro complete, preuve de concept publique
```

Chaque phase construit sur la precedente. Pas de "trou" ou une feature depend de quelque chose qui n'existe pas encore.

### Pourquoi PAS le vocal maintenant (pendant 35)

1. **L'agent autonome a 59% de succes** — pas pret pour etre embarque dans une app utilisateur
2. **Pas de Memory blocks** (Phase 36-C) — Jarvis sans memoire conversationnelle est un jouet
3. **Pas de SDK** — Cantante devrait parler HTTP directement au backend, ce qui cree du couplage
4. **Le dogfooding n'est pas fini** — il reste des bugs a trouver (minimap echoue, taches complexes echouent)

### Pourquoi PAS le vocal en Phase 45+ (trop tard)

1. **Cantante perd son sens** — sans le vocal, Cantante est juste un editeur de code de plus
2. **Maestro perd son differenciateur** — "construisez des apps propulsees par des agents" est le pitch
3. **On perd le feedback loop** — chaque phase de Cantante revele des bugs Maestro
4. **Les blocks STT/TTS sont simples** — Web Speech API existe deja dans Cantante (`useSpeechSynthesis.ts`)

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

### Le vocal comme parametre activable, pas un flag de lancement

Le mode vocal doit etre un **parametre activable a chaud** dans `maestro code`, pas un flag `--voice` au lancement. L'utilisateur est deja dans `maestro code`, il active le micro, il parle, le texte s'ecrit dans le champ input comme s'il tapait — puis il desactive.

```
maestro code (TUI interactive)
  ┌─────────────────────────────────────────────┐
  │  Output Panel                               │
  │  ...                                        │
  ├─────────────────────────────────────────────┤
  │  > [input field]              [🎤 ON/OFF]   │
  └─────────────────────────────────────────────┘

  Ctrl+V ou commande : toggle voice mode
  Voice ON  → microphone capture → STT → texte s'ecrit dans l'input
  Voice OFF → retour au clavier normal
```

**Pourquoi pas un flag `--voice`** :
- L'utilisateur ne devrait pas devoir quitter `maestro code` et le relancer pour activer/desactiver le micro
- Le vocal est une **source d'input alternative**, pas un mode different — l'agent recoit le meme texte, qu'il soit tape ou dicte
- Ca permet de mixer : dicter la tache, puis taper une correction avant d'envoyer

**Ce que fait le mode vocal concretement** :
1. Active le STT (Web Speech API, Whisper local, ou autre)
2. Le STT transcrit la voix en texte en temps reel
3. Le texte s'ecrit dans le champ input de `maestro code` (comme si l'utilisateur tapait)
4. L'utilisateur voit ce qui a ete transcrit, peut corriger, puis envoie (Enter)
5. La reponse de l'agent peut optionnellement etre lue par TTS

**L'agent ne change pas** — il recoit du texte comme d'habitude. Le vocal n'est qu'un peripherique d'entree, pas un nouveau pipeline.

### Le Jarvis dans Maestro vs dans Cantante

```
Dans Maestro (maestro code, voice mode ON) :
  Utilisateur parle → STT → texte dans l'input
  → "ajoute un test pour le composant Button"
  → [Enter] → pipeline normal → dev-orchestrator → fichiers modifies
  → Reponse dans l'output panel (+ TTS optionnel)
  → "J'ai cree Button.test.tsx avec 3 tests unitaires"

Dans Cantante (app propulsee par Maestro) :
  Bouton micro dans l'UI
  → STT → "ouvre le fichier App.tsx"
  → Jarvis agent block → intent: open_file, target: App.tsx
  → Action Cantante → fichier ouvert dans l'editeur
  → TTS → "App.tsx est ouvert"
```

**Difference cle** : dans Maestro, le vocal est un **peripherique d'entree** pour le meme pipeline (l'utilisateur dicte au lieu de taper). Dans Cantante, le vocal est le **mode d'interaction principal** — l'agent Jarvis interprete l'intention et controle l'app. Les deux utilisent les memes blocks STT/TTS mais a des niveaux differents.

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

2. **Adopter la refonte du roadmap** (section 5) : rennuméroter les phases, placer les features TODOS, integrer la vision "apps Maestro".

3. **Creer le FEATURE doc** pour "Maestro-powered apps" dans `docs/TODOS/` (SDK, sidecar, vocal toggle — document distinct de cette analyse).

4. **Ne PAS toucher a l'architecture de Cantante maintenant** : continuer le dogfooding tel quel. Le vocal viendra quand le SDK existera (Phase 37).

5. **Extraire `MaestroApiClient` en package npm** : c'est le premier pas concret vers le SDK, a faire en Phase 37-A.

6. **Prototyper le mode vocal dans maestro code** : ajouter un toggle STT dans le TUI (Ctrl+V) qui ecrit dans l'input. Pas besoin du Jarvis complet — juste le peripherique d'entree vocal.

---

## 9. Synthese

### La question "sommes-nous sur la bonne voie ?"

**Oui**, strategiquement. Le dogfooding a revele 29 bugs en 27 sessions — c'est exactement le but. L'agent fonctionne de bout en bout. Cantante compile et a 31 fichiers generes par l'agent.

**Non**, operationnellement. Le roadmap ne reflete plus les sous-phases reelles. Le taux de succes a 59% n'est pas pret pour la distribution. Et la vision "apps Maestro" n'apparaissait nulle part dans les phases planifiees — la refonte proposee corrige ca.

### La question "quand faire le vocal ?"

**Phase 37** (apres Context/Memory/Docs, avant Sandbox/Distribution). Le vocal dans `maestro code` est un toggle d'input (Ctrl+V), pas un nouveau mode — le STT ecrit dans le champ input comme si l'utilisateur tapait. L'agent ne change pas.

### La question "quand placer les features TODOS ?"

| Feature | Phase |
|---------|-------|
| Documentation attachee | 36-D (avec Context/Memory) |
| Sandbox foundry | 38 (phase dediee) |
| SDK + sidecar | 37 (avec le vocal) |

### La question "Cantante construit sur Maestro ?"

**Oui, mais par etapes** :
1. **Maintenant (35)** : construit AVEC Maestro (dogfooding) — on y est
2. **Phase 37** : SDK + blocks audio + toggle vocal dans maestro code
3. **Phase 40** : Distribution avec `@maestro/client` comme package npm
4. **Phase 41** : Cantante v1 comme premiere "app Maestro" avec vocal

### Le vrai differenciateur

La vision ou Maestro est a la fois l'outil qui **construit** les apps ET le runtime qui les **fait tourner** est extremement puissante. C'est ce qui distingue Maestro d'un simple wrapper autour de Claude Code. Le fait que les memes blocks (STT, TTS, agents) soient utilisables dans le CLI ET embarquables dans des apps tierces est le vrai moat.

La refonte proposee (35→41) fait de cette vision un chemin concret avec des dependances claires, pas un "futur lointain" en Phase 42+.
