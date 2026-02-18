# Phase 32 : CLI Polish + `maestro init`

**Statut** : A faire
**Prerequis** : Phase 31 COMPLETE (blocks publies, agent teste en usage reel)
**Objectif** : Rendre le CLI utilisable par un nouveau developpeur sans aide.

---

## Contexte

Le CLI a 100+ commandes mais l'experience utilisateur n'a jamais eu de phase dediee.
Les problemes identifies :
- Pas de point d'entree (`maestro init`) pour un nouveau projet
- Le flag `--input` avec quoting est penible
- Pas d'auto-completion pour les IDs (sessions, blocks)
- Pas de messages d'erreur utiles (suggestions, alternatives)
- Pas d'alias system (`maestro agent` → `maestro run-interactive autonomous-dev-v3`)

Cette phase vient AVANT `maestro code` car le mode interactif sera construit
sur le CLI. Si le CLI a une mauvaise UX, `maestro code` herite des problemes.

---

## Sous-phases

| Phase | Titre | Objectif | Effort |
|-------|-------|----------|--------|
| 32-A | `maestro init` | Initialiser `.maestro/` dans un repo, detecter le stack | 1-2 jours |
| 32-B | Aliases system | `aliases.json` : `maestro agent` → workflow configurable | 1 jour |
| 32-C | UX improvements | Auto-completion IDs, meilleurs messages d'erreur, `--input` simplifie | 2-3 jours |

---

## 32-A : `maestro init`

Point d'entree pour tout nouvel utilisateur.

```bash
$ cd mon-projet
$ maestro init

Maestro v0.1.0
Detecting project...
  Found: package.json (Node.js), tsconfig.json (TypeScript)
  Framework: React (detected from dependencies)

Created .maestro/ directory:
  .maestro/CONVENTIONS.md  — Edit with your project conventions
  .maestro/README.md       — Project description for the agent
  .maestro/config.json     — Maestro configuration

Next steps:
  1. Edit .maestro/CONVENTIONS.md with your coding standards
  2. Run: maestro code    (interactive agent mode)
  3. Or:  maestro session create --template project-autonomous --start
```

**Ce que `maestro init` fait** :
1. Detecte le type de projet (package.json, pom.xml, .csproj, pyproject.toml, etc.)
2. Cree `.maestro/` avec des fichiers templates
3. Genere un `CONVENTIONS.md` avec des defaults adaptes au stack detecte
4. Cree un `config.json` local (model preferences, default template, etc.)

**Ce que `maestro init` ne fait PAS** :
- Ne cree pas de session (c'est une commande separee)
- Ne demarre pas de backend (prerequis)
- Ne telecharge pas de modeles

---

## 32-B : Aliases system

Fichier `~/.maestro/aliases.json` (ou `.maestro/aliases.json` par projet) :

```json
{
  "agent": {
    "workflow": "autonomous-development",
    "template": "project-autonomous",
    "entryPoint": "dev"
  },
  "commit": {
    "workflow": "generate-commit-message",
    "template": null,
    "entryPoint": "start"
  }
}
```

**Usage** :
```bash
maestro agent "Ajouter un bouton de login"
# Equivalent a :
# maestro session create --template project-autonomous --start
# maestro session invoke <id> dev --input task="Ajouter un bouton de login" repoPath="."
```

**Principe** : Les alias sont des raccourcis de DATA, pas de code. `maestro agent`
n'est PAS une commande hardcodee — c'est un lookup dans aliases.json.
Un utilisateur qui cree un workflow de traduction peut ajouter `"translator": {...}`
et obtenir `maestro translator "Traduire en francais"`.

---

## 32-C : UX improvements

### Auto-completion des IDs
- Quand l'utilisateur tape un ID partiel, le CLI cherche la correspondance
- `maestro session info abc` → resout `abc12345-6789-...` automatiquement
- Fonctionne pour sessions, blocks, approvals, workspaces

### Meilleurs messages d'erreur
```
# Avant :
Error: Session not found

# Apres :
Error: Session "abc" not found.
  Did you mean one of these?
    abc12345  "Cantante - File Tree"     (active)
    abd98765  "Cantante - Login Page"    (idle)
  Run 'maestro session list' to see all sessions.
```

### Simplification du `--input`
```bash
# Actuel (penible avec quoting) :
node index.js session invoke <id> dev --input task="Ajouter un login" --input repoPath="C:\Cantante"

# Ameliore :
maestro session invoke <id> dev task="Ajouter un login" repoPath="C:\Cantante"
# Les arguments non-flag apres l'entry point sont traites comme inputs
```

---

## Criteres de completion

- [ ] `maestro init` fonctionne dans un repo Node.js et cree `.maestro/`
- [ ] `maestro agent "task"` resout l'alias et execute le workflow
- [ ] Les IDs partiels sont resolus automatiquement
- [ ] Les erreurs donnent des suggestions utiles
