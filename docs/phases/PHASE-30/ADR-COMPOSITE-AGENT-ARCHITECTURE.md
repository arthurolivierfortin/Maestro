# ADR : Architecture d'agent composite pour autonomous-dev

**Date** : 2026-02-17
**Statut** : Accepted
**Contexte** : Phase 30 — Premier agent autonome

---

## Decision

L'agent `autonomous-dev` est un **workflow composite** de 6 sous-blocs specialises, pas un agent monolithique.

## Contexte

Deux approches etaient possibles pour creer un agent de developpement autonome :

### Option A : Agent monolithique (rejetee)

Un seul agent avec un system prompt massif qui couvre toutes les etapes : comprendre le projet, planifier, coder, tester, reviewer, committer. Un seul appel LLM (ou une boucle agentique avec un seul system prompt).

**Avantages** :
- Plus simple a implementer (un seul bloc)
- Pas de coordination inter-blocs
- Le modele a tout le contexte

**Inconvenients** :
- Context window saturee apres quelques fichiers lus (~200K tokens = limit)
- Qualite qui degrade au fil de la tache (le modele "oublie" les conventions)
- Impossible de substituer le modele par etape (Phase 32)
- Pas de gate de qualite intermediaire
- Pas d'observabilite par etape dans le moniteur TUI

### Option B : Workflow composite (acceptee)

6 blocs specialises orchestres par un workflow `config.nodes` :
- `prepare` (Opus) — comprend le projet, cree la documentation
- `plan` (Opus) — decompose la tache en steps atomiques
- `implement-step` (Sonnet, dans un for-each) — implemente une step avec contexte chirurgical
- `test` (Sonnet) — execute les tests
- `review` (Opus) — evaluation holiste
- `commit` (Sonnet) — git commit propre

Avec une boucle de correction : conditional (score >= 0.8 → commit, sinon fix → re-review, max 2x).

## Raisons de la decision

### 1. La specialisation du contexte est la valeur fondamentale de Maestro

Chaque `implement-step` demarre avec un contexte FRAIS :
- Conventions (~1K tokens) + step courante (~500 tokens) + context_files (~5-10K tokens)
- Total : ~15K tokens → le modele a TOUTE sa capacite

Un agent monolithique apres 10 steps aurait ~150K tokens de contexte → qualite degradee.

### 2. La substitution par bloc est le prerequis de la Phase 32

La structure composite permet de changer le modele de CHAQUE bloc independamment. Un monolithe ne permet pas de dire "Sonnet pour le code, Opus pour la review". C'est la base de l'optimisation multi-tiers.

### 3. L'observabilite par noeud est la valeur du moniteur TUI

Le moniteur affiche l'arbre d'execution avec chaque noeud. Un monolithe serait une seule boite noire. Le composite montre : "prepare ✓ → plan ✓ → step 1/5 ✓ → step 2/5 (en cours) → ..."

### 4. La resilience et le debugging sont critiques

Si une step echoue, on sait LAQUELLE et POURQUOI. Avec un monolithe, un echec est un echec global sans diagnostic.

### 5. La philosophie Maestro l'impose

> "Specialisation over generality. Small specialized LLMs with focused context > large generalist LLMs."

Un monolithe est le contraire exact de la philosophie.

## Consequences

- Chaque sous-bloc doit etre teste individuellement AVANT le composite (Phase 30-B)
- Le for-each handler doit supporter les donnees dynamiques (Phase 30-A-3)
- Le conditional + while doit fonctionner pour la boucle fix (deja supporte, a verifier)
- Le passage de donnees entre noeuds (`_nodeResult_xxx`) doit etre fiable
- La coordination ajoute de la complexite d'infrastructure (vs un monolithe plus simple)

## Alternatives considerees et rejetees

### Agent monolithique avec memory externe

Un seul agent mais avec un systeme de memoire (fichiers .maestro/) pour persister le contexte entre les iterations.

Rejete car : ne resout pas le probleme de context window (le modele doit quand meme LIRE la memoire a chaque iteration, ce qui remplit le contexte).

### Pipeline sequentiel sans for-each

Les 7 blocs en sequence fixe, sans for-each sur le plan.

Rejete car : l'implement-step doit s'executer N fois (une par step du plan). Sans for-each, il faudrait un nombre fixe de noeuds, ce qui est rigide.

## References

- `DESIGN-AUTONOMOUS-DEV.md` — Design complet de l'agent
- `PLAN.md` — Plan d'implementation Phase 30
- `docs/system/philosophy/MAESTRO-PHILOSOPHY.md` — Specialisation over generality
- `docs/phases/PHASE-12/ADR-FOR-EACH-CONTROL-FLOW.md` — for-each comme noeud
