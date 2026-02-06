# Guide d'Implémentation: Session Foundry "Generate Commit Tool"

Ce guide vous permet de **tester complètement** le flux Foundry Session en utilisant les commandes CLI directes. Vous pourrez ensuite lancer le Monitor Shell pour observer l'exécution en temps réel.

---

## Prérequis

### 1. Démarrer les services Maestro

```powershell
# Terminal 1: Démarrer tous les services
cd C:\Meastro
powershell.exe -File scripts\dev-start.ps1
```

### 2. Vérifier que les services sont actifs

```powershell
# Terminal 2: Vérifier la santé des services
cd C:\Meastro\tools\maestro-cli
node index.js health
```

**Sortie attendue:**
```
🏥 Health Check:
  Backend (localhost:5000):   ✅ Healthy
  LLM Provider (localhost:8000): ✅ Healthy
```

---

## PARTIE 1: Tester les Commandes CLI (Terminal 2)

### Étape 1: Lister les sessions existantes

```powershell
cd C:\Meastro\tools\maestro-cli
node index.js session list
```

**Sortie attendue:**
```
No interactive sessions found
  Create one with: maestro session create --project <id> --authority human
```

---

### Étape 2: Créer un projet pour la session

```powershell
# Créer le répertoire du projet
powershell -Command "New-Item -ItemType Directory -Force -Path 'C:\Users\arthu\foundry-repos\gen-commit'"

# Créer un projet Maestro
node index.js projects create --name "Gen Commit Foundry" --path "C:\Users\arthu\foundry-repos\gen-commit"
```

**Sortie attendue:**
```
✅ Project created successfully!

  ID:   proj-xxxxxxxx
  Name: Gen Commit Foundry
  Path: C:\Users\arthu\foundry-repos\gen-commit
```

**⚠️ Notez l'ID du projet** (ex: `proj-xxxxxxxx`) pour les commandes suivantes.

---

### Étape 3: Créer la session Foundry

```powershell
# Remplacez <PROJECT_ID> par l'ID du projet créé
node index.js session create --project <PROJECT_ID> --name "Generate Commit Tool Session" --authority human
```

**Sortie attendue:**
```
✅ Session created!

  ID:        sess-xxxxxxxx
  Name:      Generate Commit Tool Session
  Status:    created
  Authority: human
  Source:    sandbox

  Start it with: maestro session start sess-xxxxxxxx
  Execute cmd:   maestro session exec sess-xxxxxxxx "ls -la"
```

**⚠️ Notez l'ID de la session** (ex: `sess-xxxxxxxx`) pour les commandes suivantes.

---

### Étape 4: Configurer les variables de session

```powershell
# Remplacez <SESSION_ID> par l'ID de la session créée

# Variable: qualityThreshold (seuil de qualité cible)
node index.js session vars <SESSION_ID> set qualityThreshold 0.8

# Variable: maxIterations (nombre max d'itérations)
node index.js session vars <SESSION_ID> set maxIterations 10

# Variable: maxOptimizationRounds (rounds d'optimisation)
node index.js session vars <SESSION_ID> set maxOptimizationRounds 5

# Variable: currentPhase (phase actuelle)
node index.js session vars <SESSION_ID> set currentPhase 1

# Variable: scoreHistory (historique des scores) - JSON array
node index.js session vars <SESSION_ID> set scoreHistory "[]"
```

**Sortie attendue pour chaque commande:**
```
✅ Variable 'qualityThreshold' set successfully

  qualityThreshold: 0.8
```

---

### Étape 5: Vérifier les variables configurées

```powershell
node index.js session vars <SESSION_ID> list
```

**Sortie attendue:**
```
📝 Session Variables:

  qualityThreshold: 0.8
  maxIterations: 10
  maxOptimizationRounds: 5
  currentPhase: 1
  scoreHistory: []

  Set variable:    maestro session vars sess-xxx set <key> <value>
  Get variable:    maestro session vars sess-xxx get <key>
  Remove variable: maestro session vars sess-xxx remove <key>
```

---

### Étape 6: Importer le template de session

```powershell
# Importer le template foundry-default
node index.js session import <SESSION_ID> --template foundry-default
```

