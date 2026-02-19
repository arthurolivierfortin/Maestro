# Phase 33-B : Audit UX & Ameliorations CLI

**Statut** : A faire
**Prerequis** : Phase 33 COMPLETE (verifier `docs/phases/PHASE-33/checkpoint.md`)
**Objectif** : Corriger les frictions UX du CLI identifiees par dogfooding, en reutilisant les composants partages existants.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-33B/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS creer de nouveaux composants** — reutiliser `shared/tui/`, `shared/theme/`, `output-formatter.ts`
5. **Ne PAS modifier le backend** — cette phase est 100% CLI/frontend
6. **Tester chaque changement** avec la commande concernee avant de checkpointer

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 33-B-A | Nettoyage output CLI (tables, dates, erreurs) | 3-4h |
| 33-B-B | Feedback temps reel et resume final | 2-3h |
| 33-B-C | Suppression pollutions et inconsistances | 1-2h |
| 33-B-D | CLI interactif avec composants partages | 4-6h |

---

## Audit UX — Observations (reference)

Conservees dans `docs/phases/PHASE-33B/ux-audit.md` (fichier separe).

---

## 33-B-A : Nettoyage output CLI

### Lecture obligatoire
- `maestro-cli/cli.ts` lignes 1-100 — comprendre le systeme d'import et les helpers existants
- `maestro-cli/output-formatter.ts` — comprendre `formatTable()`, `success()`, `error()`
- `shared/utils/cli-colors.ts` — palette de couleurs disponible
- `shared/theme/tokens.ts` — icones Unicode disponibles (`icons`)

### Ce que cette sous-phase fait
1. **Remplacer `console.table()` par `formatTable()`** dans toutes les commandes qui listent des entites (blocks, sessions, agents, tools, workflows). Le `console.table()` natif de Node.js affiche des quotes autour des strings et un index numerique inutile.
2. **Ajouter `--limit N` et `--sort <col>`** aux commandes `blocks`, `session list`, `agents`, `tools`, `workflows`. Default limit = 25 pour eviter le scroll de 101 blocs.
3. **Cacher les colonnes vides** — si Score est "-" pour TOUS les blocs, ne pas afficher la colonne Score. Idem pour Runs quand tous a 0.
4. **Remplacer `undefined` par `—`** dans tous les outputs (session list: colonne Project).
5. **Formater les dates** — remplacer les dates ISO brutes (`2026-02-19T02:36:19.8119795`) par un format court (`Feb 19 02:36`) ou relatif (`5 min ago`). Creer un helper `formatDate(iso: string): string` dans `output-formatter.ts`.
6. **Ajouter entry points count** dans `session info` — afficher "Entry Points: 3 (dev, plan, review)" au lieu de rien.
7. **Ajouter suggestion "Did you mean..."** pour les commandes inconnues — utiliser une distance de Levenshtein simple (max 2 edits) contre la liste de commandes connues.

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/cli.ts` | Remplacer les appels `console.table()` par `formatter.table()`. Ajouter `--limit`, `--sort`. Ajouter "did you mean" dans le handler "Unknown command" |
| `maestro-cli/output-formatter.ts` | Ajouter `formatDate()` helper. Ajouter option `hideEmptyColumns` dans `table()`. Ajouter `smartTable()` qui cache les colonnes vides |

### Verification
```bash
# Commande 1 : Blocks list propre, sans quotes, max 25
cd C:\Meastro\maestro-cli && node index.js blocks --limit 25
# Resultat attendu : table sans quotes, sans index, max 25 lignes, pas de colonne Score/Runs si tous vides

# Commande 2 : Sessions list sans undefined
node index.js session list
# Resultat attendu : colonne Project montre "—" au lieu de "undefined"

# Commande 3 : Dates formatees
node index.js session last
# Resultat attendu : "Created: Feb 19 02:36" pas "Created: 2026-02-19T02:36:19.8119795"

# Commande 4 : Did you mean
node index.js sesion list
# Resultat attendu : "Unknown command: sesion. Did you mean: session?"

