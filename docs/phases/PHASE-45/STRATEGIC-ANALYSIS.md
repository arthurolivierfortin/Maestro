# Analyse stratégique — Avant Phase 45 (Distribution)

> **Date**: 2026-03-02
> **Contexte**: Le projet stagne. L'utilisateur ressent un blocage mental sur la direction. Cette analyse adresse les problèmes de fond avant de continuer.

---

## 1. Le diagnostic honnête

### 1.1 Le chiffre qui résume tout

**79% des 50 phases ont été de l'infrastructure ou du refactoring. 21% ont produit des fonctionnalités utilisables.**

Ce n'est pas normal. L'architecture Maestro est ambitieuse, mais l'ambition architecturale a systématiquement pris le dessus sur la livraison de valeur. Résultat : après 7 semaines et 50 phases, le produit fait essentiellement **une chose** — envoyer un message à un agent via un TUI et afficher sa réponse. Claude Code fait ça en 0 phases.

### 1.2 Le cycle destructeur

Le pattern qui se répète :

```
Phase N   : Construire une feature
Phase N+1 : Dogfooding → trouver des problèmes
Phase N+2 : Refactorer la feature
Phase N+3 : Tester le refactoring
Phase N+4 : Re-dogfooder → trouver d'autres problèmes
Phase N+5 : Stabiliser
```

**Exemples concrets** :
- **Spatial TUI** : Phase 41 (construit) → Phase 42 (jeté, tout refait) = 1 semaine perdue
- **Monorepo** : Phase 33 → 33-B → 33-C → 33-D = 4 phases pour réorganiser des fichiers
- **Agent** : Phase 34 → 34-E-PRE → 35-PRE → 35-E = 2+ semaines de refactoring
- **Tests** : Phase 40-42 (vitest passe) → Phase 43 (vitest ≠ réalité) = 1 semaine perdue

**~10-12 jours de rework évitable sur 7 semaines**, soit 21% du temps total.

### 1.3 Les erreurs récurrentes que tu commets

Je vais être direct, comme demandé.

**Erreur 1 : Tu optimises avant de livrer.**
Tu veux que chaque feature soit parfaite architecturalement avant de passer à la suivante. Résultat : tu ne livres jamais. Phase 45 (distribution) était censée arriver il y a des semaines. Au lieu de ça, tu as passé du temps sur des détails que les utilisateurs ne verront même pas.

**Erreur 2 : Tu confonds "l'architecture idéale" avec "l'architecture nécessaire".**
"Everything is a block" est un excellent principe directeur. Mais tu l'appliques comme un dogme absolu, ce qui te paralyse. Tu te demandes "est-ce que cette conversation devrait être un block?" au lieu de "est-ce que cette feature marche?".

**Erreur 3 : Tu refactores au feeling.**
Tu l'as dit toi-même : "j'ai tendance à refactorer car ce n'est pas à mon goût." Le goût n'est pas un critère de refactoring. Les critères valides sont : bug, performance, maintenabilité mesurable, feature impossible sans refactoring. "Je n'aime pas comment c'est structuré" n'est pas un de ces critères.

**Erreur 4 : Tu dogfoodes superficiellement.**
34 sessions en Phase 35, 8 en Phase 44. Les chiffres semblent bien. Mais les sessions sont courtes, les tâches sont simples (créer un README, ajouter ESLint). Tu n'as jamais dogfoodé un workflow multi-étapes complexe sur Cantante. Tu n'as jamais tenu un vrai dogfooding de 2h où tu utilises Maestro comme si c'était ton seul outil. Le dogfooding superficiel ne trouve que les bugs superficiels.

**Erreur 5 : Tu redéfinis l'UX à chaque cycle.**
La navigation de maestro-code a changé 3+ fois. Page-based, spatial, monitor-based. Maintenant tu veux command-based. Chaque changement coûte 1-2 semaines. Le problème n'est pas le paradigme de navigation — c'est que tu n'as pas figé l'UX avant de coder.

---

## 2. Clarification des paradoxes

### 2.1 Le paradoxe "Everything is a block" vs le pragmatisme

**Le principe "everything is a block" a un scope précis : le domaine de Maestro.**

Il signifie :
- Tout **composant d'un workflow** est un block (agents, tools, validators, conditions)
- Tout block a des **métriques** et peut être **optimisé**
- Le système de découverte est **unifié**

Il ne signifie PAS :
- Le TUI doit être construit avec des blocks
- Le CLI doit être un block
- SessionManager doit être un block
- La conversation manager doit être un block

