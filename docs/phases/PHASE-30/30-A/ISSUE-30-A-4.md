# Issue 30-A-4 : Template session projet pour autonomous-dev

**Statut** : COMPLETE (2026-02-17)
**Estimation** : 30 minutes
**Bloquant** : Bloque 30-E (tests E2E)
**Prerequis** : Aucun

---

## Description

Creer le template de session projet `project-autonomous.session.json` qui configure une session pour utiliser l'agent `autonomous-dev`. Ce template definit les entry points, le layout du moniteur, et les variables initiales.

---

## Tache detaillee

### 1. Creer le fichier template

Chemin : `content/system/templates/sessions/project-autonomous.session.json`

Contenu :
```json
{
  "id": "project-autonomous",
  "type": "project",
  "description": "Project session with autonomous-dev agent for development tasks",
  "entryPoints": {
    "dev": "autonomous-dev",
    "plan": "task-planner",
    "review": "code-reviewer"
  },
  "variables": {
    "_monitorDescriptor": {
      "layout": {
        "mode": "split",
        "zones": {
          "left": { "width": "50%" },
          "right": { "width": "50%" },
          "bottom": { "height": "30%" }
        }
      },
      "components": [
        { "type": "execution-tree", "zone": "left" },
        { "type": "llm-activity", "zone": "right" },
        { "type": "execution-log", "zone": "bottom" }
      ]
    }
  },
  "config": {
    "maxIterations": 100,
    "timeout": 7200
  }
}
```

### 2. Verifier la compatibilite avec le CLI

Le CLI importe les templates via `importSessionTemplate()` dans `cli.ts`. Verifier que le format est compatible.

### 3. Verifier la compatibilite avec le moniteur

Le `_monitorDescriptor` doit correspondre au format attendu par les composants TUI. Verifier dans `shared/tui/` ou `maestro-cli/monitor/ink/`.

---

## Instructions de test

### Test 1 : Creation de session avec template

```bash
cd maestro-cli

# Creer une session avec le template
node index.js session create --type project --name "Template test" --template project-autonomous --repo "C:\Cantante" --start

# Verifier que la session a ete creee
node index.js session info <session-id>
# Attendu : type=project, status=active, name="Template test"
```

### Test 2 : Entry points importes

```bash
# Verifier les entry points
curl -s http://localhost:5000/api/sessions/<full-uuid>
# Attendu : entryPoints contient "dev", "plan", "review"
```

### Test 3 : MonitorDescriptor importe

```bash
# Verifier la variable _monitorDescriptor
curl -s http://localhost:5000/api/sessions/<full-uuid>/variables/_monitorDescriptor
# Attendu : JSON valide avec layout.mode, zones, components
# PAS de nested empty arrays
```

### Test 4 : Moniteur s'affiche correctement

```bash
# Lancer le moniteur
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"

# Verifier visuellement :
# - Le layout split s'affiche (left/right/bottom)
# - L'execution tree est vide mais visible
# - Le log est vide mais visible
# - L'activite LLM est vide mais visible
```

---

## Critere de completion

- [ ] Le fichier `project-autonomous.session.json` existe dans `content/system/templates/sessions/`
- [ ] `session create --template project-autonomous` cree une session sans erreur
- [ ] Les entry points `dev`, `plan`, `review` sont disponibles sur la session
- [ ] Le `_monitorDescriptor` est un objet valide (pas de nested arrays)
- [ ] Le moniteur TUI s'affiche avec le layout configure
- [ ] La session est liee au repo passe avec `--repo`

---

## Risques

- **Risque** : Le format du `_monitorDescriptor` n'est pas compatible avec le moniteur actuel
- **Mitigation** : Verifier le format attendu dans les composants TUI avant de creer le template
- **Risque** : Le `importSessionTemplate` ne gere pas les entry points de type agent
- **Mitigation** : Les entry points sont des mappings nom→blockId, generiques par nature. Pas de risque.