# Commande 5 : Session info avec entry points
node index.js session info bea6
# Resultat attendu : ligne "Entry Points: 3 (dev, plan, review)"
```

### Anti-patterns
- Ne PAS creer un nouveau systeme de table — utiliser et ameliorer `formatTable()` existant dans `output-formatter.ts`
- Ne PAS ajouter de dependance npm pour la distance de Levenshtein — implementer en ~10 lignes
- Ne PAS modifier le backend — tout est cote CLI

### Checkpoint
```markdown
## 33-B-A : Nettoyage output CLI
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**console.table remplace** : X commandes migrees
**Colonnes vides cachees** : OUI/NON
**Dates formatees** : OUI/NON
**Did you mean** : OUI/NON
**Verification** : [copier output des 5 commandes]
```

---

## 33-B-B : Feedback temps reel et resume final

### Lecture obligatoire
- `maestro-cli/interactive/headless.ts` — comprendre le polling loop et le format de sortie
- `maestro-cli/cli.ts` lignes autour de `cmd === 'code'` — comprendre le handler headless
- `shared/theme/tokens.ts` — icones spinner disponibles (`icons.spinner`)

### Ce que cette sous-phase fait
1. **N'afficher que les CHANGEMENTS de nodes** dans le polling headless — actuellement tous les nodes sont re-affiches a chaque poll si le hash change. Ne montrer que les nodes qui ont change de statut depuis le dernier poll.
2. **Ajouter un resume final** apres completion dans le mode headless :
   ```
   [HH:MM:SS] [DONE ] Task completed successfully
   [HH:MM:SS] [SUMRY] Duration: 2m 34s
   [HH:MM:SS] [SUMRY] Nodes: 7 completed, 0 errors
   [HH:MM:SS] [SUMRY] Session: cf47d83f-31ab-4a03-98d1-83b98a8fdf55
   ```
3. **Ajouter un spinner texte** entre "Invoking" et la premiere reponse — afficher des dots `...` toutes les 5s pour montrer que ca tourne.
4. **Fix le template import stdout** — la fonction `importSessionTemplate` dans `cli.ts` ecrit directement dans stdout avec `console.log`. En mode headless, rediriger ces logs vers le format structure `[HH:MM:SS] [INFO]` ou les supprimer.

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/interactive/headless.ts` | Tracker le statut par node (Map<name, status>), n'afficher que les transitions. Ajouter resume final (duree, nodes, erreurs). Ajouter spinner entre invoke et premier poll result. |
| `maestro-cli/cli.ts` | Passer une option `quiet: true` a `importSessionTemplate()` quand appele depuis headless. |

### Verification
```bash
# Commande 1 : Headless avec resume final
cd C:\Meastro\maestro-cli && node index.js code --headless --task "Add a CHANGELOG.md" --repo C:\Cantante
# Resultat attendu : resume [SUMRY] en fin d'execution avec duree et count

# Commande 2 : Pas de pollution template import
# Resultat attendu : pas de "Importing template:..." et "Variables..." dans l'output — uniquement [HH:MM:SS] [LEVEL] format

# Commande 3 : Nodes delta (pas de re-affichage complet)
# Resultat attendu : chaque node n'apparait qu'UNE fois par changement de statut (running, puis completed)
```

### Anti-patterns
- Ne PAS ajouter un vrai spinner Ink dans le mode headless — c'est non-TTY, utiliser du texte simple
- Ne PAS casser le format structure parseable — chaque ligne doit matcher `[HH:MM:SS] [LEVEL] message`
- Ne PAS supprimer l'output du template import en mode TUI — seulement en headless

### Checkpoint
```markdown
## 33-B-B : Feedback et resume
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Resume final** : OUI/NON
**Template import silencieux** : OUI/NON
**Nodes delta** : OUI/NON
**Verification** : [copier output du test headless]
```

---

## 33-B-C : Suppression pollutions et inconsistances

### Lecture obligatoire
- `maestro-cli/cli.ts` — handler `agents`, `tools`, `workflows` (les shortcuts)
- `maestro-cli/cli.ts` — handler `maestro init`
- `maestro-cli/cli.ts` — handler "Unknown command"

### Ce que cette sous-phase fait
1. **Supprimer le warning depreciation** de `maestro agents` / `maestro tools` / `maestro workflows` — ce sont des shortcuts valides, pas deprecated. Le warning stderr cause un double-affichage dans PowerShell.
2. **Ameliorer `maestro init` quand .maestro/ existe** — afficher un resume de la config existante au lieu de "already exists. remove first". Ajouter `--force` pour reinitialiser.
3. **Ajouter un hint "Run maestro --help"** dans le handler de commande inconnue.
4. **Tronquer le nom de session proprement** dans `session info` — ajouter "..." si tronque, et afficher le nom complet sur une 2e ligne si > 72 chars.

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/cli.ts` | Supprimer `console.error` warning dans handlers agents/tools/workflows. Ameliorer handler init. Ameliorer handler unknown command. Ameliorer session info pour noms longs. |

### Verification
```bash
# Commande 1 : agents sans warning
cd C:\Meastro\maestro-cli && node index.js agents 2>&1
# Resultat attendu : table sans "Use block list --designation agent instead" sur stderr

