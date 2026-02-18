# Phase 31 : Solidification des fondations

**Statut** : EN COURS
**Prerequis** : Phase 30-C COMPLETE (autonomous-dev v3, 3/3 tests passing)
**Tag de depart** : `v0.1.0-alpha`
**Objectif** : Rendre operationnel tout ce qui existe. Publier, utiliser, corriger.

---

## Contexte

Phase 30-C a prouve que l'architecture Maestro fonctionne : un workflow composite
de 8 noeuds produit des vrais commits sur de vrais repos. Mais le systeme n'a jamais
ete utilise de bout en bout comme prevu : aucun block publie, aucun fitness mesure,
aucune session foundry reelle. 85+ blocks existent comme fichiers JSON mais seuls 8
ont ete testes end-to-end.

La Phase 31 Presolidification (P1-P5) a corrige les bugs critiques (TUI memory leaks,
phase display, json-validator generique, version conflict protection, quality gates,
provenance tracking). Il reste P4-A : publier les blocks.

**Principe** : Arreter de construire. Commencer a utiliser.

---

## Sous-phases

| Phase | Titre | Objectif | Effort |
|-------|-------|----------|--------|
| 31-A | Publier les blocks Phase 30 | P4-A : 8 blocks dans le catalogue via approval flow | 0.5 jour |
| 31-B | Audit et nettoyage des blocks | Trier les 85+ blocks : actifs vs placeholders | 1 jour |
| 31-C | Usage reel sur Cantante | 3 vraies taches via autonomous-dev, documenter les problemes | 2-3 jours |
| 31-D | Corrections post-usage | Fixer ce que 31-C revele (prompts, erreurs, UX) | 3-5 jours |
| 31-E | Guide quickstart | Doc "comment utiliser maestro en 5 minutes" | 0.5 jour |

---

## 31-A : Publier les blocks Phase 30

Executer la procedure P4-A documentee dans `PHASE-31-PRESOLIDIFICATION/README.md` :

```bash
cd C:\Meastro\maestro-cli

# Publier les 8 blocks (sous-blocks d'abord, workflow en dernier)
node index.js block publish project-preparer --metadata '{"sourceSessionId":"phase-30","modelUsed":"claude-sonnet","trainingIterations":7,"finalFitness":1.0}'
node index.js block publish task-planner --metadata '{"sourceSessionId":"phase-30","modelUsed":"claude-sonnet","trainingIterations":7,"finalFitness":1.0}'
node index.js block publish implement-single-step --metadata '{"sourceSessionId":"phase-30","modelUsed":"claude-sonnet","trainingIterations":7,"finalFitness":1.0}'
node index.js block publish test-executor --metadata '{"sourceSessionId":"phase-30","modelUsed":"claude-sonnet","trainingIterations":7,"finalFitness":1.0}'
node index.js block publish code-reviewer --metadata '{"sourceSessionId":"phase-30","finalFitness":1.0}'
node index.js block publish git-committer --metadata '{"sourceSessionId":"phase-30","modelUsed":"claude-sonnet","trainingIterations":7,"finalFitness":1.0}'
node index.js block publish step-validator --metadata '{"finalFitness":1.0}'
node index.js block publish json-validator --metadata '{"finalFitness":1.0}'
node index.js block publish autonomous-development --metadata '{"sourceSessionId":"phase-30","modelUsed":"claude-sonnet","trainingIterations":7,"finalFitness":1.0}'

# Lister et approuver
node index.js approval list
# node index.js approval approve <id>  (pour chaque)
```

**Critere de completion** : `maestro catalog` affiche 9 blocks avec version et type.

---

## 31-B : Audit et nettoyage des blocks

Passer en revue les 85+ blocks dans `content/system/blocks/`. Pour chaque :

1. **Actif** : Le block fonctionne, a ete teste, est utilise par un workflow.
   → Reste en place.

2. **Placeholder** : Le JSON existe mais le contenu est vide, le prompt est generique,
   ou le block n'a jamais ete invoque.
   → Deplacer vers `content/system/blocks/_drafts/`

3. **Legacy** : Le block a ete remplace par un autre (ex: l'ancien `autonomous-task`
   vs le nouveau `autonomous-development`).
   → Supprimer.

**Categories suspectes a auditer en priorite** :
- `system/` (20+ blocks : orchestrator-agent, trainer-agent, etc. — probablement placeholders)
- `system/strategies/` (10 strategies — probablement placeholders)
- `system/ui/` (5 UI blocks — probablement placeholders)
- `workflows/foundry/` (7 workflows — partiellement fonctionnels)

**Critere de completion** : Chaque block a un statut clair. Le catalogue ne contient que des blocks actifs.

---

## 31-C : Usage reel sur Cantante

Choisir 3 taches REELLES pour le projet Cantante et les executer via autonomous-dev.

**Procedure pour chaque tache** :
```bash
cd C:\Meastro\maestro-cli

# 1. Creer une session
node index.js session create --type project --name "Cantante - <Feature>" --repo "C:\Cantante" --template project-autonomous --start

# 2. Lancer le monitor
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"

# 3. Invoquer l'agent
node index.js session invoke <session-id> dev --input task="<description>" repoPath="C:\Cantante"
```

**Documenter pour chaque tache** :
- La tache demandee
- Le resultat (succes/echec/partiel)
- Les problemes rencontres (prompt, erreur, UX, monitor)
- Le temps total
- Le commit produit (si succes)

**Critere de completion** : 3 taches executees, journal complet dans `PHASE-31/journal-usage.md`.

---

## 31-D : Corrections post-usage

Fixer les problemes identifies en 31-C. Probablement :
- Prompts d'agents a ajuster
- Gestion d'erreurs manquante
- Cas limites non geres (fichiers inexistants, tests qui crash, etc.)
- UX du CLI (messages d'erreur, format de sortie)

**Critere de completion** : Les 3 taches de 31-C fonctionnent apres corrections.

---

## 31-E : Guide quickstart

Ecrire `docs/guides/users/quickstart.md` :

```markdown
# Quickstart : Utiliser l'agent autonome Maestro

## Prerequis
- Backend en cours d'execution
- LLM-Provider avec au moins un modele configure

## 1. Creer une session
maestro session create --type project --name "Mon Projet - Feature" --repo <chemin> --template project-autonomous --start

## 2. Lancer le monitor (optionnel mais recommande)
maestro monitor <session-id>

## 3. Donner une tache a l'agent
maestro session invoke <id> dev --input task="Ajouter un bouton de login" repoPath="<chemin>"

## 4. Observer
L'agent va : analyser le projet → planifier → implementer etape par etape → tester → reviewer → committer.
```

**Critere de completion** : Un developpeur qui n'a jamais vu Maestro peut suivre le guide et obtenir un commit.

---

## Documents

| Document | Contenu |
|----------|---------|
| `PHASE-31-PRESOLIDIFICATION/` | Issues P1-P5 (bugs corrigees avant cette phase) |
| `PHASE-31-PAUSE/COMPREHENSIVE-ANALYSIS.md` | Analyse complete du projet (reference) |
| `PHASE-31-PAUSE/NOTES.md` | Notes de travail pour continuite |
| `PHASE-31/journal-usage.md` | A creer pendant 31-C |
