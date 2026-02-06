# Plan d'Implémentation: TUI Monitor

Basé sur `DESIGN-TUI-MONITOR.md`

---

## Vue d'Ensemble

### Objectif
Implémenter un TUI Monitor complet supportant:
1. **Mode Global** - Liste des sessions (`maestro monitor --list`)
2. **Mode Session** - Monitoring d'une session spécifique (`maestro monitor <id>`)
3. **Layout Adaptatif** - EXECUTION vs IDLE automatique

### Architecture

```
tools/maestro-cli/monitor/
├── tui-monitor.js          # Point d'entrée principal (déjà existant, à modifier)
├── global-monitor.js       # NOUVEAU: Mode liste des sessions
├── session-monitor.js      # NOUVEAU: Mode session (refactor de tui-monitor.js)
└── components/
    ├── colors.js           # ✅ Fait
    ├── header.js           # ✅ Fait
    ├── workflow-tree.js    # ✅ Fait
    ├── filesystem.js       # ✅ Fait
    ├── variables.js        # ✅ Fait
    ├── command-log.js      # ✅ Fait
    ├── widgets-panel.js    # ✅ Fait
    ├── status-bar.js       # ✅ Fait
    └── session-list.js     # ✅ Fait (nouveau)
```

---

## Phase 1: Refactoring du Monitor Existant

### Tâche 1.1: Extraire SessionMonitor
- [ ] Renommer la logique actuelle de `tui-monitor.js` vers `session-monitor.js`
- [ ] `SessionMonitor` = classe pour monitoring d'UNE session
- [ ] Garder tout le code existant (layouts adaptatifs, composants)

### Tâche 1.2: Créer GlobalMonitor
- [ ] Créer `global-monitor.js` avec classe `GlobalMonitor`
- [ ] Affiche la liste des sessions (utilise `SessionListComponent`)
- [ ] Navigation: ↑↓ pour sélectionner, Enter pour ouvrir, 1-9 quick select
- [ ] Rafraîchissement automatique de la liste

### Tâche 1.3: Modifier tui-monitor.js comme Point d'Entrée
- [ ] `tui-monitor.js` devient un "router" simple:
  ```javascript
  if (sessionId) {
      // Mode Session
      const monitor = new SessionMonitor(sessionId, client, options);
  } else {
      // Mode Global (--list)
      const monitor = new GlobalMonitor(client, options);
  }
  ```

---

## Phase 2: Commandes CLI

### Tâche 2.1: Options Monitor dans index.js
Modifier `index.js` pour supporter:

```bash
# Mode Global - Liste des sessions
maestro monitor --list
maestro monitor              # Par défaut = --list

# Mode Session - Une session spécifique
maestro monitor <session-id>
maestro monitor <session-id> --layout workflow
maestro monitor <session-id> --layout idle

# Vues spécifiques
maestro monitor <session-id> --view tree
maestro monitor <session-id> --view files
maestro monitor <session-id> --view vars
```

### Tâche 2.2: Connexion depuis Global vers Session
- [ ] Dans `GlobalMonitor`, quand l'utilisateur appuie sur Enter:
  - Fermer GlobalMonitor
  - Ouvrir SessionMonitor avec la session sélectionnée
- [ ] Touche `Escape` dans SessionMonitor → retour à GlobalMonitor

---

## Phase 3: Flux Utilisateur Cible

### Scénario Principal

```
1. Utilisateur lance: maestro monitor
   → Affiche GlobalMonitor (liste des sessions)

2. Dans GlobalMonitor:
   - Voit toutes les sessions actives
   - Utilise ↑↓ pour naviguer
   - Appuie [Enter] ou [1-9] pour sélectionner

3. Transition vers SessionMonitor:
   - Affiche la session sélectionnée
   - Layout adaptatif (EXECUTION ou IDLE)

4. Dans un autre terminal:
   - maestro session create --project <id> --name "Test"
   - maestro session start <id>

5. GlobalMonitor se rafraîchit:
   - Nouvelle session apparaît dans la liste
   - Utilisateur peut la sélectionner
```

---

## Phase 4: Détails d'Implémentation

### 4.1 GlobalMonitor