**La ligne de démarcation est claire** : ce qui passe par le moteur d'exécution (`EntryPointExecutor` → `BlockExecutorRegistry`) est un block. Ce qui est de l'UI/infrastructure est du code normal.

```
┌─────────────────────────────────────────────────────────┐
│  COUCHE UI/INFRA (code normal, React, TypeScript)       │
│  ├── maestro-code (TUI React/Ink)                       │
│  ├── maestro-cli (commands)                             │
│  ├── maestro-client (SDK)                               │
│  └── maestro-sidecar (process manager)                  │
│                                                         │
│  Ces composants ne sont PAS des blocks.                 │
│  Ce sont l'infrastructure qui CONSOMME des blocks.      │
├─────────────────────────────────────────────────────────┤
│  COUCHE EXÉCUTION (tout est un block)                   │
│  ├── workflows (orchestration)                          │
│  ├── agents (spécialisation, composite)                 │
│  ├── tools (atomiques)                                  │
│  ├── validators, conditions, loops                      │
│  └── inference blocks (LLM calls)                       │
│                                                         │
│  Ces composants SONT des blocks.                        │
│  Ils ont des métriques, du fitness, sont optimisables.  │
└─────────────────────────────────────────────────────────┘
```

**Concrètement pour ton blocage** : Tu n'as pas besoin de faire une `ConversationManager` en block. Tu as besoin d'un `ConversationManager` en code TypeScript/C# dans l'infra, qui gère l'état des conversations. L'agent block (qui EST un block) utilise cette infra pour ses conversations. Le block ne sait pas comment la conversation est stockée — c'est un détail d'implémentation de l'infra.

### 2.2 Le paradoxe "maestro-code se construit elle-même"

**C'est un objectif de Phase 49-50, pas un prérequis de Phase 45.**

Le bootstrapping fonctionne par étapes :

| Phase | Qui construit quoi | Comment |
|-------|--------------------|---------|
| 45 (maintenant) | Humain construit maestro-code | Code direct, React/Ink |
| 46 | Maestro (via blocs) développe Cantante | `autonomous-dev-v3` fait le travail |
| 49-50 | Maestro améliore ses propres blocs | Agent Creator + Evaluator |
| Future | Maestro modifie son propre TUI | Meta-agent avec accès au code |

**Tu n'as pas besoin que maestro-code soit fait de blocks MAINTENANT.** Tu as besoin que :
1. Le TUI **utilise** des blocks pour exécuter des tâches (c'est le cas via sessions/entry points)
2. L'agent principal **soit** un block (c'est le cas : `maestro-assistant-workflow`)
3. Les outils de l'agent **soient** des blocks (c'est le cas : `file-read`, `file-write`, etc.)

Le TUI lui-même est du code React. Point. Il n'y a pas de paradoxe.

### 2.3 Le paradoxe "command-based TUI" vs "page navigation"

**Le vrai problème n'est pas CLI vs pages. C'est que tu as 6 pages dont 5 ne servent à rien pour la V1.**

Regardons l'usage réel en dogfooding Phase 44 :
- **Agent page** : 100% du temps. Envoyer des messages, voir les résultats.
- **Home page** : Jamais utilisée pour du travail réel.
- **Spaces page** : Vue les workspaces, mais aucune action utile.
- **Foundry page** : Pas utilisée en dogfooding (pas de training).
- **Catalog page** : Navigation de blocs, mais pas d'action.
- **Models page** : Consultatif uniquement.

**Ma recommandation : ne change pas le paradigme de navigation. Élimine les pages inutiles.**

Pour Phase 45 (distribution), maestro-code devrait démarrer sur l'Agent par défaut. Les autres pages (Spaces, Foundry, Catalog, Models) restent accessibles — elles sont utiles pour surveiller des sessions, checker les modèles, et gérer les blocks pendant que l'agent travaille. Mais la PRIORITÉ est la qualité de l'agent, pas l'ajout de features aux pages secondaires.

Si tu veux une approche command-based, c'est simple :
- Le TUI démarre directement sur l'agent
- Des slash commands (`/spaces`, `/models`, `/foundry`) ouvrent les autres vues
- Ça fait exactement ce que tu veux (`cd sessions` → `/sessions`) sans refonte architecturale
- C'est **déjà compatible** avec le modèle actuel (TaskInputBar + slash commands)

