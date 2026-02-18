# Phase 31 : Solidification des fondations

**Statut** : EN COURS
**Prerequis** : Phase 30-C COMPLETE, Phase 31-Presolidification P1-P5 DONE
**Tag de depart** : `v0.1.0-alpha`
**Objectif** : Publier, utiliser pour vrai, corriger. Rendre reel ce qui existe.

---

## Regles pour l'agent executant

1. **Lire les fichiers obligatoires** indiques au debut de chaque sous-phase AVANT de commencer
2. **Ecrire dans `PHASE-31/checkpoint.md`** apres chaque sous-phase completee
3. **Ne JAMAIS modifier le backend C#** dans cette phase (sauf 31-D si un bug backend est decouvert)
4. **Ne JAMAIS creer de nouveaux blocks** — cette phase utilise ce qui existe
5. **Verifier chaque etape** avec la commande de verification indiquee
6. **Si bloque** : ecrire le probleme dans `checkpoint.md` et s'arreter. Ne pas inventer de solution.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 31-A | Publier les blocks Phase 30 | 0.5 jour |
| 31-B | Audit et nettoyage des blocks | 1 jour |
| 31-C | Usage reel sur Cantante (3 taches) | 2-3 jours |
| 31-D | Corrections post-usage | 3-5 jours |
| 31-E | Guide quickstart | 0.5 jour |

---

## 31-A : Publier les blocks Phase 30

### Lecture obligatoire avant de commencer
- `docs/phases/PHASE-31-PRESOLIDIFICATION/README.md` (procedure P4-A)
- `docs/phases/PHASE-31-PRESOLIDIFICATION/ISSUE-P4-A.md` (details)
- `docs/guides/users/current-pipeline.md` (flow actuel)

### Prerequis
- Le backend Maestro doit tourner sur port 5000
- Lancer via : `powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1 -SkipLLM`
- Verifier : `curl http://localhost:5000/api/health` doit retourner 200

### Actions (dans cet ordre exact)

```bash
cd C:\Meastro\maestro-cli

# Etape 1 : Verifier que les blocks existent
node index.js block info project-preparer
node index.js block info task-planner
node index.js block info implement-single-step
node index.js block info test-executor
node index.js block info code-reviewer
node index.js block info git-committer
node index.js block info step-validator
node index.js block info json-validator
node index.js block info autonomous-development
# Si un block retourne "not found" → STOP. Documenter dans checkpoint.md.

# Etape 2 : Publier (sous-blocks d'abord, workflow en dernier)
# Note: --metadata est optionnel. Le CLI passe par submitBlockForApproval → POST /api/approvals
node index.js block publish project-preparer
node index.js block publish task-planner
node index.js block publish implement-single-step
node index.js block publish test-executor
node index.js block publish code-reviewer
node index.js block publish git-committer
node index.js block publish step-validator
node index.js block publish json-validator
node index.js block publish autonomous-development

# Etape 3 : Lister les approvals
node index.js approval list
# Noter les IDs retournes

# Etape 4 : Approuver chaque block
# node index.js approval approve <id>
# Repeter pour chaque ID de l'etape 3
```

### Verification
```bash
node index.js block list --type workflow
# Doit montrer autonomous-development
# Si la commande "catalog" existe, l'utiliser aussi
```

### Anti-patterns
- Ne PAS modifier les fichiers .block.json
- Ne PAS changer les versions des blocks
- Si le publish echoue avec une erreur, DOCUMENTER l'erreur exacte dans checkpoint.md

### Checkpoint
Ecrire dans `docs/phases/PHASE-31/checkpoint.md` :
```markdown
## 31-A : Publier les blocks
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocks publies** : (lister les IDs et statuts)
**Problemes** : (lister tout probleme rencontre)
**Approval IDs** : (lister les IDs d'approval)
```

---

## 31-B : Audit et nettoyage des blocks

