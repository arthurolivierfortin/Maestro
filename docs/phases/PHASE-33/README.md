# Phase 33 : `maestro code` — Mode interactif

**Statut** : A faire
**Prerequis** : Phase 32 COMPLETE (checkpoint.md montre 32-A a 32-C tous DONE)
**Objectif** : La commande `maestro code` lance un REPL interactif qui cree une session, execute l'agent, et affiche la progression.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-33/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier le backend C#** sauf si un endpoint manque pour le streaming
5. **Tester chaque changement** en lancant `maestro code` dans un projet reel
6. **Le mode interactif est un FRONTEND** — l'agent fonctionne SANS lui (via `session invoke`)

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 33-A | Prototype Ink REPL | 1-2 jours |
| 33-B | Commande `maestro code` E2E | 3-5 jours |
| 33-C | Test et iteration sur Cantante | 3-5 jours |

---

## 33-A : Prototype Ink REPL

### Lecture obligatoire
- `maestro-cli/monitor/ink/App.ts` — comprendre le fullscreen actuel (Ink `render()`)
- `maestro-cli/monitor/ink/components/` — lister les composants reutilisables
- `maestro-cli/cli.ts` — comprendre comment les commandes sont enregistrees (chercher `.command(`)
- `shared/tui/components/` — composants partages (Panel, StatusBar, etc.)

### Ce que cette sous-phase fait
1. Creer un prototype minimal qui combine : un panel Ink (auto-refresh) + un champ TextInput en bas
2. Valider que Ink supporte le split (rendu + input dans le meme terminal)
3. Si Ink ne supporte PAS le split : documenter l'alternative et passer au mode log (output lineaire comme Claude Code)

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/interactive/` | Creer le dossier pour le mode interactif |
| `maestro-cli/interactive/App.ts` | Composant Ink racine : split panel/input |
| `maestro-cli/interactive/InputPrompt.ts` | Composant TextInput pour l'input utilisateur |
| `maestro-cli/interactive/OutputPanel.ts` | Composant pour afficher la progression (scrollable) |

### Verification
```bash
# Creer un test minimal
cd C:\Meastro\maestro-cli
npx tsx interactive/App.ts

# Resultat attendu : un ecran split avec un panel en haut et un prompt en bas
# L'utilisateur peut taper du texte et le panel se met a jour

