# Plan de tests d'intégration CLI — Phase 12

**Objectif**: Valider que l'ensemble des changements de la Phase 12 fonctionne de bout en bout via le CLI. Ces tests sont les critères de **done** — tant qu'ils ne passent pas, le travail n'est pas terminé.

**Prérequis**: Backend démarré sur `localhost:5000`

---

## Structure

Les tests sont organisés par feature et par priorité. Chaque test est une commande CLI avec le résultat attendu.

**Notation** :
- `$` = commande à exécuter
- `→` = résultat attendu
- `✓` = assertion spécifique à vérifier

---

## Partie 1 : Smoke Tests — Vérification de base

### T1.1 : Health check

```bash
$ node index.js health
→ Backend is healthy
✓ Exit code = 0
```

### T1.2 : Health check en JSON

```bash
$ node index.js --json '{"command":"health"}'
→ {"status":"ok","data":{...},"command":"health"}
✓ Réponse est du JSON valide
✓ data contient un champ status ou healthy
✓ status == "ok"
```

### T1.3 : Schema disponible

```bash
$ node index.js --schema
→ JSON avec commands.session.create, commands.session.invoke, etc.
✓ Réponse est du JSON valide
✓ commands contient au minimum: health, session.create, session.list, session.invoke
✓ Chaque commande a "description" et "params"
```

### T1.4 : Erreur JSON — commande invalide

```bash
$ node index.js --json '{"command":"nonexistent.command"}'
→ {"status":"error","code":"UNKNOWN_COMMAND",...}
✓ Réponse est du JSON valide
✓ status == "error"
```

### T1.5 : Erreur JSON — JSON malformé

```bash
$ node index.js --json 'not-json'
→ {"status":"error","code":"PARSE_ERROR",...}
✓ Réponse est du JSON valide
✓ Exit code != 0
```

---

## Partie 2 : Runtime Hardening

### T2.1 : Exécution dans un working directory valide

```bash
# Prérequis: une session active avec un container
$ node index.js session exec <session-id> "echo hello"
→ hello
✓ Exit code = 0
```

### T2.2 : Variables d'environnement filtrées

```bash
# Exécuter dans une session et vérifier qu'ASPNETCORE_* n'est pas là
$ node index.js session exec <session-id> "env"
→ Liste des env vars
✓ Ne contient PAS ASPNETCORE_URLS
✓ Ne contient PAS ConnectionStrings__
✓ Contient PATH
```

**Note**: Ce test nécessite que le ProcessContainerRuntime soit actif et que la session exécute via le container runtime. Si la commande `session exec` ne passe pas par le runtime, ce test devra être adapté au mécanisme réel d'exécution.

---

## Partie 3 : CLI JSON Mode — Sessions

### T3.1 : Créer une session en mode JSON

```bash
$ node index.js --json '{"command":"session.create","params":{"type":"foundry","name":"JSON Test Session","project":"test-project"}}'
→ {"status":"ok","data":{"sessionId":"...","name":"JSON Test Session",...}}
✓ Réponse est du JSON valide
✓ status == "ok"
✓ data.sessionId est défini et non vide
✓ data.name == "JSON Test Session"
```

### T3.2 : Lister les sessions en mode JSON

```bash
$ node index.js --json '{"command":"session.list"}'
→ {"status":"ok","data":[...],...}
✓ Réponse est du JSON valide
✓ data est un tableau
✓ Le tableau contient la session créée en T3.1
```

### T3.3 : Info session en mode JSON

```bash
$ node index.js --json '{"command":"session.info","params":{"id":"<session-id-from-T3.1>"}}'
→ {"status":"ok","data":{"id":"...","name":"JSON Test Session","status":"created",...}}
✓ data.id == session-id de T3.1
✓ data.status == "created"
```

### T3.4 : Start session en mode JSON

```bash
$ node index.js --json '{"command":"session.start","params":{"id":"<session-id>"}}'
→ {"status":"ok",...}
✓ status == "ok"
```

### T3.5 : Set variable en mode JSON

```bash
$ node index.js --json '{"command":"session.set-var","params":{"id":"<session-id>","key":"testVar","value":"hello world"}}'
→ {"status":"ok",...}
✓ status == "ok"
```

