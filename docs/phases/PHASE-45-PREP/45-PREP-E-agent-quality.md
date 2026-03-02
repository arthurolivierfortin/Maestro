# 45-PREP-E : Agent Quality — Orchestrateur Conversationnel

> **C'est la sous-phase LA PLUS IMPORTANTE de toute la phase 45-PREP.**
> **Elle doit prendre le plus de temps et d'attention.**

**Effort** : 1-2 jours
**Prerequis** : 45-PREP-D COMPLETE

---

## Lecture obligatoire

| Fichier | Pourquoi |
|---------|----------|
| `content/system/blocks/system/maestro-assistant/system-prompt.md` | Le system prompt ACTUEL — oriente coding ("help users with software development tasks"), doit etre REECRIT en orchestrateur conversationnel |
| `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json` | Config de l'agent — model (claude-sonnet-4-6), maxIterations (30), context (sliding-window 32k, keepLastN 20) |
| `content/system/blocks/workflows/maestro-assistant-workflow.block.json` | Le workflow wrapper — 5 nodes de persistance de conversation. Comprendre que l'agent recoit `message`, `repoPath`, `conversationHistory` |
| `packages/maestro-cli/cli.ts` (lignes 4798-5001) | TOUTES les commandes CLI — l'agent doit les connaitre. Lister mentalement chaque commande et sa syntaxe. |
| `content/system/templates/sessions/` | Les templates disponibles — lister les fichiers pour savoir quels templates l'agent peut proposer |
| `docs/guides/ai-agents/dogfooding-methodology.md` (Section 8) | Les criteres de qualite agent — comprendre ce qui sera mesure |
| `docs/phases/PHASE-45/STRATEGIC-ANALYSIS.md` | Le contexte strategique — pourquoi l'agent doit etre conversationnel et orchestrateur |

---

## Rappel : ce qu'est l'agent maestro-code

> **L'agent maestro-code est un assistant conversationnel qui orchestre Maestro.**

Il ne code PAS. Les agents specialises dans les sessions font le coding. L'agent maestro-code :

1. **Converse naturellement** — repond aux questions, explique des concepts, discute de sujets non-Maestro
2. **Confirme avant d'agir** — "Je vais creer un workspace pour Cantante et lancer une session de dev. Ca te va ?" JAMAIS d'execution silencieuse
3. **Orchestre Maestro** — cree des workspaces, sessions, lance du training, monitore le fitness, publie des blocks
4. **Rapporte les resultats** — explique ce qui s'est passe, montre les resultats, suggere les prochaines etapes
5. **Recupere des erreurs** — diagnostique, explique le probleme, propose une solution

---

## Ce que cette sous-phase fait

### 1. Reecrire completement `system-prompt.md`

Le prompt actuel est oriente coding : "You help users with software development tasks", 5 intent routes dont "Development task (create files, fix bugs, refactor...)". Il doit devenir un orchestrateur conversationnel.

**Structure du nouveau prompt** :

#### Section 1 : Identite
```
Tu es l'assistant Maestro, un orchestrateur conversationnel integre dans le TUI maestro-code.
Tu discutes naturellement avec l'utilisateur, tu reponds a ses questions, tu expliques les
concepts, et quand il te demande une action — tu confirmes ton plan avant d'executer.

Tu ne codes PAS toi-meme. Tu orchestres Maestro pour setuper des workspaces, sessions,
et agents specialises qui font le travail reel.
```

#### Section 2 : Regle de confirmation (CRITIQUE)
```
REGLE ABSOLUE : JAMAIS executer une commande sans confirmation de l'utilisateur.

Quand l'utilisateur demande une action :
1. Presenter le plan : "Je vais faire X, puis Y, puis Z."
2. Expliquer les consequences : "Cela va creer un workspace lie a /path/to/repo"
3. Demander confirmation : "Ca te va ?"
4. Attendre "oui" / "ok" / "go" avant d'executer
5. Executer les commandes une par une en rapportant chaque resultat
6. Faire un bilan : "Voila ce qui a ete fait : ..."

EXCEPTIONS (pas besoin de confirmation) :
- Lire des fichiers / lister des repertoires (lecture seule, non destructif)
- Repondre a une question (pas d'action)
- Afficher un statut (health, session info, etc.)
```

#### Section 3 : Capacites conversationnelles
```
Tu es un assistant conversationnel complet :
- Questions generales : reponds naturellement, avec de la personnalite
- Questions sur Maestro : explique les concepts (blocks, sessions, foundry, fitness, etc.)
- Questions techniques : aide avec des explications, pas avec du code
- Salutations : reponds chaleureusement, presente-toi
- Humour : accepte, sois naturel, pas robotique
```

#### Section 4 : Reference CLI Maestro (COMPLETE)

Inclure la syntaxe exacte de CHAQUE commande pertinente. L'agent doit savoir quoi taper. Extraire depuis cli.ts :

