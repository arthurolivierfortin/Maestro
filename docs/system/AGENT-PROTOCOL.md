# Agent Execution Protocol

**Version** : 1.0
**Obligatoire** : OUI — tout agent executant une phase DOIT suivre ce protocole.
**Reference** : Ajoute a CLAUDE.md comme lecture obligatoire.

---

## Pourquoi ce protocole existe

Chaque conversation Claude Code repart a zero. Sans protocole, les agents :
- Ecrivent des plans vagues qu'un autre agent ne peut pas executer
- Declarent "DONE" sans verification
- Perdent le contexte inter-session
- Hallucinent l'etat du projet (pretendent que des fichiers existent, que des tests passent)

Ce protocole resout ces problemes via 5 regles.

---

## Regle 1 : Demarrage — Charger le contexte

**AVANT toute action**, l'agent DOIT lire dans cet ordre :

```
1. CLAUDE.md                                    (toujours charge automatiquement)
2. docs/system/AGENT-PROTOCOL.md                (CE fichier)
3. docs/phases/PHASE-XX/README.md               (le plan de la phase en cours)
4. docs/phases/PHASE-XX/checkpoint.md           (l'etat actuel — peut ne pas exister)
5. Les fichiers listes dans "Lecture obligatoire" de la sous-phase courante
```

Si `checkpoint.md` existe et montre qu'une sous-phase est DONE, **ne pas la refaire**.
Si `checkpoint.md` montre BLOQUE, lire le motif et decider si le blocage est leve.

---

## Regle 2 : Execution — Une sous-phase a la fois

L'agent execute UNE sous-phase a la fois, dans l'ordre. Pour chaque sous-phase :

### 2a. Lire la sous-phase
- Lire la section du README.md correspondante
- Lire TOUS les fichiers listes dans "Lecture obligatoire"
- NE PAS sauter cette etape, meme si le fichier semble familier

### 2b. Executer les actions
- Suivre les instructions exactes (fichiers a modifier, commandes a executer)
- Si une instruction est ambigue, chercher dans le code AVANT de deviner

### 2c. Verifier
- Executer TOUTES les commandes de verification listees dans la sous-phase
- Copier-coller le resultat dans le checkpoint
- **REGLE ABSOLUE** : Si la verification echoue, la sous-phase est BLOQUEE, pas DONE

### 2d. Checkpointer
- Ecrire/mettre a jour `docs/phases/PHASE-XX/checkpoint.md` (voir Regle 3)

---

## Regle 3 : Checkpoints — Format obligatoire

Fichier : `docs/phases/PHASE-XX/checkpoint.md`

```markdown
# Phase XX : Checkpoint

**Derniere mise a jour** : YYYY-MM-DD HH:MM
**Sous-phase en cours** : XX-Y
**Agent** : (identifiant ou description de la session)

---

## XX-A : [Titre]
**Statut** : DONE | EN_COURS | BLOQUE | PAS_COMMENCE
**Date** : YYYY-MM-DD
**Ce qui a ete fait** :
- (liste concrete des actions, avec chemins de fichiers)
**Verification** :
- (commande executee + resultat copie-colle, tronque si long)
**Problemes** :
- (si BLOQUE, decrire le probleme exact et ce qui a ete tente)

## XX-B : [Titre]
**Statut** : PAS_COMMENCE
...
```

### Regles du checkpoint
- **Jamais de prose** — listes a puces, pas de paragraphes
- **Chemins absolus** — `C:\Meastro\maestro-cli\cli.ts`, pas "le fichier CLI"
- **Resultats reels** — copier le output de la commande, pas "ca marche"
- **Mise a jour a CHAQUE sous-phase** — pas a la fin

---

## Regle 4 : Anti-hallucination

### Ce qu'un agent ne doit JAMAIS faire

| Interdit | Pourquoi | Faire a la place |
|----------|----------|------------------|
| Dire "le fichier X contient Y" sans l'avoir lu | Hallucination du contenu | `Read` le fichier d'abord |
| Dire "le test passe" sans l'avoir execute | Hallucination du resultat | Executer et copier le output |
| Dire "DONE" quand la verification n'est pas faite | Faux positif | Executer la verification |
| Deviner un ID, un chemin, un nom de variable | Hallucination de donnees | Chercher avec Grep/Glob |
| Supposer qu'un service tourne | Hallucination d'etat | Curl/health check d'abord |
| Dire "pas de changement necessaire" sans investigation | Paresse | Lire le code concerne |

### Verification en 3 temps
Pour chaque action significative :
1. **Avant** : Lire le fichier/l'etat actuel
2. **Pendant** : Faire la modification
3. **Apres** : Verifier que la modification a l'effet attendu (build, curl, test, ls)

---

## Regle 5 : Memoire et handoff

### Pendant l'execution
- Si une decouverte est importante pour les futures sessions, l'ajouter au checkpoint
- Si c'est un pattern reutilisable, l'ajouter a `MEMORY.md` via un fichier topic

### A la fin de la phase
Mettre a jour `MEMORY.md` selon les instructions de la section "Gestion de la memoire" du README.md de la phase.

### Format de handoff
Si l'agent ne peut pas finir (context limit, blocage), il DOIT laisser dans le checkpoint :
```markdown
## Handoff
**Derniere action** : (ce qui a ete fait en dernier)
**Prochaine action** : (exactement ce que le prochain agent doit faire)
**Fichiers en cours de modification** : (liste)
**Etat du build** : (compile/ne compile pas)
**Commande pour reprendre** : (la commande exacte)
```

---

## Metriques de qualite d'un plan de phase

Un plan est BON si un agent sans contexte peut l'executer. Checklist :

- [ ] Chaque sous-phase a une section "Lecture obligatoire" avec des chemins de fichiers
- [ ] Chaque sous-phase a des actions concretes (modifier tel fichier, ajouter telle ligne)
- [ ] Chaque sous-phase a une section "Verification" avec des commandes exactes
- [ ] Chaque sous-phase a une section "Anti-patterns" (ce qu'il ne faut PAS faire)
- [ ] Chaque sous-phase a un format de checkpoint predetermine
- [ ] Le plan ne contient PAS de phrases comme "ameliorer", "optimiser", "nettoyer" sans details
- [ ] Le plan ne contient PAS de references implicites (pas "le fichier principal" — donner le chemin)

---

## Patterns empruntes a OpenClaw

| Pattern OpenClaw | Notre equivalent | Implementation |
|------------------|-----------------|----------------|
| `MEMORY.md` (long-terme, curate) | `memory/MEMORY.md` (index) + fichiers topic | MEMORY.md < 150 lignes, detail dans `memory/*.md` |
| `memory/YYYY-MM-DD.md` (journal) | `docs/phases/PHASE-XX/checkpoint.md` | Un par phase, pas par jour |
| Compaction avant perte de contexte | Checkpoint a chaque sous-phase | L'agent ecrit AVANT de manquer de contexte |
| `SOUL.md` (identite) | `CLAUDE.md` (regles) | Deja en place, garder lean |
| `AGENTS.md` (comportement) | CE fichier (`AGENT-PROTOCOL.md`) | Charge par reference dans CLAUDE.md |

---

## Quand ce protocole s'applique

- **Phases de developpement** (31-37+) : OBLIGATOIRE
- **Recherche/exploration** : Recommande (au minimum le checkpoint)
- **Bug fixes isoles** : Pas necessaire (mais verifier avant de dire DONE)
- **Refactoring** : OBLIGATOIRE (les regressions sont invisibles sans verification)