### Lecture obligatoire avant de commencer
- `docs/phases/PHASE-31-PAUSE/COMPREHENSIVE-ANALYSIS.md` section "Appendix: Block Inventory"
- `CLAUDE.md` section "Everything is a Block"

### Actions

**Etape 1 : Lister tous les blocks**
```bash
# Depuis le CLI
node index.js block list
# Ou directement sur le filesystem
find content/system/blocks -name "*.block.json" | sort
```

**Etape 2 : Pour CHAQUE block, determiner son statut**

Un block est **ACTIF** si il remplit AU MOINS UN de ces criteres :
- Il est reference par le workflow `autonomous-development` (les 8 blocks de Phase 30)
- Il est reference par le workflow `generate-commit-message`
- Il a un `system-prompt.md` non-vide ET un `config` avec du contenu concret
- Il est un tool avec un `scriptFile` qui pointe vers un script existant

Un block est **PLACEHOLDER** si :
- Son `config` est vide ou generique (ex: `"config": {}` ou `"config": {"model": "default"}`)
- Il n'a pas de system-prompt.md ou le prompt est un template generique (< 10 lignes)
- Il n'est reference par aucun workflow actif

Un block est **LEGACY** si :
- Il a ete remplace par un autre (ex: `autonomous-task` remplace par `autonomous-development`)
- Son nom contient un pattern obsolete

**Etape 3 : Creer le dossier _drafts et deplacer**
```bash
mkdir -p content/system/blocks/_drafts
# Deplacer les placeholders (avec leur dossier complet)
# git mv content/system/blocks/system/orchestrator-agent.agent.block.json content/system/blocks/_drafts/
```

**Etape 4 : Supprimer les legacy**
```bash
# git rm content/system/blocks/workflows/autonomous-task.workflow.block.json
```

### Verification
```bash
node index.js block list
# Ne doit montrer QUE des blocks actifs
# Compter : devrait etre ~20-30 actifs, pas 85+
```

### Anti-patterns
- Ne PAS deviner si un block est actif — lire son contenu
- Ne PAS supprimer un block sans verifier qu'aucun workflow ne le reference
- Ne PAS modifier le contenu des blocks — seulement les deplacer ou supprimer

### Checkpoint
Ecrire dans `docs/phases/PHASE-31/checkpoint.md` :
```markdown
## 31-B : Audit blocks
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocks actifs** : (nombre) — (lister les noms)
**Blocks deplaces vers _drafts** : (nombre) — (lister les noms)
**Blocks supprimes (legacy)** : (nombre) — (lister les noms)
**Decisions prises** : (tout block ou le choix n'etait pas evident)
```

---

## 31-C : Usage reel sur Cantante