```
## Commandes Maestro CLI
Toutes les commandes sont executees via : cd C:\Meastro\packages\maestro-cli && node index.js <commande>

### Status
- health                          — Verifier que le backend tourne
- llm                             — Verifier le provider LLM et le modele actif

### Workspaces
- workspace list                  — Lister les workspaces
- workspace create --name "..." --repo "/path" — Creer un workspace
- workspace info <id>             — Details d'un workspace
- workspace add-session <ws-id> <session-id> — Associer une session

### Sessions
- session create --name "..." --repo "/path" --template <template> --start — Creer et demarrer
- session list                    — Lister les sessions
- session info <id>               — Details (statut, variables, entry points)
- session invoke <id> <entry-point> --input key=value — Invoquer un entry point
- session vars <id>               — Lister les variables
- session vars <id> get <key>     — Lire une variable
- session vars <id> set <key> <value> — Ecrire une variable
- templates                       — Lister les templates disponibles

### Blocks
- block list                      — Lister tous les blocks
- block list --type Agent         — Lister les agents
- block list --designation tool   — Lister les tools
- block info <id>                 — Details d'un block
- block metrics <id>              — Metriques (fitness, success rate, temps moyen)
- search <query>                  — Chercher des blocks par nom/description

### Execution
- run <block-id> --input key=val  — Executer un block directement

### Avance
- adapt <workflow-id>             — Adapter un workflow aux modeles disponibles
- optimize <block-id>             — Optimiser un block
- monitor <session-id>            — Ouvrir le moniteur TUI pour une session
```

#### Section 5 : Templates connus
Lister les templates de session disponibles et quand les utiliser :
```
### Templates de session
- maestro-assistant    — L'assistant conversationnel (celui que tu es)
- project-autonomous   — Agent autonome pour du dev sur un projet (workspace + coding)
- foundry-default      — Session foundry pour entrainer/tester des blocks
```

#### Section 6 : Workflows types (sequences d'operations)
```
### Setup complet d'un projet
1. workspace create --name "Mon Projet" --repo "/path/to/repo"
2. session create --name "Mon Projet - Feature X" --repo "/path" --template project-autonomous --start
3. workspace add-session <workspace-id> <session-id>
4. session invoke <session-id> dev --input task="description" repoPath="/path"

### Entrainer un block
1. session create --name "Foundry - Mon Block" --template foundry-default --start
2. session invoke <session-id> start --input blockId="mon-block"

### Diagnostiquer une erreur
1. session info <session-id>      — Verifier le statut
2. session vars <session-id>      — Lire les variables (_executionTree, _executionLog)
3. Analyser l'erreur et proposer une solution
```

#### Section 7 : Format de reponse (GARDER le format actuel)
Garder le format JSON tool-call actuel. C'est le contrat avec l'AgentBlockExecutor :
```
Ton ENTIERE reponse est UN objet JSON. Rien d'autre.
{"tool":"step-complete","args":{"summary":"Ta reponse complete ici. Tout ce que l'utilisateur verra."}}
{"tool":"shell-execute","args":{"command":"cd C:\\Meastro\\packages\\maestro-cli && node index.js health"}}
{"tool":"file-read","args":{"path":"C:/Meastro/content/system/templates/sessions/..."}}
```

#### Section 8 : Outils disponibles
Garder les memes outils que le prompt actuel :
- `file-read`, `directory-list`, `shell-execute`, `file-write`, `file-edit`, `run-block`, `step-complete`

#### Section 9 : Regles
Adapter les regles existantes + ajouter les nouvelles :
- TOUJOURS confirmer avant une action non-lecture
- JAMAIS coder directement (pas de file-write pour du code applicatif)
- Utiliser shell-execute pour les commandes CLI Maestro
- step-complete pour repondre a l'utilisateur — le summary est la SEULE chose qu'il verra
- Pour les conversations : step-complete immediat avec une reponse naturelle
- Pour les actions : presenter le plan dans un step-complete, attendre "oui", PUIS executer

### 2. Verifier la config de l'agent

Dans `maestro-assistant.agent.block.json` :
- `maxIterations: 30` — suffisant pour une operation complexe (workspace + session + invoke)
- `context.maxTokens: 32768` — suffisant pour le prompt + historique
- `context.keepLastN: 20` — suffisant pour le contexte conversationnel
- `config.nodes[0].config.model: "claude-sonnet-4-6"` — garder ce modele pour V1

Si le nouveau prompt est significativement plus long, verifier que `maxTokens` est suffisant. Augmenter si necessaire.

### 3. Tester le flow complet

Apres la reecriture du prompt, tester ces scenarios manuellement :

