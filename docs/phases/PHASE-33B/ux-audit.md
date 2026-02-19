# Phase 33-B : Audit UX — Observations brutes

**Date** : 2026-02-19
**Methode** : Dogfooding — utilisation reelle du CLI depuis Claude Code sur le projet Cantante

---

## 1. PREMIER CONTACT (`maestro --help`)

**Positif** :
- Help bien organise par categories (Quick Start, Sessions, Blocks, etc.)
- Quick Start en premier — montre `maestro code` et `maestro agent`
- Shortcuts documentes (agents, tools, workflows)
- ID prefixes documentes

**Problemes** :
- 30+ commandes visibles d'un coup — ecrasant pour un nouveau utilisateur
- Pas de hierarchie visuelle — tout au meme niveau, meme police, meme couleur
- `maestro` sans args lance un shell interactif non documente dans le help

---

## 2. TABLES (`maestro blocks`, `maestro session list`)

**Problemes** :
- `console.table()` natif Node.js — quotes autour des strings (`'tool'`), index numerique inutile, bordures ASCII lourdes
- 101 blocs d'un coup sans pagination
- Pas de tri (ni par nom, ni par type, ni par score)
- Pas de filtre inline
- Noms tronques dans session list mais PAS dans blocks → inconsistant
- `undefined` dans la colonne Project (session list)
- Colonnes inutiles visibles — Score et Runs sont tous a "-" et 0

---

## 3. SESSION INFO

**Positif** :
- Short ID fonctionne (`bea6` → resout correctement)
- Format KV lisible

**Problemes** :
- Nom tronque a 72 chars sans indication de troncature
- "Project ID: N/A", "Workflow ID: N/A", "Task: N/A" — bruit inutile
- Pas de lien vers entry points (doit savoir `session entry-points <id>`)
- Date ISO brute (`2026-02-19T02:36:19.8119795`)

---

## 4. ERREURS

**Positif** :
- Message clair "Unknown command: X"
- `handleApiError()` donne des hints contextuels

**Problemes** :
- Pas de suggestion "Did you mean..." pour typos
- Pas de hint "Run maestro --help"
- Exit code 1 sur stderr — PowerShell affiche l'erreur deux fois

---

## 5. `maestro init`

**Problemes** :
- Message sec "already exists. To reinitialize, remove .maestro/ first."
- Pas de `--force` ou `--reinit`
- Pas de confirmation de ce qui a ete cree (stack detecte, fichiers generes)

---

## 6. `maestro agents` (shortcut)

**Problemes** :
- Warning depreciation stderr alors que ca marche — confusion
- Output duplique dans PowerShell a cause du stderr
- Agents `designation: autonomous` absents de la liste

---

## 7. `maestro code --headless`

**Positif** :
- Fonctionne E2E
- Output structure parseable
- Session ID dans l'output final

**Problemes** :
- Template import imprime directement dans stdout — casse le format structure
- 30-60s de silence entre "Invoking" et premiere reponse
- Nodes re-affiches en totalite a chaque poll (pas de delta)
- Pas de resume final (fichiers, duree, score)

---

## 8. COMPOSANTS PARTAGES NON UTILISES

| Composant | Existe dans shared/tui | Utilise par le CLI |
|-----------|----------------------|-------------------|
| ProgressBar | OUI | NON |
| DataTable | OUI | NON (console.table natif) |
| Panel | OUI | NON |
| StatusIndicator | OUI | NON |
| KV | OUI | NON |
| OptionSelect widget | OUI | NON |
| PlanView widget | OUI | NON |
| LogStream widget | OUI | NON |
| useSelectableList hook | OUI | NON |

Le CLI est en mode "console.log + console.table" alors qu'il y a des composants Ink riches disponibles.