### Lecture obligatoire avant de commencer
- `content/system/blocks/workflows/autonomous-development.workflow.block.json` (le workflow)
- `content/system/templates/sessions/project-autonomous.session.json` (le template)
- `docs/guides/users/current-pipeline.md`
- Le `checkpoint.md` de 31-A et 31-B (pour savoir l'etat actuel)

### Prerequis
- Backend + LLM-Provider en cours d'execution
- Lancer : `powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1`
- Verifier : `node index.js health` doit montrer backend + LLM OK
- Le repo Cantante doit exister a `C:\Cantante` (ou autre chemin — ajuster)

### Les 3 taches (predefinies pour eviter les mauvais choix)

| # | Tache | Difficulte | Pourquoi cette tache |
|---|-------|-----------|---------------------|
| 1 | "Add a README.md with project description and setup instructions" | Simple | 1 fichier, pas de code, valide le flow de base |
| 2 | "Fix all TypeScript compilation errors" | Moyenne | Necessite lecture de code, modifications multiples |
| 3 | "Create a reusable Button component with variants (primary, secondary, danger)" | Complexe | Creation de fichiers, logique, potentiellement tests |

Si Cantante n'est pas dans un etat ou ces taches font sens, adapter mais garder
le meme gradient de difficulte (simple → moyen → complexe).

### Procedure pour CHAQUE tache

```bash
cd C:\Meastro\maestro-cli

# 1. Creer la session
node index.js session create --type project --name "Cantante - <Tache>" --repo "C:\Cantante" --template project-autonomous --start
# NOTER le session-id retourne

# 2. Lancer le monitor dans une AUTRE fenetre
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id-complet>'"
# ATTENDRE que le monitor affiche la session avant de continuer

# 3. Invoquer l'agent
node index.js session invoke <session-id> dev --input task="<description exacte>" repoPath="C:\Cantante"

# 4. Observer dans le monitor :
#    - Les phases passent-elles de pending → running → done ?
#    - L'execution tree montre-t-elle les etapes ?
#    - Y a-t-il des erreurs dans le log ?

# 5. Apres completion, verifier le resultat :
cd C:\Cantante
git log --oneline -3
git diff HEAD~1
```

### Documenter dans `PHASE-31/journal-usage.md`

Pour CHAQUE tache, ecrire :

```markdown
## Tache N : <description>
**Session ID** : <id>
**Date** : YYYY-MM-DD HH:MM
**Duree** : X minutes
**Resultat** : SUCCES / ECHEC / PARTIEL
**Commit** : <hash> (ou "aucun")

### Ce qui a fonctionne
- (lister)

### Ce qui a echoue
- (lister avec messages d'erreur EXACTS, pas de paraphrase)

### Problemes UX / Monitor
- (lister : messages confus, phases pas mises a jour, etc.)

### Fichiers modifies par l'agent
- (lister)
```

### Anti-patterns
- Ne PAS modifier le code de Cantante manuellement — laisser l'agent faire
- Ne PAS relancer une tache echouee sans documenter l'echec d'abord
- Ne PAS ignorer les erreurs du monitor — les documenter meme si mineures
- Si l'agent hallucine (pretend avoir fait un travail qu'il n'a pas fait), DOCUMENTER exactement ce qui s'est passe

### Checkpoint
Mettre a jour `docs/phases/PHASE-31/checkpoint.md` :
```markdown
## 31-C : Usage reel
**Statut** : DONE / EN COURS / BLOQUE
**Date** : YYYY-MM-DD
**Tache 1** : SUCCES/ECHEC — (resume 1 ligne)
**Tache 2** : SUCCES/ECHEC — (resume 1 ligne)
**Tache 3** : SUCCES/ECHEC — (resume 1 ligne)
**Problemes critiques decouverts** : (lister les showstoppers)
**Journal complet** : voir journal-usage.md
```

---

## 31-D : Corrections post-usage

### Lecture obligatoire avant de commencer
- `docs/phases/PHASE-31/journal-usage.md` (LE document de reference — tout est la)
- `docs/phases/PHASE-31/checkpoint.md` (etat actuel)
- `CLAUDE.md` (pour ne pas violer les regles architecturales)

### Actions

**Etape 1 : Prioriser les problemes du journal**

Lire `journal-usage.md` et classer chaque probleme :

| Priorite | Type | Action |
|----------|------|--------|
| P1 | Crash / erreur bloquante | Fix immediat |
| P2 | Mauvais resultat (prompt a ajuster) | Modifier le system-prompt.md du block |
| P3 | UX penible (message confus, monitor bug) | Documenter pour Phase 32 |
| P4 | Nice-to-have | Ignorer pour maintenant |

**Etape 2 : Pour chaque fix P1/P2**

Identifier le fichier exact a modifier. Les candidats sont :
- `content/system/blocks/agents/<block-id>/system-prompt.md` — ajuster le prompt
- `content/system/blocks/workflows/autonomous-development.workflow.block.json` — ajuster le workflow
- `content/system/blocks/tools/<tool-id>/validate.js` ou `step-validator.js` — ajuster la validation
- `maestro-cli/cli.ts` — uniquement si le probleme est dans le CLI
- `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — uniquement si bug d'execution

**Etape 3 : Apres chaque fix, re-tester**

Relancer la tache qui avait echoue. Comparer le resultat.

### Anti-patterns
- Ne PAS "ameliorer" des choses qui fonctionnent — corriger SEULEMENT ce qui est dans le journal
- Ne PAS ajouter de nouvelles features — cette phase est purement corrective
- Ne PAS modifier l'architecture (pas de nouveaux types de noeuds, pas de nouvelles entites)
- Si un fix necessite un changement architectural → documenter dans checkpoint.md, passer au fix suivant

### Verification
Relancer les 3 taches de 31-C. Les 3 doivent produire un commit valide.

### Checkpoint
```markdown
## 31-D : Corrections
**Statut** : DONE / EN COURS
**Date** : YYYY-MM-DD
**Fixes appliques** : (lister fichier + probleme corrige)
**Re-test tache 1** : SUCCES/ECHEC
**Re-test tache 2** : SUCCES/ECHEC
**Re-test tache 3** : SUCCES/ECHEC
**Problemes reportes a Phase 32** : (lister les P3)
```

---

## 31-E : Guide quickstart

### Lecture obligatoire avant de commencer
- `docs/guides/users/current-pipeline.md`
- `docs/phases/PHASE-31/journal-usage.md` (pour savoir ce qui marche VRAIMENT)
- `docs/phases/PHASE-31/checkpoint.md`

### Action
Creer `docs/guides/users/quickstart.md` avec le contenu suivant
(adapter les commandes selon ce qui a REELLEMENT fonctionne dans 31-C/31-D) :

Le guide doit contenir :
1. **Prerequis** (backend, LLM-Provider, modele configure)
2. **Commandes exactes** (copier-coller, pas de <placeholder> sauf le chemin du repo)
3. **Ce que l'utilisateur va voir** (output attendu du monitor)
4. **Troubleshooting** (les 3 erreurs les plus frequentes rencontrees en 31-C)

### Anti-patterns
- Ne PAS decrire des features qui n'existent pas
- Ne PAS utiliser de commandes qui n'ont pas ete testees en 31-C
- Ne PAS promettre des resultats que l'agent ne produit pas de facon fiable

### Checkpoint
```markdown
## 31-E : Quickstart
**Statut** : DONE
**Date** : YYYY-MM-DD
**Fichier cree** : docs/guides/users/quickstart.md
**Relu et teste** : OUI/NON
```

---

## Gestion de la memoire entre sessions

### Fichier de checkpoint
Le fichier `docs/phases/PHASE-31/checkpoint.md` est le point de reprise.
Un agent sans contexte doit pouvoir :
1. Lire `checkpoint.md`
2. Savoir exactement quelle sous-phase est en cours
3. Savoir ce qui a ete fait et ce qui reste
4. Reprendre sans re-faire le travail deja complete

### Mise a jour MEMORY.md
Apres completion de Phase 31, mettre a jour `C:\Users\arthu\.claude\projects\C--Meastro\memory\MEMORY.md` :
- Retirer les entries obsoletes (ex: "Phase 31-PRESOLIDIFICATION" details)
- Ajouter : "Phase 31 COMPLETE — 9 blocks publies, X blocks actifs, journal dans PHASE-31/"
- Ajouter tout pattern ou bug critique decouvert pendant l'usage reel

### Documents produits par cette phase
| Fichier | Quand | Contenu |
|---------|-------|---------|
| `PHASE-31/checkpoint.md` | Mis a jour apres chaque sous-phase | Etat d'avancement |
| `PHASE-31/journal-usage.md` | Cree en 31-C | Journal detaille des 3 taches |
| `guides/users/quickstart.md` | Cree en 31-E | Guide utilisateur |
