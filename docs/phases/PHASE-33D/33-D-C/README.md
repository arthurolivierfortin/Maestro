# 33-D-C : Nettoyage dev-scripts + maj paths internes

**Statut** : PAS_COMMENCE
**Objectif** : Supprimer les 25+ scripts obsoletes de `dev-scripts/` et mettre a jour les paths internes des scripts gardes pour pointer vers `apps/backend` et `apps/desktop`.

**Regle** : `dev-scripts/` reste a la racine — seul le contenu est nettoye. Ne PAS deplacer le dossier.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `dev-scripts/dev-start.ps1` | Comprendre `$MaestroRoot = Split-Path -Parent $PSScriptRoot` et tous les paths internes qui referent a `backend`, `frontend` |
| `dev-scripts/kill-backend.ps1` | Verifier s'il reference `backend/` |
| `dev-scripts/restart-backend.ps1` | Verifier s'il reference `backend/` |
| `dev-scripts/build-release.ps1` | Verifier s'il reference `backend/` ou `frontend/` |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Supprimer les scripts obsoletes

Les scripts suivants sont des one-time, debug, ou remplaces par la CLI. Les supprimer via `git rm` :

```
check-backend.ps1
check-convention-reader.ps1
check-discovery.js
check-llm-activity.ps1
check-phases.js
check-session.ps1
check-session-detail.ps1
count-active.ps1
create-research-blocks.ps1
enter-dotnet10.ps1
get-last-session.ps1
launch-monitor.ps1
move-drafts.ps1
move-drafts-2.ps1
nuget.ps1
prep-pr.ps1
quick-verify.ps1
restart-backend-diag.ps1
setup-projects.ps1
show-outputs.js
start-all.ps1
start-backend-log.ps1
train-agent.ps1
verify-blocks.ps1
verify-frontend.ps1
```

### Etape 2 : Mettre a jour dev-start.ps1

Remplacer les references aux anciens paths :
- `$MaestroRoot\backend` → `$MaestroRoot\apps\backend`
- `$MaestroRoot\frontend` → `$MaestroRoot\apps\desktop`

**IMPORTANT** : `$MaestroRoot = Split-Path -Parent $PSScriptRoot` ne change PAS car `dev-scripts/` reste a la racine. Seuls les paths INTERNES au script changent.

### Etape 3 : Mettre a jour les autres scripts gardes

Pour chaque script garde, verifier s'il reference `backend/` ou `frontend/` et mettre a jour :
- `kill-backend.ps1` — probablement reference le process, pas le dossier (verifier)
- `restart-backend.ps1` — peut reference `$MaestroRoot\backend` pour le `dotnet run`
- `build-release.ps1` — peut reference les deux dossiers
- `wait-backend.ps1`, `wait-backend-health.ps1`, `wait-services.ps1` — probablement des health checks HTTP, pas de paths a changer (verifier)

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| 25 scripts obsoletes (liste ci-dessus) | `git rm` |
| `dev-scripts/dev-start.ps1` | Mettre a jour `\backend` → `\apps\backend`, `\frontend` → `\apps\desktop` |
| `dev-scripts/kill-backend.ps1` | Verifier et mettre a jour les paths si necessaire |
| `dev-scripts/restart-backend.ps1` | Verifier et mettre a jour les paths si necessaire |
| `dev-scripts/build-release.ps1` | Verifier et mettre a jour les paths si necessaire |
| `dev-scripts/wait-backend.ps1` | Verifier (probablement aucun changement) |
| `dev-scripts/wait-backend-health.ps1` | Verifier (probablement aucun changement) |
| `dev-scripts/wait-services.ps1` | Verifier (probablement aucun changement) |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Nombre de scripts restants
powershell.exe -Command "(Get-ChildItem C:\Meastro\dev-scripts -Name).Count"
# Resultat attendu : ~10 (les scripts utiles + nugetCommands/ + README)

# Commande 2 : dev-start.ps1 ne refere plus a \backend ou \frontend directement
powershell.exe -Command "Select-String -Path C:\Meastro\dev-scripts\dev-start.ps1 -Pattern '\\backend[^s]' -SimpleMatch | Measure-Object | Select-Object -ExpandProperty Count"
# Resultat attendu : 0 (tout remplace par \apps\backend)
# Note : le \backend sans [^s] matcherait \backends, d'ou le filtre

# Commande 3 : Liste des scripts restants
powershell.exe -Command "(Get-ChildItem C:\Meastro\dev-scripts -Name) -join ', '"
# Resultat attendu : build-release.ps1, dev-start.ps1, kill-backend.ps1, nugetCommands, README.update-feature-from-main-branch.md, restart-backend.ps1, update-feature-from-main-branch.ps1, wait-backend.ps1, wait-backend-health.ps1, wait-services.ps1
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS supprimer `dev-start.ps1` — c'est le script principal de demarrage, reference dans CLAUDE.md
- Ne PAS garder des scripts one-time "au cas ou" — si c'est obsolete, supprimer
- Ne PAS deplacer `dev-scripts/` — il reste a la racine, seul le contenu est nettoye
- Ne PAS modifier `$MaestroRoot = Split-Path -Parent $PSScriptRoot` — cette ligne est correcte car dev-scripts/ reste au meme endroit

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-D-C : Nettoyage dev-scripts
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Scripts supprimes** : [nombre]
**Scripts restants** : [liste]
**dev-start.ps1 paths mis a jour** : [oui/non]
**Autres scripts mis a jour** : [liste ou "aucun"]
```
