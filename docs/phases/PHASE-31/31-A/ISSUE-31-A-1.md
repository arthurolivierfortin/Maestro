# Issue 31-A-1 : Commande `maestro code`

**Statut** : A faire
**Estimation** : 2-3 heures
**Bloquant** : Bloque 31-A-2 et 31-A-3
**Prerequis** : Phase 30 complete (autonomous-dev publie)

---

## Description

Implementer la commande `maestro code` qui :
1. Detecte le repo courant (cwd)
2. Cherche `.maestro/` pour la config
3. Cree une session projet automatiquement
4. Lance le mode TUI interactif
5. Execute `prepare` automatiquement

Ce n'est PAS un alias. C'est une vraie experience interactive.

---

## Tache detaillee

### 1. Ajouter la commande dans le CLI

Fichier : `maestro-cli/cli.ts`

La commande doit :
- Detecter le `cwd` comme `repoPath`
- Verifier si `.maestro/` existe (le creer sinon via `MaestroDirectoryInitializer`)
- Creer une session projet avec le template `project-autonomous`
- Demarrer la session
- Lancer le moniteur TUI inline (pas dans une fenetre separee)
- Executer l'entry point `prepare` automatiquement
- Afficher un prompt pour recevoir la tache de l'utilisateur

### 2. Flow utilisateur

```
$ cd C:\Cantante
$ maestro code

  ╔═══════════════════════════════════════════╗
  ║  Maestro Code — Autonomous Development    ║
  ╠═══════════════════════════════════════════╣
  ║  Project: Cantante                        ║
  ║  Stack: TypeScript, React, Electron       ║
  ║  Agent: autonomous-dev (Tier 1)           ║
  ╚═══════════════════════════════════════════╝

  Analyzing project...
  ✓ Stack detected: TypeScript + React + Electron
  ✓ Architecture: feature-based
  ✓ Created .maestro/docs/CONVENTIONS.md
  ✓ Created .maestro/docs/ARCHITECTURE.md

  ? What would you like me to do?
  > _
```

### 3. Gestion de la session

- La session est creee automatiquement avec un nom : `"<project-name> — maestro code <timestamp>"`
- La session est demarree automatiquement
- A la sortie (`Ctrl+C` ou `exit`), la session reste active (l'utilisateur peut la reprendre avec `maestro code --session <id>`)

### 4. Option `--session` pour reprendre

```bash
maestro code                    # Nouvelle session
maestro code --session <id>     # Reprendre une session existante
```

---

## Instructions de test

### Test 1 : Lancement basique

```bash
cd C:\Cantante
node C:\Meastro\maestro-cli\index.js code
```

**Verifications** :
- [ ] Le projet est detecte (nom, stack)
- [ ] La session est creee automatiquement
- [ ] Le `prepare` s'execute et affiche les resultats
- [ ] Un prompt apparait pour la tache

### Test 2 : Execution d'une tache

```bash
# Apres le prompt :
> Create a README.md for the project
```

**Verifications** :
- [ ] L'agent `autonomous-dev` est invoque avec la tache
- [ ] La progression est visible dans le TUI
- [ ] Le resultat est affiche

### Test 3 : Reprendre une session

```bash
# Sortir avec Ctrl+C
# Reprendre :
node C:\Meastro\maestro-cli\index.js code --session <id>
```

**Verifications** :
- [ ] La session existante est chargee
- [ ] L'historique est preserve
- [ ] Le prompt apparait

### Test 4 : Projet sans .maestro/

```bash
mkdir /tmp/new-project
cd /tmp/new-project
echo '{"name":"test"}' > package.json

node C:\Meastro\maestro-cli\index.js code
```

**Verifications** :
- [ ] Le dossier `.maestro/` est cree automatiquement
- [ ] Le prepare detecte le projet minimal
- [ ] Pas de crash

---

## Critere de completion

- [ ] `maestro code` detecte le repo courant
- [ ] Session creee automatiquement avec le bon template
- [ ] `prepare` s'execute automatiquement au lancement
- [ ] Le prompt accepte une tache et invoque `autonomous-dev`
- [ ] `--session <id>` reprend une session existante
- [ ] `Ctrl+C` sort proprement sans crash
- [ ] Projet sans `.maestro/` : creation automatique

---

## Risques

- **Risque CRITIQUE** : Le TUI inline (rendu + input dans le meme terminal) est techniquement complexe
  - Le moniteur Ink actuel prend le terminal en fullscreen — il n'y a pas d'input utilisateur
  - Combiner un rendu auto-refresh + un input interactif necessite un mode "split" pas natif dans Ink
  - **Mitigation** : Faire un prototype minimal AVANT cette issue (voir Phase 31 README). Si Ink ne supporte pas : mode "poll + prompt" (afficher l'etat periodiquement, attendre l'input, re-afficher) ou split terminal.
- **Risque** : Le `prepare` prend trop de temps au lancement (Opus analyse le projet)
  - **Mitigation** : Afficher un spinner avec des etapes visibles pendant le prepare. Si > 60s, afficher un message "This may take a minute for large projects."
- **Risque** : La session creee automatiquement n'est pas nettoyee si l'utilisateur quitte immediatement
  - **Mitigation** : Ajouter un signal handler sur SIGINT qui marque la session comme "interrupted" mais ne la supprime pas (permettre le resume)