**Sortie attendue:**
```
📦 Importing template: foundry-default

  Importing variables...
    ✓ sessionMode
    ✓ autoEvaluate
    ✓ targetFitness
    ✓ maxIterations
    ✓ currentPhase
    ✓ currentIteration
    ✓ currentFitness
    ✓ scoreHistory
    ✓ improvementHistory
    ✓ pendingApprovals
    ✓ pendingApprovalCount
    ✓ recentEvents
  Importing entry points...
    ✓ start → workflow:foundry/agent-improvement-loop
    ✓ improve-agent → workflow:foundry/agent-improvement-loop
    ✓ create-tool → workflow:foundry/tool-creation
    ✓ validate-block → workflow:foundry/block-validation
    ✓ submit-approval → workflow:foundry/submit-for-approval
    ✓ run-training → workflow:foundry/training-run
  Importing widgets...
    ✓ fitness-progress (progress-bar)
    ✓ iteration-counter (counter)
    ✓ score-history (score-chart)
    ✓ pending-approvals (counter)
    ✓ recent-events (status-list)

✅ Template imported successfully!

  Imported:
    - 12 variable(s)
    - 6 entry point(s)
    - 5 widget(s)
```

---

### Étape 7: Vérifier les entry points

```powershell
node index.js session entry-points <SESSION_ID> list
```

**Sortie attendue:**
```
📍 Session Entry Points:

  start: workflow:foundry/agent-improvement-loop
  improve-agent: workflow:foundry/agent-improvement-loop
  create-tool: workflow:foundry/tool-creation
  validate-block: workflow:foundry/block-validation
  submit-approval: workflow:foundry/submit-for-approval
  run-training: workflow:foundry/training-run

  Invoke with: maestro session invoke sess-xxx <entry-point>
```

---

### Étape 8: Vérifier les widgets

```powershell
node index.js session widgets <SESSION_ID> list
```

**Sortie attendue:**
```
🔲 Session Widgets:

  fitness-progress (progress-bar)
    Config: {"label":"Fitness Score","current":"$.variables.currentFitness","max":1.0,"showPercentage":true}
  iteration-counter (counter)
    Config: {"label":"Iteration","value":"$.variables.currentIteration"}
  score-history (score-chart)
    Config: {"label":"Score History","data":"$.variables.scoreHistory","threshold":"$.variables.targetFitness"}
  pending-approvals (counter)
    Config: {"label":"Pending Approvals","value":"$.variables.pendingApprovalCount","alertThreshold":5}
  recent-events (status-list)
    Config: {"label":"Recent Events","items":"$.variables.recentEvents","maxItems":10,"showTimestamp":true}
```

---

### Étape 9: Afficher les informations complètes de la session

```powershell
node index.js session info <SESSION_ID>
```

**Sortie attendue:**
```
📋 Session Details:

  ID:           sess-xxxxxxxx
  Name:         Generate Commit Tool Session
  Status:       created
  Authority:    human
  Project ID:   proj-xxxxxxxx
  Workflow ID:  N/A
  Task:         N/A
  Access Level: controlled
  Working Dir:  N/A
  Commands:     0
  Created:      2026-02-05T...
  Started:      Not started
  Completed:    Not completed

  Commands:
    maestro session exec sess-xxx "ls -la"
    maestro session exec sess-xxx "blocks list"
    maestro session exec sess-xxx "diff"
```

---

### Étape 10: Démarrer la session

```powershell
node index.js session start <SESSION_ID>
```

**Sortie attendue:**
```
▶️  Starting session: sess-xxxxxxxx

✅ Session running

  Authority:    human
  Working Dir:  C:\Users\arthu\foundry-repos\gen-commit

  Execute commands with: maestro session exec sess-xxx "<command>"
  Stop session with:     maestro session stop sess-xxx
```

---

## PARTIE 2: Lancer le Monitor Shell (Terminal 3)

Maintenant que la session est démarrée, ouvrez un **nouveau terminal** pour observer l'exécution en temps réel:

```powershell
# Terminal 3: Monitor Shell
cd C:\Meastro\tools\maestro-cli
node index.js monitor <SESSION_ID>
```

