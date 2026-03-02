# Phase 45-PREP : Stabilisation essentielle

**Statut** : A faire
**Prerequis** : Phase 44 COMPLETE (dogfooding pragmatique — 4/4 taches, 8 sessions, 100% succes)
**Objectif** : Rendre maestro-code utilisable au quotidien comme assistant conversationnel qui orchestre Maestro — plus rapide et agreable que les commandes CLI manuelles.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire le fichier de la sous-phase** avant de commencer (ex: `45-PREP-A-security.md`)
3. **Ecrire dans `docs/phases/PHASE-45-PREP/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS refactorer** App.ts, SessionManager, ou le navigation system — fixes chirurgicaux uniquement
5. **Ne PAS creer de nouveaux composants TUI** ou de nouvelles pages
6. **Ne PAS changer l'infrastructure generique** — les changements sont dans le contenu (prompts, blocks) et le TUI client
7. **Tester apres chaque sous-phase** — `npx vitest run tests/` dans maestro-code. Aucun test existant ne doit casser.
8. **L'agent maestro-code est un orchestrateur conversationnel, PAS un codeur** — il orchestre des operations Maestro (workspaces, sessions, training, monitoring). Les agents specialises dans les sessions font le coding.

---

## Sous-phases [OBLIGATOIRE]

| Phase | Fichier | Titre | Effort |
|-------|---------|-------|--------|
| 45-PREP-A | [`45-PREP-A-security.md`](./45-PREP-A-security.md) | Securite : Path Traversal + Shell Injection | 0.5 jour |
| 45-PREP-B | [`45-PREP-B-tui-errors.md`](./45-PREP-B-tui-errors.md) | TUI : Scroll Fix + Error Display | 0.5 jour |
| 45-PREP-C | [`45-PREP-C-conversations.md`](./45-PREP-C-conversations.md) | Conversations Persistantes | 1 jour |
| 45-PREP-D | [`45-PREP-D-slash-commands.md`](./45-PREP-D-slash-commands.md) | Slash Commands Essentiels | 0.5 jour |
| 45-PREP-E | [`45-PREP-E-agent-quality.md`](./45-PREP-E-agent-quality.md) | Agent Quality : Orchestrateur Conversationnel | 1-2 jours |
| 45-PREP-F | [`45-PREP-F-dogfooding.md`](./45-PREP-F-dogfooding.md) | Dogfooding Profond | 0.5 jour |

**Ordre d'execution** : A → B → C → D → E → F (sequentiel — chaque sous-phase depend de la precedente)

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
- Sub-agents (un seul agent avec un bon prompt pour V1)

**Si un de ces items semble necessaire** : le documenter dans `next-phase-items.md` et continuer.

---

## Definition of Done

```
[ ] Security : path traversal + shell injection bloques (tests backend passent)
[ ] TUI : erreurs visibles dans ConversationLog
[ ] Conversations : persistantes entre sessions TUI, /new pour nouvelle conversation
[ ] Slash commands : /help, /new, /clear, /stop, /quit, /status fonctionnels
[ ] Agent quality : conversation naturelle + confirmation avant action + operations Maestro
[ ] Dogfooding : 2h, score >= 3.5/5, notes structurees, comparaison vs CLI
[ ] Aucun test existant casse
[ ] Commit sur main avec tag v0.2.0-alpha
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-45-PREP/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 45-PREP DONE — securite, conversations persistantes, agent orchestrateur conversationnel, dogfooding score X/5"
- Ajouter : "System prompt reecrit — orchestrateur conversationnel avec confirmation, reference CLI complete"
- Retirer : entries liees a "Active phase: 44 DONE. Next: Phase 45"
- Mettre a jour : "Active phase: 45-PREP DONE. Next: Phase 45 (distribution)"

---

## Echec acceptable

Si apres 45-PREP-E (agent quality), le score de dogfooding est < 3.0 :
- Documenter les problemes precis dans `dogfood-notes.md`
- Creer une Phase 45-PREP-B specifiquement pour les fixes agent
- Ne PAS etendre cette phase au-dela d'1 semaine

La regle du "max 3 jours par phase" s'applique a chaque sous-phase, pas a la phase entiere.