### T3.6 : Get variable en mode JSON

```bash
$ node index.js --json '{"command":"session.get-var","params":{"id":"<session-id>","key":"testVar"}}'
→ {"status":"ok","data":{"key":"testVar","value":"hello world"}}
✓ data.value == "hello world"
```

### T3.7 : Stop session en mode JSON

```bash
$ node index.js --json '{"command":"session.stop","params":{"id":"<session-id>"}}'
→ {"status":"ok",...}
✓ status == "ok"
```

### T3.8 : Stdin JSON mode

```bash
$ echo '{"command":"session.list"}' | node index.js --json
→ {"status":"ok","data":[...]}
✓ Même résultat que T3.2
```

### T3.9 : Non-régression mode texte

```bash
$ node index.js session list
→ Affichage texte avec tableau et emojis (pas du JSON)
✓ Sortie contient des caractères non-JSON (emojis, headers de table)
✓ Exit code = 0
```

---

## Partie 4 : Universal Repository Binding — Foundry Session

### T4.1 : Créer un repo temporaire

```bash
$ mkdir /tmp/maestro-test-foundry && cd /tmp/maestro-test-foundry && git init
→ Initialized empty Git repository
```

### T4.2 : Créer une session Foundry bindée au repo

```bash
$ node index.js session create --type foundry --name "Bound Foundry" --project test-project --repo-path /tmp/maestro-test-foundry
→ ✅ Session created!
→ ID: foundry-...
✓ Session créée avec succès
✓ Retenir l'ID de session
```

### T4.3 : Vérifier que la structure .maestro/ a été créée

```bash
$ ls /tmp/maestro-test-foundry/.maestro/
→ docs/  logs/  artifacts/  metrics/  session.json
✓ Tous les dossiers existent
✓ session.json existe et contient le sessionId
```

### T4.4 : Vérifier session.json

```bash
$ cat /tmp/maestro-test-foundry/.maestro/session.json
→ {"sessionId":"foundry-...","sessionType":"FoundrySession","name":"Bound Foundry",...}
✓ sessionId correspond à l'ID de T4.2
✓ sessionType == "FoundrySession"
```

### T4.5 : Info session montre le repo path

```bash
$ node index.js session info <session-id>
→ ... Repository: /tmp/maestro-test-foundry ...
✓ Le RepositoryPath est visible dans les infos de session
```

### T4.6 : Créer une session Foundry bindée en mode JSON

```bash
$ node index.js --json '{"command":"session.create","params":{"type":"foundry","name":"JSON Bound Foundry","project":"test-project","repo-path":"/tmp/maestro-test-foundry-2"}}'
→ {"status":"ok","data":{"sessionId":"foundry-...",...}}
✓ .maestro/ créé dans /tmp/maestro-test-foundry-2
```

### T4.7 : Créer une session Foundry SANS binding (rétrocompatibilité)

```bash
$ node index.js session create --type foundry --name "Sandbox Foundry" --project test-project
→ ✅ Session created!
✓ Session créée sans erreur
✓ Pas de .maestro/ créé (la session est sandbox)
```

---

## Partie 5 : Universal Repository Binding — Workspace

### T5.1 : Créer un repo pour le workspace

```bash
$ mkdir /tmp/maestro-test-workspace && cd /tmp/maestro-test-workspace && git init
```

### T5.2 : Créer un workspace bindé

```bash
$ node index.js workspace create "Test Workspace" --type Research --repo-path /tmp/maestro-test-workspace
→ ✅ Workspace created!
✓ Workspace créé avec succès
✓ Retenir l'ID
```

### T5.3 : Vérifier la structure .maestro/

```bash
$ ls /tmp/maestro-test-workspace/.maestro/
→ docs/  logs/  artifacts/  metrics/  session.json
✓ session.json contient sessionType == "Workspace"
```

### T5.4 : Info workspace montre le binding

```bash
$ node index.js workspace info <workspace-id>
→ ... Repository: /tmp/maestro-test-workspace ...
✓ Le RepositoryPath est visible
```

### T5.5 : Créer un workspace SANS binding (rétrocompatibilité)

```bash
$ node index.js workspace create "Sandbox Workspace" --type Research
→ ✅ Workspace created!
✓ Workspace créé sans erreur
✓ Binding == None
```

