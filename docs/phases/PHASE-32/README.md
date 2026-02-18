# Phase 32 : CLI Polish + `maestro init`

**Statut** : A faire
**Prerequis** : Phase 31 COMPLETE (checkpoint.md montre 31-A a 31-E tous DONE)
**Objectif** : Rendre le CLI utilisable par un nouveau developpeur sans aide.

---

## Regles pour l'agent executant

1. **Lire les fichiers obligatoires** avant chaque sous-phase
2. **Ecrire dans `PHASE-32/checkpoint.md`** apres chaque sous-phase
3. **Lire `PHASE-31/checkpoint.md` et `PHASE-31/journal-usage.md`** pour les bugs UX reportes en P3
4. **Ne PAS modifier le backend C#** sauf si un endpoint manque
5. **Tester chaque changement** avant de passer au suivant
6. **Le CLI est dans `maestro-cli/cli.ts`** — c'est LE fichier principal a modifier

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 32-A | `maestro init` | 1-2 jours |
| 32-B | Aliases system | 1 jour |
| 32-C | UX improvements | 2-3 jours |

---

## 32-A : `maestro init`

### Lecture obligatoire
- `maestro-cli/cli.ts` — comprendre comment les commandes sont enregistrees (chercher `yargs` ou `.command(`)
- `CLAUDE.md` section "CLI-First: Everything Goes Through the CLI"
- `backend/src/Maestro.Infrastructure/Sessions/MaestroDirectoryInitializer.cs` — la logique existante de creation `.maestro/`