# Commande 2 : init quand existe
node index.js init C:\Cantante
# Resultat attendu : montre la config existante (stack, aliases count) + hint --force

# Commande 3 : commande inconnue avec hint
node index.js foo
# Resultat attendu : "Unknown command: foo. Run `maestro --help` for available commands."
```

### Anti-patterns
- Ne PAS supprimer les shortcuts agents/tools/workflows — ils sont utiles, juste supprimer le warning
- Ne PAS ajouter de logique complexe dans `init` — juste lire et afficher le config.json existant

### Checkpoint
```markdown
## 33-B-C : Pollutions et inconsistances
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Warning agents supprime** : OUI/NON
**Init ameliore** : OUI/NON
**Unknown cmd hint** : OUI/NON
**Verification** : [copier output]
```

---

## 33-B-D : CLI interactif avec composants partages

### Lecture obligatoire
- `shared/tui/components/DataTable.ts` — comprendre le composant table existant
- `shared/tui/components/ProgressBar.ts` — comprendre le composant progress
- `shared/tui/widgets/PlanView.ts` — comprendre le widget plan
- `shared/tui/hooks/useSelectableList.ts` — comprendre le hook de selection avec scroll
- `maestro-cli/interactive/App.ts` — comprendre le pattern de lancement Ink (dynamic import)
- `maestro-cli/interactive/launcher.ts` — comprendre le wrapper CJS → ESM

### Ce que cette sous-phase fait
1. **Creer un renderer Ink pour les tables** dans `maestro-cli/interactive/ink-table.ts` — reutilise `DataTable` de `shared/tui/` + `useSelectableList` pour navigation j/k + filtre texte. Fallback: si pas TTY, utiliser `formatTable()` classique.
2. **Wirer `maestro blocks -i`** (ou detection auto TTY) pour lancer la table interactive — navigation, filtre par type/designation, selection → affiche le detail du bloc.
3. **Wirer `maestro session list -i`** — meme pattern, selection → lance le monitor ou affiche info.
4. **Ajouter `--interactive` / `-i` flag** comme pattern generique dans `cli.ts` pour les commandes qui supportent un mode Ink.

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/interactive/ink-table.ts` | Creer — composant Ink reutilisable qui wrape DataTable + useSelectableList + filtre |
| `maestro-cli/interactive/ink-table-launcher.ts` | Creer — wrapper CJS-safe (meme pattern que launcher.ts) |
| `maestro-cli/cli.ts` | Ajouter branche `-i` / `--interactive` dans handlers `blocks` et `session list` |

### Verification
```bash
# Commande 1 : Table blocks interactive (necessite TTY — tester manuellement)
cd C:\Meastro\maestro-cli && node index.js blocks -i
# Resultat attendu : table Ink avec navigation j/k, filtre texte, q pour quitter

# Commande 2 : Fallback sans TTY
node index.js blocks -i < /dev/null
# Resultat attendu : fallback vers table texte classique (pas de crash)

# Commande 3 : Tests unitaires
npx vitest run tests/interactive/
# Resultat attendu : tous les tests existants passent (29/29) + nouveaux tests
```

### Anti-patterns
- Ne PAS dupliquer les composants — importer DIRECTEMENT depuis `shared/tui/`
- Ne PAS creer un systeme de "modes" complexe — un simple if TTY + `-i` suffit
- Ne PAS bloquer les commandes classiques — `-i` est opt-in, le mode texte reste le defaut
- Ne PAS utiliser `import` top-level pour Ink — garder le pattern dynamic import via require() → await import()

### Checkpoint
```markdown
## 33-B-D : CLI interactif
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**ink-table cree** : OUI/NON
**blocks -i** : OUI/NON
**session list -i** : OUI/NON
**Fallback non-TTY** : OUI/NON
**Tests** : X/Y passent
**Verification** : [copier output des tests]
```

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-33B/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 33-B: UX CLI fixes (formatTable, dates, did-you-mean, headless resume, ink-table -i)"
- Ajouter : "CLI testing pattern: `npx vitest run tests/interactive/` for Ink components"
- Retirer : rien (entries existantes toujours valides)