```javascript
class GlobalMonitor {
    constructor(apiClient, options) {
        this.client = apiClient;
        this.sessions = [];
        this.selectedIndex = 0;
        this.refreshInterval = options.refreshInterval || 3000;
    }

    async start() {
        this.initScreen();
        this.initBoxes();
        this.setupKeys();
        await this.refresh();
        this.intervalId = setInterval(() => this.refresh(), this.refreshInterval);
    }

    setupKeys() {
        // Navigation
        this.screen.key(['up', 'k'], () => this.moveUp());
        this.screen.key(['down', 'j'], () => this.moveDown());

        // Sélection
        this.screen.key(['enter'], () => this.openSelectedSession());
        this.screen.key(['1','2','3','4','5','6','7','8','9'], (ch) => {
            this.selectByNumber(parseInt(ch));
            this.openSelectedSession();
        });

        // Actions
        this.screen.key(['n'], () => this.showNewSessionPrompt());
        this.screen.key(['r'], () => this.refresh());
        this.screen.key(['q', 'C-c'], () => this.quit());
    }

    async openSelectedSession() {
        const session = this.sessions[this.selectedIndex];
        if (!session) return;

        this.stop(); // Arrêter GlobalMonitor

        // Lancer SessionMonitor
        const sessionMonitor = new SessionMonitor(session.id, this.client, {
            onExit: () => this.restart() // Callback pour revenir
        });
        await sessionMonitor.start();
    }
}
```

### 4.2 SessionMonitor (refactor)

```javascript
class SessionMonitor {
    constructor(sessionId, apiClient, options) {
        this.sessionId = sessionId;
        this.client = apiClient;
        this.onExit = options.onExit || null; // Callback pour retour
        // ... reste du code existant
    }

    setupKeys() {
        // ... touches existantes ...

        // Retour à la liste
        this.screen.key(['escape', 'backspace'], () => {
            if (this.onExit) {
                this.stop();
                this.onExit();
            }
        });
    }
}
```

### 4.3 Modification index.js

```javascript
// Dans la section monitor command
if (cmd === 'monitor') {
    const sessionId = args._[1];
    const listMode = argv.list || !sessionId;

    if (listMode) {
        // Mode Global
        const { GlobalMonitor } = require('./monitor/global-monitor.js');
        const monitor = new GlobalMonitor(client, {
            refreshInterval: argv.refresh ? argv.refresh * 1000 : 3000
        });
        return monitor.start();
    } else {
        // Mode Session
        const { SessionMonitor } = require('./monitor/session-monitor.js');
        const monitor = new SessionMonitor(sessionId, client, {
            refreshInterval: argv.refresh ? argv.refresh * 1000 : 2000,
            layout: argv.layout || 'auto',
            view: argv.view || null
        });
        return monitor.start();
    }
}
```

---

## Phase 5: Tests

### Test Manuel

```powershell
# 1. Démarrer les services
powershell.exe -File C:\Meastro\scripts\dev-start.ps1

# 2. Lancer le monitor en mode global
cd C:\Meastro\tools\maestro-cli
node index.js monitor

# 3. Dans un autre terminal, créer une session
node index.js session create --project <id> --name "Test Session"
node index.js session start <id>

# 4. Observer la session apparaître dans le monitor
# 5. Sélectionner la session avec Enter
# 6. Vérifier le layout adaptatif
# 7. Appuyer Escape pour revenir à la liste
```

---

## Ordre d'Exécution

| # | Tâche | Fichier | Description |
|---|-------|---------|-------------|
| 1 | Créer GlobalMonitor | `global-monitor.js` | Classe pour mode liste |
| 2 | Refactor SessionMonitor | `session-monitor.js` | Extraire de tui-monitor.js |
| 3 | Modifier point d'entrée | `tui-monitor.js` | Router vers Global ou Session |
| 4 | Modifier CLI | `index.js` | Options --list, --layout, --view |
| 5 | Navigation Global→Session | `global-monitor.js` | Enter ouvre la session |
| 6 | Navigation Session→Global | `session-monitor.js` | Escape retourne à la liste |
| 7 | Tests | - | Validation du flux complet |

---

## Livrables

1. `tools/maestro-cli/monitor/global-monitor.js` - Mode liste des sessions
2. `tools/maestro-cli/monitor/session-monitor.js` - Mode session (refactoré)
3. `tools/maestro-cli/monitor/tui-monitor.js` - Point d'entrée simplifié
4. `tools/maestro-cli/index.js` - Options CLI mises à jour

---

## Notes

- Le composant `session-list.js` est déjà créé
- Les composants existants (header, variables, etc.) restent inchangés
- Le style visuel (fond noir, bordures blanches) est conservé