```
Slash commands (dans TaskInputBar) :
  /help          → Overlay d'aide
  /spaces        → Vue workspaces (si implémenté plus tard)
  /models        → Vue modèles (si implémenté plus tard)
  /new           → Nouvelle conversation
  /clear         → Effacer le log
  /stop          → Annuler la tâche en cours
  /quit          → Quitter

Navigation hotkeys (pour le futur) :
  Ctrl+1         → Agent (toujours disponible)
  Ctrl+2         → Spaces
  Ctrl+3         → etc.
```

**Aucune refonte nécessaire.** Tu gardes le modèle actuel, tu masques les pages non-essentielles, tu ajoutes des slash commands progressivement.

---

## 3. Ce que Phase 45 devrait RÉELLEMENT être

### 3.1 Ce que la roadmap dit

> "Maestro installable et utilisable par quelqu'un d'autre."

Sous-phases prévues :
- 45-A : Packaging & installation (npm global + SDK)
- 45-B : First-launch onboarding
- 45-C : Documentation utilisateur
- 45-D : Beta testing (3-5 testeurs)

### 3.2 Ce qui bloque réellement

On a une chaîne de dépendances artificiellement longue :

```
Phase 44 (DONE) → 44-B (stabilisation) → 44-C (TUI features) → 45 (distribution)
```

Phase 44-B (8 sous-phases) et 44-C (8 sous-phases) = **16 sous-phases** avant de commencer la distribution. Au rythme actuel (2-3x overrun), ça fait **4-6 semaines supplémentaires**.

### 3.3 Ce que je recommande : Couper impitoyablement

**Skip 44-B et 44-C en tant que prérequis.** Voici pourquoi :

Phase 44-B inclut :
- Security (path traversal, shell injection) → **Nécessaire pour distribution**
- Data integrity (BlocksController.Update) → Pas pour V1 (lecture seule suffit)
- TUI stability (scroll, StatusBar) → **Nécessaire**
- SDK contract (Models page) → Pas pour V1 (pas de page Models en V1)
- Persistent conversations → **Nécessaire**
- Slash commands + task cancellation → **Nécessaire** (partiellement)
- Session reuse + working directory → **Déjà fait** (SessionManager persiste)
- Validation dogfooding → Intégré au process

Phase 44-C inclut :
- Foundry vs Catalog → **Pas pour V1** (pas ces pages)
- Block creation from Foundry → **Pas pour V1**
- Help overlay → Déjà fait en Phase 44
- Context/token display → Nice-to-have
- Error display + retry → **Nécessaire**
- Git status → Nice-to-have
- Dead code cleanup → Oui, mais 1h max
- Final dogfooding → Intégré

**Résultat : sur 16 sous-phases, 5 sont nécessaires pour la V1.**

### 3.4 Plan révisé

```
Phase 45-PREP (1 semaine max) :
├── Security : path traversal + shell injection
├── TUI : scroll fix, error display
├── Conversations persistantes (ADR Option B)
├── Slash commands essentiels (/help, /new, /clear, /stop)
├── Dead code cleanup
└── Dogfooding de validation (2h, tâches complexes sur Cantante)

Phase 45 (2 semaines max) :
├── 45-A : npm package, global install, sidecar auto-start
├── 45-B : `maestro init` + first-launch flow
├── 45-C : README, getting started, 3 exemples
└── 45-D : Beta test (3 personnes)
```

**3 semaines au lieu de 8-10.** C'est la différence entre livrer en mars et livrer en mai.

---

## 4. L'architecture de maestro-code pour la V1

### 4.1 Ce qu'elle devrait être

```
maestro code
  │
  ├── Agent Screen (page par défaut)
  │   ├── TaskInputBar (en bas, toujours visible)
  │   │   ├── "/" pour activer
  │   │   ├── Slash commands pour actions (/help, /new, /clear, /stop)
  │   │   └── Texte normal → conversation avec l'agent
  │   │
  │   ├── ConversationLog (au centre)
  │   │   ├── Messages user (style terminal "> message")
  │   │   ├── Messages agent (réponses conversationnelles + confirmations)
  │   │   ├── Status nodes (▶ running, ✓ completed, ✗ error)
  │   │   └── Tool calls (CLI commands, file reads, etc.)
  │   │
  │   └── StatusBar
  │       ├── Session ID, État (idle/working/error), Modèle actif
  │
  ├── Spaces (h:s) — Workspaces, sessions en cours, repos
  ├── Foundry (h:f) — Sessions de training, fitness
  ├── Catalog (h:c) — Blocks disponibles
  └── Models (h:m) — Modèles LLM, providers
```

