# Foundry Session - Quick Start

Guide de démarrage rapide pour créer et utiliser une session Foundry.

## Prérequis

```powershell
# 1. Démarrer les services Maestro
powershell.exe -File C:\Meastro\scripts\dev-start.ps1

# 2. Attendre que les services soient prêts
cd C:\Meastro\tools\maestro-cli
node index.js health
```

## En 5 minutes

### Étape 1: Créer une session

```bash
node index.js session create --name "My Foundry Session" --type foundry
```

Notez l'ID de session retourné (ex: `session-abc123`).

### Étape 2: Démarrer la session

```bash
node index.js session start session-abc123
```

### Étape 3: Configurer les entry points

Les entry points sont automatiquement configurés par le template. Vérifiez:

```bash
node index.js session info session-abc123
```

### Étape 4: Invoquer un workflow

```bash
# Valider un bloc existant
node index.js session invoke session-abc123 validate-block \
  --input blockId=tools/git-diff

# Ou lancer un training run
node index.js session invoke session-abc123 run-training \
  --input blockId=agents/task-decomposer \
  --input iterations=5
```

### Étape 5: Surveiller le progrès

```bash
node index.js monitor session-abc123
```

## Shell Interactif

Pour une expérience plus fluide, utilisez le shell interactif:

```bash
node index.js
```

Vous verrez:
```
╔══════════════════════════════════════════════════════════╗
║                    MAESTRO SHELL                         ║
║              Agent Orchestration System                  ║
╚══════════════════════════════════════════════════════════╝

Type 'help' for available commands, 'exit' to quit.

maestro>
```

### Commandes shell courantes

```bash
maestro> session list
maestro> session start abc123
maestro> session vars abc123 list
maestro> approval list
maestro> monitor abc123
maestro> help
maestro> exit
```

## Workflows les plus utilisés

### Améliorer un agent

```bash
session invoke <id> improve-agent --input agentId=my-agent --input targetFitness=0.85
```

### Créer un outil

```bash
session invoke <id> create-tool --input name=my-tool --input description="Does something"
```

### Soumettre pour approbation

```bash
approval submit my-block --session <session-id>
```

### Approuver un bloc

```bash
approval approve <approval-id>
```

## Variables utiles

| Variable | Valeur par défaut | Description |
|----------|-------------------|-------------|
| `targetFitness` | 0.85 | Score cible |
| `maxIterations` | 50 | Limite d'itérations |
| `autoEvaluate` | true | Évaluation auto |

Modifier:
```bash
session vars <id> set targetFitness 0.9
```

## Aide

```bash
node index.js --help
node index.js session --help
node index.js approval --help
```

Pour le guide complet, voir: `docs/guides/foundry-session-guide.md`