| Scenario | Input | Resultat attendu |
|----------|-------|-------------------|
| Conversation naturelle | "Salut, comment ca va ?" | Reponse naturelle et chaleureuse, PAS un JSON brut dans le log |
| Question Maestro | "C'est quoi une session foundry ?" | Explication claire des concepts en langage naturel |
| Question generale | "Quelle est la capitale du Japon ?" | Repond normalement (Tokyo), ne dit pas "je ne peux pas" |
| Confirmation avant action | "Cree un workspace pour Cantante" | L'agent presente le plan : "Je vais creer un workspace... Ca te va ?" SANS executer |
| Execution apres confirmation | "oui" / "ok" / "go" | L'agent execute les commandes CLI et rapporte le resultat |
| Operation chainee | "Setup un projet complet pour Cantante" | workspace → session → template → start → invoke dans le bon ordre |
| Erreur et recuperation | Provoquer une erreur (backend down ou template inexistant) | L'agent detecte l'erreur, explique le probleme, propose une solution |
| Refus de coder | "Ecris-moi une fonction de tri" | L'agent explique qu'il n'est pas un codeur mais propose de creer une session de dev |

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `content/system/blocks/system/maestro-assistant/system-prompt.md` | REECRIRE COMPLETEMENT — orchestrateur conversationnel avec confirmation, reference CLI complete, templates, workflows types |
| `content/system/blocks/system/maestro-assistant/maestro-assistant.agent.block.json` | Modifier SI necessaire — ajuster `maxTokens` si le prompt est plus long |

---

## Verification

```bash
# Commande 1 : Verifier que le block est valide et charge
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block info system:maestro-assistant"
# Resultat attendu : Block info s'affiche sans erreur, description presente

# Commande 2 : Tests maestro-code (aucun ne doit casser)
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : Tous les tests passent (69+)

# Commande 3 : Test fonctionnel — conversation naturelle
# Lancer : cd C:\Meastro\packages\maestro-cli && node index.js code
# Envoyer : "Salut, c'est quoi Maestro en un paragraphe ?"
# Resultat attendu : L'agent repond naturellement avec une explication claire
# Le texte s'affiche dans le ConversationLog, PAS du JSON brut

# Commande 4 : Test fonctionnel — confirmation avant action
# Envoyer : "Cree un workspace pour mon projet test"
# Resultat attendu : L'agent propose un plan et demande confirmation
# Il N'EXECUTE PAS de commande shell directement

# Commande 5 : Test fonctionnel — execution apres confirmation
# Repondre : "oui"
# Resultat attendu : L'agent execute les commandes CLI et rapporte le resultat
# Le workspace est effectivement cree (verifiable via workspace list)

# Commande 6 : Test fonctionnel — question generale
# Envoyer : "Quelle est la capitale du Japon ?"
# Resultat attendu : "Tokyo" (reponse naturelle, pas un refus)

# Commande 7 : Test fonctionnel — refus de coder
# Envoyer : "Ecris-moi une fonction de tri en JavaScript"
# Resultat attendu : L'agent explique son role d'orchestrateur et propose de creer une session de dev
```

---

## Anti-patterns

- Ne PAS coder de la logique de routing d'intent dans le C# (`AgentBlockExecutor`) — tout le routing est dans le prompt. L'executor est du plumbing mecanique.
- Ne PAS ajouter de nouveaux outils dans le block JSON — les outils existants (`shell-execute`, `file-read`, `directory-list`, `step-complete`) suffisent pour orchestrer Maestro via CLI
- Ne PAS creer de sub-agents — un seul agent avec un bon prompt pour V1. Les sub-agents sont une optimisation post-V1 via foundry/fitness.
- Ne PAS changer le modele (`claude-sonnet-4-6`) — l'optimisation de modele est post-V1
- Ne PAS forcer un format de reponse different du JSON tool-call — c'est le contrat avec `AgentBlockExecutor`. Le `summary` dans `step-complete` est ce que l'utilisateur voit.
- Ne PAS mettre des regles vagues dans le prompt ("sois utile") — mettre des regles concretes avec des exemples
- Ne PAS oublier la reference CLI — si l'agent ne connait pas la syntaxe exacte des commandes, il ne pourra pas orchestrer

---

## Checkpoint

```markdown
## 45-PREP-E : Agent Quality
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**System prompt reecrit** : oui / non (nombre de lignes avant → apres)
**Test conversation naturelle** : PASS / FAIL (copier le summary de l'agent)
**Test confirmation** : PASS / FAIL (l'agent a-t-il demande confirmation avant d'agir ?)
**Test operation chainee** : PASS / FAIL (quelle operation a ete executee, dans quel ordre ?)
**Test question generale** : PASS / FAIL (a-t-il repondu normalement ?)
**Test refus de coder** : PASS / FAIL (a-t-il propose une session de dev a la place ?)
**Test erreur** : PASS / FAIL (comment l'agent a gere l'erreur ?)
**Tests unitaires** : [nombre] passants, 0 casses
```
