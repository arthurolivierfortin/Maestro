# Phase 45-PREP : Stabilisation essentielle

> **Decision** : 2026-03-02
> **Contexte** : `docs/phases/PHASE-45/STRATEGIC-ANALYSIS.md`
> **Duree max** : 1 semaine
> **Prerequis** : Phase 44 (DONE)

---

## But

Rendre maestro-code utilisable au quotidien. **L'agent est un assistant conversationnel qui orchestre Maestro** — il discute, repond aux questions, explique les concepts, et quand on lui demande une action, il confirme son plan avant d'executer. Il cree des workspaces, sessions, lance des agents specialises, monitore le training, publie des blocks.

Le critere n'est pas "ca code" mais "c'est plus agreable et plus rapide que faire les commandes Maestro a la main, et je peux discuter avec lui naturellement".

---

## Items

### 1. Securite : Path Traversal + Shell Injection (0.5 jour)

Sanitiser les inputs utilisateur avant de les passer aux outils file-read/file-write/shell-execute :
- Pas de `../../../etc/passwd` dans les chemins
- Pas de `;rm -rf /` dans les commandes shell
- Validation dans les tool blocks, pas dans l'infra generique

**Done quand** : Test avec des inputs malveillants → bloque correctement.

### 2. TUI : Scroll Fix + Error Display (0.5 jour)

- Le scroll sur les listes longues ne coupe pas le contenu
- Quand un node echoue dans l'execution tree, le message d'erreur apparait dans le ConversationLog
- L'agent montre les erreurs au lieu de les ignorer silencieusement

**Done quand** : Un node en erreur affiche le message d'erreur visible dans le TUI.

### 3. Conversations Persistantes (1-2 jours)

Sauver et recharger l'historique de conversation entre les sessions TUI :
- Quand l'utilisateur ferme et reouvre `maestro code`, la conversation precedente est visible
- Implementation : sauver dans `.maestro/conversations/` ou via session variables backend
- ADR Option B (backend-side storage via session variables)

**Done quand** : Fermer le TUI, le rouvrir → conversation precedente visible. Nouvelle conversation avec `/new`.

### 4. Slash Commands Essentiels (0.5 jour)

Commandes dans la TaskInputBar :
- `/help` — Affiche les commandes disponibles
- `/new` — Nouvelle conversation (reset l'historique)
- `/clear` — Efface le log visuel
- `/stop` — Annule la tache en cours
- `/quit` — Quitte le TUI

**Done quand** : Chaque commande fonctionne. `/help` liste toutes les commandes.

### 5. Agent Quality : Maestro Orchestrator (1-2 jours)

> **C'est l'item LE PLUS IMPORTANT de la phase.**

L'agent maestro-code est un **assistant conversationnel qui orchestre Maestro**. Il doit :
- **Converser naturellement** — repondre aux questions, expliquer des concepts, discuter de sujets non-Maestro
- **Confirmer avant d'agir** — "Je vais creer un workspace pour Cantante et lancer une session de dev avec le template project-autonomous. Ca te va ?" JAMAIS executer silencieusement
- **Connaitre le CLI Maestro** — workspace, session, foundry, block, monitor, adapt, optimize
- **Chainer les operations** dans le bon ordre (workspace → session → template → start → invoke)
- **Monitorer et rapporter** — verifier le statut, expliquer les resultats, suggerer les prochaines etapes
- **Recuperer des erreurs** — diagnostiquer, expliquer le probleme, proposer une solution

**Actions concretes** :
- Reecrire le system prompt de `maestro-assistant-workflow` :
  - Personnalite conversationnelle (pas un robot qui execute)
  - Regle de confirmation avant action
  - Reference CLI complete, templates disponibles, workflows connus
  - Capacite a discuter de sujets generaux
- S'assurer que l'agent a acces aux tools : `shell-execute` (CLI), `file-read` (configs)
- Verifier le flow complet : conversation → question → confirmation → execution → rapport
- Tester sur un mix de conversations + orchestration (pas uniquement des commandes)

**Done quand** :
1. L'agent repond a "C'est quoi une session foundry?" avec une explication claire
2. L'agent confirme avant d'executer "Cree un workspace pour Cantante"
3. L'agent complete le setup (workspace → session → invoke) et rapporte le resultat

### 6. Dogfooding Profond (0.5 jour)

Suivre la Section 8 de `docs/guides/ai-agents/dogfooding-methodology.md` :
- 2h continu d'orchestration Maestro sur Cantante
- 3 taches d'orchestration minimum (workspace setup, foundry training, session monitoring)
- Scoring sur 10 dimensions
- Comparaison directe avec les commandes CLI manuelles sur au moins 1 tache
- Notes structurees dans `docs/phases/PHASE-45-PREP/dogfood-notes.md`

**Done quand** : Score moyen >= 3.5/5. Aucune dimension < 2. L'utilisateur prefere l'agent aux commandes CLI manuelles.

---

## NOT in scope (ne PAS faire dans cette phase)

- Refactoring de App.ts ou du SessionManager
- Nouveaux composants TUI ou nouvelles pages
- Foundry CRUD dans le TUI
- Git status integration
- Token/context display
- Multi-model support
- Changement de paradigme de navigation (les pages existantes restent telles quelles)
- Tout refactoring cosmetique

**Si un de ces items semble necessaire** : le documenter dans `next-phase-items.md` et continuer.

---

## Definition of Done

```
[ ] Security : path traversal + shell injection bloques
[ ] TUI : erreurs visibles dans ConversationLog
[ ] Conversations : persistantes entre sessions, /new pour reset
[ ] Slash commands : /help, /new, /clear, /stop, /quit fonctionnels
[ ] Agent quality : complete une tache multi-fichiers complexe
[ ] Dogfooding : 2h, score >= 3.5/5, notes structurees
[ ] Aucun test existant casse
[ ] Commit sur main avec tag v0.2.0-alpha
```

---

## Echec acceptable

Si apres l'item 5 (agent quality), le score de dogfooding est < 3.0 :
- Documenter les problemes precis
- Creer une Phase 45-PREP-B specifiquement pour les fixes agent
- Ne PAS etendre cette phase au-dela d'1 semaine

La regle du "max 3 jours par phase" s'applique a chaque item, pas a la phase entiere.