**Affichage du Monitor:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MONITOR: sess-xxxxxxxx                                                          │
│  Status: Running | Duration: 0m 12s                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Variables:                                                                     │
│    qualityThreshold: 0.8          (user-defined)                                │
│    maxIterations: 10              (user-defined)                                │
│    maxOptimizationRounds: 5       (user-defined)                                │
│    currentPhase: 1                (user-defined)                                │
│    scoreHistory: []               (user-defined)                                │
│    sessionMode: development       (from template)                               │
│    autoEvaluate: true             (from template)                               │
│    targetFitness: 0.85            (from template)                               │
│    currentIteration: 0            (from template)                               │
│    currentFitness: 0              (from template)                               │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Execution Tree:                                                                │
│                                                                                 │
│  (No active execution)                                                          │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Recent Events:                                                                 │
│    [14:32:01] Session started                                                   │
│    [14:32:01] Variables loaded from template                                    │
│    [14:32:01] Entry points configured                                           │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Custom Widgets:                                                                │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Fitness Score               │  │ Iteration                               │  │
│  │ ░░░░░░░░░░░░░░░░░░░░ 0%    │  │ 0                                       │  │
│  │ Target: 85%                 │  │                                         │  │
│  └─────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Pending Approvals           │  │ Recent Events                           │  │
│  │ 0                           │  │ (empty)                                 │  │
│  └─────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [r] Refresh | [v] Toggle variables | [w] Toggle widgets | [Ctrl+C] Exit       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Gardez ce terminal ouvert pour observer les changements.**

---

## PARTIE 3: Invoquer des Entry Points (Terminal 2)

Retournez au Terminal 2 pour invoquer les workflows. Le Monitor (Terminal 3) affichera les changements en temps réel.

### Étape 11: Invoquer le workflow de validation de bloc

```powershell
# Valider un bloc existant
node index.js session invoke <SESSION_ID> validate-block
```

**Sortie attendue:**
```
▶️  Entry Point Invoked: validate-block

  Workflow: workflow:foundry/block-validation
  Status: started
  Message: Workflow execution initiated
```

**Dans le Monitor (Terminal 3), vous verrez:**
```
│  Execution Tree:                                                                │
│                                                                                 │
│  ▶ Workflow: block-validation                                          [⟳]     │
│    ├─ ▶ Task: load-block                                               [✓]     │
│    ├─ ▶ Validator: syntax-check                                        [⟳]     │
│    └─ ▶ Validator: schema-validation                                   [◯]     │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Recent Events:                                                                 │
│    [14:33:15] Entry point 'validate-block' invoked                             │
│    [14:33:15] Workflow block-validation started                                 │
│    [14:33:16] Task load-block completed                                        │
│    [14:33:17] Validator syntax-check running...                                │
```

---

### Étape 12: Invoquer le workflow d'amélioration d'agent

```powershell
# Lancer le loop d'amélioration
node index.js session invoke <SESSION_ID> start
```

**Sortie attendue:**
```
▶️  Entry Point Invoked: start

  Workflow: workflow:foundry/agent-improvement-loop
  Status: started
  Message: Workflow execution initiated
```

**Dans le Monitor (Terminal 3), vous verrez l'exécution du loop:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MONITOR: sess-xxxxxxxx                                                          │
│  Status: Running | Duration: 2m 34s                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Variables: (10 shown, press [v] to toggle)                                     │
│    currentIteration: 1            ← Updated!                                    │
│    currentFitness: 0.42           ← Updated!                                    │
│    scoreHistory: [0.42]           ← Updated!                                    │
│    targetFitness: 0.85                                                          │
│    qualityThreshold: 0.8                                                        │
│    maxIterations: 10                                                            │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Execution Tree:                                                                │
│                                                                                 │
│  ▶ Workflow: agent-improvement-loop                                    [⟳]     │
│    └─ ▶ While: improvement-cycle                                 [⟳ i=1]      │
│         ├─ ▶ Task: evaluate-current                                    [✓]     │
│         ├─ ▶ Inference: generate-improvement                           [⟳]     │
│         ├─ ▶ Task: apply-changes                                       [◯]     │
│         └─ ▶ Validator: check-fitness                                  [◯]     │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Recent Events:                                                                 │
│    [14:34:56] Entry point 'start' invoked                                      │
│    [14:34:56] Workflow agent-improvement-loop started                          │
│    [14:34:57] Task evaluate-current completed (fitness: 0.42)                  │
│    [14:34:58] Inference generate-improvement running...                        │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Custom Widgets:                                                                │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Fitness Score               │  │ Score History                           │  │
│  │ ████████░░░░░░░░░░░░ 42%   │  │ 1.0 ┤                                   │  │
│  │ Target: 85%                 │  │     │        ╭─ target (0.85)          │  │
│  │                             │  │ 0.5 ┤        │                         │  │
│  │                             │  │     │ •      │                         │  │
│  │                             │  │ 0.0 ┼────────┴─────────                │  │
│  └─────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────┐                                               │
│  │ Iteration                   │                                               │
│  │ 1 / 10                      │                                               │
│  └─────────────────────────────┘                                               │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [r] Refresh | [v] Toggle variables | [w] Toggle widgets | [Ctrl+C] Exit       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Étape 13: Mettre à jour une variable pendant l'exécution