L'agent est conversationnel : il discute, explique, confirme, puis agit. Les autres pages montrent l'état du système (sessions en cours, training, modèles) et sont essentielles pour l'utilisation quotidienne.

### 4.2 Ce qui reste block-based (et c'est bien)

- L'agent (`maestro-assistant-workflow`) est un block
- Ses outils (`file-read`, `file-write`, `shell-execute`) sont des blocks
- Son système de prompts est dans des fichiers `.md` liés au block
- Tout passe par le backend via sessions/entry points
- L'agent est **optimisable** via foundry (fitness, model switching)

**C'est ÇA la valeur de "everything is a block"** — pas que le TUI soit fait de blocks, mais que l'agent sous-jacent soit traçable, mesurable, et remplaçable.

### 4.3 Ce qui NE devrait PAS être block-based

- Le TUI (React/Ink) → code normal
- Le SessionManager → service TypeScript
- La conversation (affichage) → composant React
- Le routing de slash commands → switch/case TypeScript
- Le polling du backend → setInterval TypeScript

**Arrête de te demander si ces composants devraient être des blocks. La réponse est non. Ce sont de l'infrastructure qui consomme des blocks.**

---

## 5. Les valeurs oubliées de Maestro

### 5.1 "Remplacer un gros LLM par des petits spécialisés"

C'est la raison d'être de Maestro. Et en ce moment, les agents spécialisés dans les sessions utilisent un seul modèle. La spécialisation viendra avec le pipeline foundry → fitness → publish.

**La V1 a de la valeur différenciante par un autre axe** : l'agent maestro-code ne code pas — il orchestre. Il crée des workspaces, lance des sessions, monitore le training. Aucun outil concurrent ne fait ça. Claude Code code. Cursor code. Maestro orchestre des agents qui codent et s'améliorent.

La multi-model spécialisation (planning avec un model, exécution avec un autre) viendra naturellement quand les utilisateurs entraîneront leurs propres agents via foundry.

### 5.2 "Self-improvement via fitness"

Le système de fitness existe (adapt, optimize, métriques par block). Mais il n'a jamais été utilisé en production. Aucun block n'a été optimisé via le pipeline foundry.

**Pour la V1, ce n'est pas nécessaire.** Mais pour la V2, c'est LE différenciateur. Planifie-le, mais ne le bloque pas la V1.

### 5.3 "CLI-first, agents utilisent le même CLI"

C'est partiellement vrai. Le CLI existe, les sessions sont gérées par le CLI, l'agent invoque des entry points CLI. Mais le CLI a 8877 lignes dans un seul fichier avec @ts-nocheck. C'est un monolithe.

**Pour la V1, ça passe.** Pour la V2, il faut un framework de commandes.

### 5.4 "Domain-agnostic"

Maestro est supposé marcher pour n'importe quel domaine (code, traduction, cuisine). En pratique, 100% du dogfooding est sur du code. L'agent `maestro-assistant` est un agent de développement.

**C'est OK pour la V1.** Le code est le premier cas d'usage. Mais l'infra doit rester générique (vérifié : pas de hardcoding de logique code-spécifique dans le backend).

---

## 6. Recommandations concrètes

### 6.1 IMMÉDIAT — Discipline de livraison

| Règle | Pourquoi |
|-------|----------|
| **Ne pas refactorer sauf si un bug ou une feature l'exige** | Le refactoring cosmétique est le premier tueur de vélocité |
| **Figer l'UX de maestro-code : agent-only avec slash commands** | Plus de changements de paradigme de navigation |
| **Limiter les phases à 3 jours max** | Si ça prend plus, découper en sous-tâches |
| **Dogfooder 2h en continu, pas 15min** | Le vrai test est la fatigue, pas le happy path |
| **Chaque phase doit livrer quelque chose d'utilisable** | Pas de phase "infrastructure only" |

### 6.2 PHASE 45-PREP — La liste exacte (1 semaine)

1. **Security** : Valider les paths (pas de `../../../etc/passwd`), sanitiser les inputs shell
2. **Conversations persistantes** : Sauver/recharger l'historique de conversation entre sessions
3. **Slash commands** : `/help`, `/new`, `/clear`, `/stop`, `/quit`
4. **Error display** : Quand un node échoue, montrer l'erreur dans le ConversationLog
5. **Masquer les pages non-essentielles** : Garder UNIQUEMENT l'Agent page comme page par défaut. Les autres pages existent dans le code mais ne sont pas dans la nav par défaut.
6. **Dead code** : Supprimer les 4 composants inutilisés identifiés
7. **Dogfooding de validation** : 2h sur Cantante, tâches complexes (pas des README)