# Si le split ne marche pas, documenter dans checkpoint.md et tester l'alternative :
# Mode log (output lineaire, prompt readline standard)
```

### Anti-patterns
- Ne PAS reutiliser le monitor fullscreen tel quel — le monitor est read-only, `maestro code` est interactif
- Ne PAS bloquer sur le choix UI — si Ink split ne marche pas, passer au mode log immediatement
- Ne PAS ecrire de logique metier (creation de session, invocation) — c'est 33-B
- Ne PAS creer de nouveau package.json — utiliser celui de `maestro-cli/monitor/ink/`

### Checkpoint
```markdown
## 33-A : Prototype Ink REPL
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Mode choisi** : split Ink | mode log (lineaire)
**Raison du choix** : [si mode log, expliquer pourquoi Ink split ne convient pas]
**Fichiers crees** : (lister)
**Prototype fonctionne** : OUI/NON
```

---

## 33-B : Commande `maestro code` E2E

### Lecture obligatoire
- `maestro-cli/cli.ts` — le pattern de commandes existant (`.command(`)
- `content/system/templates/sessions/project-autonomous.session.json` — le template de session
- `content/system/blocks/workflows/autonomous-development.workflow.block.json` — le workflow
- `maestro-cli/interactive/App.ts` (cree en 33-A) — le prototype UI

### Ce que cette sous-phase fait
1. Ajouter la commande `code` dans `cli.ts`
2. La commande fait :
   a. Detecter `.maestro/config.json` dans le repertoire courant (cree par `maestro init`)
   b. Creer automatiquement une session project-autonomous (via API)
   c. Demarrer la session
   d. Afficher le prompt interactif
   e. Quand l'utilisateur tape une tache : invoquer l'entry point `dev` avec `task=<input>` et `repoPath=<cwd>`
   f. Streamer `_executionTree` et `_executionLog` en temps reel dans le panel
   g. Quand l'agent termine : re-afficher le prompt

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/cli.ts` | Ajouter la commande `code` avec les options `--model`, `--tier` |
| `maestro-cli/interactive/CodeSession.ts` | Logique de creation/gestion de la session (API calls) |
| `maestro-cli/interactive/StreamRenderer.ts` | Polling de `_executionTree` et rendu progressif |

### Flux interne de `maestro code`
```
1. Lire .maestro/config.json → template, model
2. POST /api/sessions (create) → session ID
3. POST /api/sessions/{id}/start
4. Afficher prompt ">"
5. User tape "Ajouter page login"
6. POST /api/sessions/{id}/invoke/dev {task: "Ajouter page login", repoPath: cwd}
7. Boucle de polling :
   a. GET /api/sessions/{id}/variables/_executionTree → afficher progression
   b. GET /api/sessions/{id}/variables/_executionLog → afficher logs
   c. Si workflow termine → retour au prompt
8. Goto 4
```

### Verification
```bash
# Prerequis : backend demarre, .maestro/ existe dans un projet test

# Test 1 : la commande existe
cd C:\Meastro\maestro-cli
node index.js code --help
# Doit afficher l'aide de la commande code

# Test 2 : detection du projet
cd /tmp/test-project  # un dossier SANS .maestro/
node C:\Meastro\maestro-cli\index.js code
# Doit afficher : "No .maestro/ found. Run 'maestro init' first."

# Test 3 : E2E (avec backend)
cd C:\test-repos\cantante  # ou un projet avec .maestro/
node C:\Meastro\maestro-cli\index.js code
# Doit : creer une session, afficher le prompt, accepter une tache
```

### Anti-patterns
- Ne PAS hardcoder "autonomous-development" — lire le workflow depuis `.maestro/config.json`
- Ne PAS gerer le lifecycle de l'agent dans le CLI — le backend gere l'execution, le CLI affiche
- Ne PAS bloquer le process sur le polling — utiliser des intervalles non-bloquants
- Ne PAS creer une nouvelle API — utiliser les endpoints existants (sessions, variables)

### Checkpoint
```markdown
## 33-B : maestro code E2E
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Commande ajoutee** : OUI/NON
**Detection .maestro/** : OUI/NON
**Creation session auto** : OUI/NON
**Invocation E2E** : OUI/NON
**Streaming execution** : OUI/NON
**Fichiers modifies** : (lister)
```

---

## 33-C : Test et iteration sur Cantante

### Lecture obligatoire
- `docs/phases/PHASE-31/checkpoint.md` — les resultats de 31-C (usage reel sur Cantante)
- `maestro-cli/interactive/CodeSession.ts` (cree en 33-B)
- Le repo Cantante : comprendre sa structure

### Ce que cette sous-phase fait
1. Utiliser `maestro code` sur 5 taches reelles sur Cantante (ou un autre projet)
2. Documenter chaque session : tache donnee, resultat obtenu, problemes, temps
3. Corriger les bugs trouves
4. Comparer avec l'experience Claude Code : ou est-on meilleur, ou pire

### Taches de test predefinies
| # | Tache | Ce qu'on verifie |
|---|-------|-----------------|
| 1 | "Ajouter un fichier README.md" | Tache minimale, E2E basique |
| 2 | "Ajouter un bouton de login dans la page principale" | Tache de creation, modification de fichier existant |
| 3 | "Corriger le bug dans [fichier specifique]" | Tache de debug, lecture + modification |
| 4 | "Refactorer [module] pour extraire une fonction" | Tache multi-fichier |
| 5 | "Ajouter des tests pour [module]" | Tache de creation de fichiers de test |

### Verification
```bash
# Pour chaque tache, documenter dans checkpoint.md :
# - La commande exacte tapee
# - Le temps pris
# - Les fichiers crees/modifies par l'agent
# - Les erreurs rencontrees
# - Score subjectif 1-5 (1=inutilisable, 5=parfait)
```

### Anti-patterns
- Ne PAS ignorer les echecs — documenter CHAQUE probleme meme mineur
- Ne PAS tester sur des taches triviales uniquement — inclure au moins 2 taches non-triviales
- Ne PAS "aider" l'agent manuellement — le but est de tester l'experience utilisateur reelle
- Ne PAS comparer avec Claude Code sur des criteres irrealistes — comparer sur l'experience UX

### Checkpoint
```markdown
## 33-C : Test et iteration
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Taches testees** : X/5
**Score moyen** : X/5
**Bugs critiques trouves** : X (lister)
**Bugs corriges** : X (lister)
**Comparaison Claude Code** :
- Meilleur sur : [quoi]
- Pire sur : [quoi]
- Equivalent sur : [quoi]
```

---

## Risque technique

Le defi principal est la TUI interactive inline. Options si Ink fullscreen ne convient pas :

| Option | Avantage | Inconvenient |
|--------|----------|--------------|
| Ink split (panel + TextInput) | Widgets riches, reutilisation du monitor | Peut ne pas fonctionner avec fullscreen |
| Mode log (output lineaire + readline) | Simple, fiable, approche Claude Code | Pas de widgets, moins visuel |
| Deux terminaux (monitor + CLI) | Fonctionne deja | Pas user-friendly pour un nouveau dev |

**Decision** : 33-A tranche. Si Ink split marche → Ink. Sinon → mode log. Ne PAS perdre de temps sur le choix.

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-33/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 33 COMPLETE — maestro code [mode choisi], X/5 score moyen sur Cantante"
- Ajouter le pattern technique choisi (Ink split ou mode log) dans un fichier topic
- Retirer les entries Phase 32 detaillees (garder juste "Phase 32 COMPLETE")