### Ce que `maestro init` fait
1. Detecte le type de projet en cherchant : `package.json` (Node), `*.csproj` (C#), `pyproject.toml` (Python), `pom.xml` (Java), `Cargo.toml` (Rust)
2. Cree `.maestro/` dans le repertoire courant
3. Cree `.maestro/config.json` avec : `{ "template": "project-autonomous", "model": null }`
4. Cree `.maestro/CONVENTIONS.md` avec un template adapte au stack detecte
5. Cree `.maestro/README.md` avec un placeholder que l'utilisateur doit remplir
6. Affiche les prochaines etapes

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/cli.ts` | Ajouter la commande `init` dans le meme pattern que les autres commandes |
| `content/system/templates/init/` | Creer les templates pour CONVENTIONS.md par stack (node.md, csharp.md, python.md, default.md) |

### Ce que `maestro init` ne fait PAS
- Ne cree PAS de session
- Ne demarre PAS de backend
- Ne telecharge PAS de modeles
- Ne contacte PAS l'API (c'est une operation purement locale filesystem)

### Verification
```bash
# Creer un dossier temporaire
mkdir /tmp/test-init && cd /tmp/test-init
echo '{}' > package.json

# Tester
node C:\Meastro\maestro-cli\index.js init

# Verifier
ls .maestro/
# Doit contenir : config.json, CONVENTIONS.md, README.md
cat .maestro/config.json
# Doit contenir du JSON valide avec "template" et "model"
```

### Anti-patterns
- Ne PAS faire de detection "intelligente" du framework (React, Vue, etc.) — juste le stack (Node, C#, Python)
- Ne PAS creer de session ou workspace automatiquement
- Ne PAS contacter l'API
- Le code doit fonctionner SANS backend

### Checkpoint
```markdown
## 32-A : maestro init
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Commande ajoutee** : OUI/NON
**Templates crees** : (lister les fichiers)
**Teste sur** : (lister les stacks testes : node, csharp, etc.)
```

---

## 32-B : Aliases system

### Lecture obligatoire
- `maestro-cli/cli.ts` — le pattern de commandes existant
- `docs/phases/PHASE-28/SUGGESTIONS-OPTIMIZE-AND-PHILOSOPHY.md` — section sur les aliases
- `CLAUDE.md` section "No Silent Failures"

### Design

**Fichier** : `~/.maestro/aliases.json` (global) et `.maestro/aliases.json` (par projet, prioritaire)

```json
{
  "agent": {
    "workflow": "autonomous-development",
    "template": "project-autonomous",
    "entryPoint": "dev",
    "description": "Autonomous development agent"
  }
}
```

**Comportement de `maestro <alias> "<task>"`** :
1. Chercher `.maestro/aliases.json` (local) → `~/.maestro/aliases.json` (global)
2. Si l'alias est trouve : creer une session avec le template, la demarrer, invoquer l'entry point avec task=`<argument>` et repoPath=`<cwd>`
3. Si l'alias n'est pas trouve : erreur avec suggestions (montrer les alias disponibles)

### Fichiers a modifier/creer
| Fichier | Action |
|---------|--------|
| `maestro-cli/cli.ts` | Ajouter la logique de resolution d'alias dans le parser de commandes (AVANT le dispatch yargs) |
| `content/system/templates/init/aliases-default.json` | Alias par defaut ships avec `maestro init` |

### Comment integrer dans cli.ts

La logique d'alias doit s'executer AVANT le parsing yargs habituel :
```
1. Lire argv[0] (le premier argument apres "maestro")
2. Chercher dans aliases.json
3. Si trouvé → transformer en : session create + session invoke
4. Si pas trouvé → continuer le parsing yargs normal
```

NE PAS creer une commande yargs "alias" — les alias sont resolus dynamiquement.

### Verification
```bash
# Creer un alias manuellement
echo '{"test-alias": {"workflow": "autonomous-development", "template": "project-autonomous", "entryPoint": "dev"}}' > ~/.maestro/aliases.json

# Tester (avec le backend en cours d'execution)
node index.js test-alias "Add a README"
# Doit creer une session, la demarrer, et invoquer dev
```

### Anti-patterns
- Ne PAS hardcoder "agent" comme commande speciale dans le CLI
- Ne PAS creer un fichier yargs commands/ pour chaque alias
- L'alias DOIT fonctionner pour n'importe quel nom (agent, translator, reviewer, etc.)

### Checkpoint
```markdown
## 32-B : Aliases
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers modifies** : (lister)
**Alias testes** : (lister les alias testes et resultats)
**Alias par defaut** : (lister ceux livres avec maestro init)
```

---

## 32-C : UX improvements

### Lecture obligatoire
- `maestro-cli/cli.ts` — les handlers existants
- `PHASE-31/journal-usage.md` — les problemes UX reportes en 31-C
- `PHASE-31/checkpoint.md` section 31-D — les P3 reportes

### 3 ameliorations ciblees

**1. Resolution d'IDs partiels**

Le CLI appelle l'API avec des IDs complets. Ajouter une resolution :
```
Quand l'utilisateur tape un ID court (< 36 chars) :
→ Appeler GET /api/sessions (ou /api/blocks, etc.)
→ Filtrer ceux qui commencent par l'ID court
→ Si 1 match : utiliser l'ID complet
→ Si 0 match : erreur "ID not found"
→ Si N matches : erreur "Ambiguous ID, did you mean: ..."
```

**Ou implementer** : creer une fonction `resolveId(type, partialId)` dans `maestro-cli/cli.ts`
et l'appeler dans chaque handler qui prend un ID.

**2. Meilleurs messages d'erreur**

Quand une commande echoue, ajouter du contexte :
- "Session not found" → "Session 'abc' not found. Run 'maestro session list' to see available sessions."
- "Block not found" → "Block 'xyz' not found. Run 'maestro block list' to see available blocks."
- "Connection refused" → "Cannot connect to Maestro backend. Is it running? Start with: powershell.exe -File dev-scripts/dev-start.ps1"

**3. Simplification des inputs**

Si l'utilisateur tape des arguments positionnels apres l'entry point, les traiter comme inputs :
```bash
# Actuel :
node index.js session invoke <id> dev --input task="Add login" --input repoPath="C:\myrepo"

# Ameliore (en plus, pas en remplacement) :
node index.js session invoke <id> dev task="Add login" repoPath="C:\myrepo"
```

### Verification
```bash
# Test ID partiel
node index.js session info abc
# Doit resoudre ou donner une erreur utile

# Test erreur
node index.js session info nonexistent-id-12345
# Doit dire "not found, run session list"

# Test inputs simplifies
node index.js session invoke <id> dev task="test" repoPath="."
# Doit fonctionner comme avec --input
```

### Anti-patterns
- Ne PAS casser la syntaxe existante (--input doit TOUJOURS fonctionner)
- Ne PAS ajouter de "magic" au parsing — rester explicite
- Ne PAS modifier l'API backend pour supporter les IDs partiels (le faire cote CLI)

### Checkpoint
```markdown
## 32-C : UX improvements
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**ID resolution** : implemente OUI/NON, teste sur sessions/blocks/approvals
**Messages d'erreur** : X handlers ameliores
**Input simplifie** : implemente OUI/NON
**Bugs P3 de Phase 31 corriges** : (lister)
```

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-32/checkpoint.md` — meme format que Phase 31.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 32 COMPLETE — maestro init, aliases, UX polish"
- Ajouter les patterns decouverts (ex: "la resolution d'ID se fait dans cli.ts avec resolveId()")
- Retirer les entries Phase 31 detaillees (garder juste "Phase 31 COMPLETE")