---

## Partie 6 : Universal Repository Binding — Project Session

### T6.1 : Créer une project session bindée (mode existant)

```bash
$ node index.js session create --project test-project --source repository --repository-path /tmp/maestro-test-project
→ ✅ Session created!
✓ Rétrocompatibilité: --source repository --repository-path fonctionne toujours
```

### T6.2 : Créer une project session bindée (nouveau mode)

```bash
$ node index.js session create --project test-project --name "Repo Bound" --repo-path /tmp/maestro-test-project-2
→ ✅ Session created!
✓ .maestro/ créé dans /tmp/maestro-test-project-2
✓ Le nouveau flag --repo-path fonctionne pour les project sessions aussi
```

---

## Partie 7 : Persistance et reload

### T7.1 : Redémarrer le backend et vérifier la persistance

```bash
# 1. Créer une session bindée
$ node index.js session create --type foundry --name "Persist Test" --project test-project --repo-path /tmp/maestro-persist-test
→ Session ID: foundry-xxx

# 2. Redémarrer le backend
$ powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -Stop
$ powershell.exe -File C:\Meastro\scripts\dev-start.ps1 -BackendOnly

# 3. Vérifier que la session est toujours là
$ node index.js session info foundry-xxx
→ ... Repository: /tmp/maestro-persist-test ...
✓ RepositoryPath est préservé après redémarrage
✓ Status et metadata sont préservés
```

### T7.2 : Charger une session ancienne (sans repositoryPath dans le JSON)

```bash
# Ce test vérifie la rétrocompatibilité.
# Vérifier que les sessions Foundry existantes (avant cette feature) se chargent sans erreur.
$ node index.js session list
→ Toutes les sessions existantes apparaissent
✓ Pas d'erreur de désérialisation
✓ Les sessions sans RepositoryPath ont IsBoundToRepository == false
```

---

## Partie 8 : Scénario end-to-end complet

### T8.1 : Workflow complet d'un agent via JSON mode

Ce test simule un agent qui interagit avec Maestro uniquement via le CLI JSON mode :

```bash
# 1. Vérifier la santé
$ node index.js --json '{"command":"health"}'
✓ status == "ok"

# 2. Créer un workspace
$ node index.js --json '{"command":"workspace.create","params":{"name":"Agent Workspace","type":"Research","repo-path":"/tmp/maestro-e2e-test"}}'
✓ status == "ok", data.id défini

# 3. Créer une session Foundry dans le workspace
$ node index.js --json '{"command":"session.create","params":{"type":"foundry","name":"Agent Training","project":"test-project","repo-path":"/tmp/maestro-e2e-test/sessions/training"}}'
✓ status == "ok", data.sessionId défini

# 4. Importer un template
$ node index.js session import <session-id> --template foundry-default
✓ Pas d'erreur

# 5. Vérifier les entry points
$ node index.js --json '{"command":"session.info","params":{"id":"<session-id>"}}'
✓ data.entryPoints contient "start"

# 6. Set une variable
$ node index.js --json '{"command":"session.set-var","params":{"id":"<session-id>","key":"targetFitness","value":0.8}}'
✓ status == "ok"

# 7. Lire la variable
$ node index.js --json '{"command":"session.get-var","params":{"id":"<session-id>","key":"targetFitness"}}'
✓ data.value == 0.8

# 8. Vérifier la structure du repo
$ ls /tmp/maestro-e2e-test/sessions/training/.maestro/
✓ docs/ logs/ artifacts/ metrics/ session.json

# 9. Arrêter la session
$ node index.js --json '{"command":"session.stop","params":{"id":"<session-id>"}}'
✓ status == "ok"

# 10. Vérifier l'état final
$ node index.js --json '{"command":"session.info","params":{"id":"<session-id>"}}'
✓ data.status == "ended" ou "stopped"
```

---

## Partie 9 : Tests négatifs

### T9.1 : Créer une session avec repo-path inexistant

```bash
$ node index.js session create --type foundry --name "Bad Path" --project test-project --repo-path /nonexistent/path
→ Erreur claire
✓ Message d'erreur mentionne le chemin invalide
✓ Pas de crash du backend
```