### 6.3 PHASE 45 — Distribution (2 semaines)

1. **`npm install -g @maestro/cli`** — Package global installable
2. **`maestro init`** — Crée `.maestro/` dans le projet courant, configure le provider
3. **`maestro code`** — Lance le TUI agent-first
4. **`maestro code --headless --task "..."`** — Mode CI
5. **Sidecar auto-start** — Backend + LLM-Provider démarrent automatiquement
6. **Getting Started** — Doc de 2 pages : install → init → première tâche
7. **3 beta-testeurs** — Feedbacks réels

### 6.4 POST-V1 — Ce qui peut attendre

| Feature | Phase estimée |
|---------|---------------|
| Pages Spaces, Foundry, Catalog, Models | 46+ |
| Block creation TUI | 46+ |
| Multi-model agents (spécialisation réelle) | 46+ |
| Fitness pipeline en production | 49 |
| Agent Creator (meta-agent) | 50 |
| Self-improvement | 50+ |

---

## 7. Comment arrêter le cycle de régression

### 7.1 La règle du "Good Enough"

Avant chaque phase, écrire explicitement :

```markdown
## Definition of Done
- [ ] Feature X fonctionne pour le cas d'usage principal
- [ ] Pas de régression sur les tests existants
- [ ] Dogfooding de 30 min minimum

## Ce qui N'EST PAS dans le scope
- Refactoring de Y (existant et fonctionnel)
- Optimisation de Z (pas de problème de perf mesuré)
- Support du cas edge W (< 5% des utilisateurs)
```

### 7.2 Le budget de refactoring

**Max 20% du temps d'une phase peut être du refactoring.** Si tu dépasses, tu t'arrêtes et tu livres l'état actuel. Le refactoring restant va dans une phase dédiée APRÈS la livraison.

### 7.3 Le test avant le code

Avant de coder une nouvelle feature UI :
1. Écrire le test visuel (PTY capture) d'abord
2. Écrire le test unitaire d'abord
3. Implémenter le minimum pour que les tests passent
4. S'arrêter là

---

## 8. Résumé décisionnel

| Question | Réponse | Justification |
|----------|---------|---------------|
| **Refaire l'UX command-based ?** | **Non.** Ajouter des slash commands au modèle actuel. | Coût: 0 semaines vs 2-4 semaines de refonte |
| **Garder 6 pages ?** | **Oui.** Agent par défaut, pages secondaires accessibles. | Utiles pour monitorer sessions/modèles pendant que l'agent travaille |
| **Conversation en block ?** | **Non.** Code TypeScript/C# dans l'infra. | Un block = quelque chose qu'on optimise/mesure. Une conversation n'a pas de "fitness" |
| **Faire 44-B/C complets ?** | **Non.** Extraire les 5 items nécessaires, skip le reste. | Livrer en mars vs livrer en mai |
| **maestro-code se construit elle-même ?** | **Phase 49-50.** Pas maintenant. | Bootstrap impossible sans le système de fitness complet |
| **Multi-modèle pour V1 ?** | **Souhaitable mais non-bloquant.** | Un seul modèle = ça marche. Deux modèles = ça différencie |
| **Changer l'archi blocks ?** | **Non.** L'archi est bonne. Le problème est l'application dogmatique. | "Everything is a block" dans le moteur d'exécution, code normal partout ailleurs |

---

## 9. Le message final

Maestro a une vision puissante. Le concept de blocks spécialisés avec fitness et optimisation automatique est unique sur le marché. Aucun concurrent ne fait ça.

Mais la vision ne vaut rien sans livraison. En ce moment, tu as passé 7 semaines à construire l'infrastructure parfaite et 0 semaines à la mettre entre les mains de quelqu'un d'autre. Claude Code est sorti avec des bugs et des limitations — et ils ont itéré. Cursor est sorti incomplet — et ils ont itéré.

**Phase 45 n'est pas "la première version parfaite". C'est "la première version qui marche assez bien pour que quelqu'un d'autre l'essaie."**

Si dans 3 semaines, un développeur peut faire :
```bash
npm install -g @maestro/cli
cd mon-projet
maestro init
maestro code
> "Ajoute un formulaire de login avec validation"
```

...et que ça marche, même imparfaitement — tu as gagné. Tout le reste (pages, fitness, multi-modèle, agent creator) vient après.

Arrête de construire la cathédrale. Livre la chapelle. Les gens viendront prier, et tu ajouteras les vitraux après.