```powershell
# Augmenter le seuil de qualité
node index.js session vars <SESSION_ID> set qualityThreshold 0.9
```

**Le Monitor se met à jour automatiquement:**
```
│  Variables:                                                                     │
│    qualityThreshold: 0.9    ← Updated!                                         │
```

---

## PARTIE 4: Tester le Système d'Approbation (Terminal 2)

### Étape 14: Soumettre un bloc pour approbation

```powershell
# Soumettre un bloc fictif pour approbation
node index.js block publish tools/git-diff --from-session <SESSION_ID>
```

**Sortie attendue:**
```
✅ Block submitted for approval:

  Approval ID: approval-xxxxxxxx
  Block:       Git Diff Tool (tool)
  Status:      pending
```

---

### Étape 15: Lister les approbations en attente

```powershell
node index.js block --pending-approval
```

**Sortie attendue:**
```
📋 Pending Block Approvals:

┌──────────────────┬─────────────────┬──────────┬─────────────────────┬──────────────┐
│ ID               │ Block           │ Type     │ Submitted           │ By           │
├──────────────────┼─────────────────┼──────────┼─────────────────────┼──────────────┤
│ approval-xxx...  │ Git Diff Tool   │ tool     │ 2026-02-05 14:35    │ cli-user     │
└──────────────────┴─────────────────┴──────────┴─────────────────────┴──────────────┘

Total: 1 pending approval(s)
```

---

### Étape 16: Voir les détails d'une approbation

```powershell
node index.js block info <APPROVAL_ID>
```

**Sortie attendue:**
```
📋 Approval Details:

  ID:          approval-xxxxxxxx
  Block ID:    tools/git-diff
  Block Name:  Git Diff Tool
  Block Type:  tool
  Status:      pending
  Session:     sess-xxxxxxxx
  Submitted:   2026-02-05 14:35:00
  Submitted By: cli-user
```

---

### Étape 17: Approuver le bloc

```powershell
node index.js block approve <APPROVAL_ID>
```

**Sortie attendue:**
```
✅ Block approved:

  Approval ID: approval-xxxxxxxx
  Block:       Git Diff Tool (tool)
  Status:      approved
  Reviewed By: cli-user
```

---

### Étape 18: (Alternatif) Rejeter un bloc avec feedback

```powershell
# Si vous voulez tester le rejet au lieu de l'approbation
node index.js block reject <APPROVAL_ID> --reason "Need to handle binary files"
```

**Sortie attendue:**
```
❌ Block rejected:

  Approval ID: approval-xxxxxxxx
  Block:       Git Diff Tool (tool)
  Status:      rejected
  Reason:      Need to handle binary files
  Reviewed By: cli-user
```

---

## PARTIE 5: Arrêter la Session (Terminal 2)

### Étape 19: Arrêter la session

```powershell
node index.js session stop <SESSION_ID>
```

**Sortie attendue:**
```
🛑 Stopping session: sess-xxxxxxxx

✅ Session stopped
```

**Le Monitor (Terminal 3) affichera:**
```
│  Status: Stopped | Duration: 15m 42s                                            │
│                                                                                 │
│  Recent Events:                                                                 │
│    [14:47:43] Session stop requested                                           │
│    [14:47:43] Saving session state...                                          │
│    [14:47:44] Session stopped                                                  │
```

---

## PARTIE 6: Nettoyage (Optionnel)

### Supprimer la session

```powershell
node index.js session delete <SESSION_ID>
```

### Supprimer le projet

```powershell
node index.js projects delete <PROJECT_ID> --force
```

---

## Résumé des Commandes CLI