### T9.2 : JSON mode — paramètre manquant

```bash
$ node index.js --json '{"command":"session.create","params":{"type":"foundry"}}'
→ {"status":"error","code":"...","message":"Missing required parameter: name"}
✓ Erreur structurée, pas de crash
```

### T9.3 : JSON mode — commande sans params

```bash
$ node index.js --json '{"command":"session.create"}'
→ {"status":"error",...}
✓ Message d'erreur clair sur les paramètres manquants
```

### T9.4 : Double binding (même repo pour deux sessions)

```bash
$ mkdir /tmp/maestro-double-bind
$ node index.js session create --type foundry --name "Session A" --project test-project --repo-path /tmp/maestro-double-bind
$ node index.js session create --type foundry --name "Session B" --project test-project --repo-path /tmp/maestro-double-bind
→ Doit réussir OU donner une erreur claire
✓ Si succès : chaque session a son ID dans session.json (le dernier écrase)
✓ Si erreur : message clair que le repo est déjà bindé
✓ Pas de crash dans les deux cas
```

---

## Partie 10 : Backend unit tests

### T10.1 : Vérifier que tous les tests backend passent

```bash
$ cd C:\Meastro\backend && dotnet test
→ Tous les tests passent
✓ 0 tests en échec (hors tests pré-existants en échec documentés dans CLAUDE.md)
✓ Les nouveaux tests de la Phase 12 sont inclus et passent :
  - ContainerSession binding tests
  - ProjectSession modified tests
  - FoundrySession binding tests
  - Workspace binding tests
  - ProcessContainerRuntime security tests
  - PathValidator tests
```

### T10.2 : Vérifier que le frontend compile

```bash
$ cd C:\Meastro\frontend && npm run build
→ Build successful
✓ Pas d'erreur de compilation
```

---

## Résumé — Checklist de validation finale

| # | Test | Feature | Bloquant |
|---|------|---------|----------|
| T1.1 | Health check texte | Baseline | Oui |
| T1.2 | Health check JSON | CLI JSON | Oui |
| T1.3 | Schema | CLI JSON | Oui |
| T1.4 | Erreur commande inconnue JSON | CLI JSON | Oui |
| T1.5 | Erreur JSON malformé | CLI JSON | Oui |
| T2.1 | Exec dans workdir valide | Runtime | Non* |
| T2.2 | Env vars filtrées | Runtime | Non* |
| T3.1 | Session create JSON | CLI JSON | Oui |
| T3.2 | Session list JSON | CLI JSON | Oui |
| T3.3 | Session info JSON | CLI JSON | Oui |
| T3.4 | Session start JSON | CLI JSON | Oui |
| T3.5 | Session set-var JSON | CLI JSON | Oui |
| T3.6 | Session get-var JSON | CLI JSON | Oui |
| T3.7 | Session stop JSON | CLI JSON | Oui |
| T3.8 | Stdin JSON | CLI JSON | Oui |
| T3.9 | Non-régression texte | CLI JSON | Oui |
| T4.1-4.7 | Foundry binding | Repo Binding | Oui |
| T5.1-5.5 | Workspace binding | Repo Binding | Oui |
| T6.1-6.2 | Project binding | Repo Binding | Oui |
| T7.1-7.2 | Persistance | Repo Binding | Oui |
| T8.1 | End-to-end agent | Tous | Oui |
| T9.1-9.4 | Tests négatifs | Robustesse | Oui |
| T10.1 | Backend tests | Tous | Oui |
| T10.2 | Frontend build | Baseline | Oui |

*T2.1-T2.2 : dépendent de l'implémentation du runtime dans le flow de `session exec`. Si `session exec` n'utilise pas le container runtime, ces tests doivent être adaptés.

---

## Automatisation (futur)

Ces tests sont conçus pour être exécutables manuellement ou par un script. Un futur script d'intégration pourrait :

1. Démarrer le backend
2. Exécuter chaque test séquentiellement
3. Parser les réponses JSON pour les assertions
4. Nettoyer les sessions/repos créés
5. Reporter pass/fail

Pour l'instant, l'agent qui implémente la Phase 12 doit exécuter ces tests manuellement via le CLI et confirmer chaque assertion.