| Action | Commande CLI |
|--------|-------------|
| **Vérifier santé** | `node index.js health` |
| **Créer projet** | `node index.js projects create --name "..." --path "..."` |
| **Créer session** | `node index.js session create --project <id> --name "..." --authority human` |
| **Configurer variable** | `node index.js session vars <id> set <key> <value>` |
| **Lister variables** | `node index.js session vars <id> list` |
| **Importer template** | `node index.js session import <id> --template <name>` |
| **Lister entry points** | `node index.js session entry-points <id> list` |
| **Lister widgets** | `node index.js session widgets <id> list` |
| **Info session** | `node index.js session info <id>` |
| **Démarrer session** | `node index.js session start <id>` |
| **Invoquer entry point** | `node index.js session invoke <id> <entry-point>` |
| **Monitorer** | `node index.js monitor <id>` |
| **Soumettre approbation** | `node index.js block publish <block-id> --from-session <session-id>` |
| **Lister approbations** | `node index.js block --pending-approval` |
| **Détails approbation** | `node index.js block info <approval-id>` |
| **Approuver** | `node index.js block approve <approval-id>` |
| **Rejeter** | `node index.js block reject <approval-id> --reason "..."` |
| **Arrêter session** | `node index.js session stop <id>` |
| **Supprimer session** | `node index.js session delete <id>` |

---

## Script de Test Complet

Voici un script PowerShell pour tester automatiquement le flux complet:

```powershell
# test-foundry-session.ps1
# Exécuter depuis C:\Meastro\tools\maestro-cli

$ErrorActionPreference = "Stop"

Write-Host "=== Test Foundry Session ===" -ForegroundColor Cyan

# 1. Health check
Write-Host "`n[1/10] Health check..." -ForegroundColor Yellow
node index.js health

# 2. Create project
Write-Host "`n[2/10] Creating project..." -ForegroundColor Yellow
$projectOutput = node index.js projects create --name "Test Foundry" --path "C:\temp\test-foundry" 2>&1
Write-Host $projectOutput
$projectId = ($projectOutput | Select-String -Pattern "ID:\s+(\S+)").Matches.Groups[1].Value
Write-Host "Project ID: $projectId" -ForegroundColor Green

# 3. Create session
Write-Host "`n[3/10] Creating session..." -ForegroundColor Yellow
$sessionOutput = node index.js session create --project $projectId --name "Test Session" --authority human 2>&1
Write-Host $sessionOutput
$sessionId = ($sessionOutput | Select-String -Pattern "ID:\s+(\S+)").Matches.Groups[1].Value
Write-Host "Session ID: $sessionId" -ForegroundColor Green

# 4. Set variables
Write-Host "`n[4/10] Setting variables..." -ForegroundColor Yellow
node index.js session vars $sessionId set qualityThreshold 0.8
node index.js session vars $sessionId set maxIterations 10

# 5. List variables
Write-Host "`n[5/10] Listing variables..." -ForegroundColor Yellow
node index.js session vars $sessionId list

# 6. Import template
Write-Host "`n[6/10] Importing template..." -ForegroundColor Yellow
node index.js session import $sessionId --template foundry-default

# 7. List entry points
Write-Host "`n[7/10] Listing entry points..." -ForegroundColor Yellow
node index.js session entry-points $sessionId list

# 8. Start session
Write-Host "`n[8/10] Starting session..." -ForegroundColor Yellow
node index.js session start $sessionId

# 9. Session info
Write-Host "`n[9/10] Session info..." -ForegroundColor Yellow
node index.js session info $sessionId

# 10. Stop session
Write-Host "`n[10/10] Stopping session..." -ForegroundColor Yellow
node index.js session stop $sessionId

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Session ID: $sessionId"
Write-Host "Project ID: $projectId"
Write-Host "`nTo monitor: node index.js monitor $sessionId"
Write-Host "To cleanup: node index.js session delete $sessionId && node index.js projects delete $projectId --force"
```

---

## Dépannage

### Erreur: "Cannot connect to backend"
```
❌ Cannot connect to backend at http://localhost:5000
```
**Solution:** Vérifiez que les services sont démarrés avec `powershell.exe -File scripts\dev-start.ps1`

### Erreur: "Session not found"
```
❌ Session not found: sess-xxx
```
**Solution:** Vérifiez l'ID de session avec `node index.js session list`

### Erreur: "Template not found"
```
❌ Template not found: xxx
```
**Solution:** Templates disponibles: `foundry-default`, `foundry-training`, `foundry-sandbox`

### Le Monitor ne se met pas à jour
**Solution:** Appuyez sur `r` pour rafraîchir manuellement, ou vérifiez que la session est bien en état "Running"
