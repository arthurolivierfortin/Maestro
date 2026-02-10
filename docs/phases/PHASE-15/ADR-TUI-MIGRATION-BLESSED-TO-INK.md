# ADR — Migration du TUI Monitor : blessed vers Ink

**Date** : 2026-02-10
**Statut** : Accepté
**Auteurs** : Discussion utilisateur + Claude
**Phase** : 15

---

## Contexte

Le TUI Monitor de Maestro est construit sur `blessed@0.1.81` et `blessed-contrib@4.11.0`. Une analyse approfondie a révélé que :

1. **blessed est abandonné** — Dernier release il y a ~10 ans, 440+ issues ouvertes sans mainteneur, aucun patch de sécurité, pas de support TypeScript ni ESM
2. **blessed-contrib n'est pas utilisé** — Installé mais aucun widget contrib n'est référencé dans le code
3. **L'utilisation de blessed est minimale** — Seuls `blessed.box()` et `blessed.screen()` sont utilisés (aucun `list`, `table`, `progressbar`, etc.)
4. **Le code est bien structuré** — 24 fichiers, ~4,200 LOC, architecture en composants propre

La question posée était double :
- blessed est-il la bonne lib ?
- Le TUI tout court est-il une bonne idée ?

## Décision

### 1. Garder le TUI — oui

Le TUI reste pertinent pour Maestro car il sert de **prototype rapide des features UI** :

- Le frontend React est en retard et complexe (ReactFlow canvas, debugging difficile)
- Le TUI permet de tester rapidement des concepts d'interface avant de les porter au frontend
- Le TUI offre une expérience terminal native appréciée pour le monitoring en temps réel
- En mode headless (SSH, CI/CD, agents automatisés), le TUI est la seule option visuelle

Le TUI n'est pas une duplication du frontend — c'est un **terrain d'expérimentation plus agile** qui alimente les décisions UI du frontend.

### 2. Migrer de blessed vers Ink — oui

**Ink** (React pour le terminal) est le remplacement choisi pour les raisons suivantes :

| Critère | blessed | Ink |
|---------|---------|-----|
| Maintenance | Abandonné (~10 ans) | Actif (v6.6, releases mensuelles) |
| Écosystème | Mort | Massif (GitHub Copilot CLI, Prisma, Shopify) |
| TypeScript | Non | Natif |
| Modèle | Impératif (setContent, show/hide) | Déclaratif (React JSX) |
| Test | Difficile (mock blessed) | Jest + React Testing Library |
| Réutilisabilité | Aucune vers le frontend | **Hooks et logique React partageable** |

### 3. Avantage clé : réutilisabilité React

Ink utilisant React, les composants développés pour le TUI partagent :
- **Hooks personnalisés** (`useSessionData`, `useRefreshInterval`, `useKeyboardNav`) — directement réutilisables dans le frontend React
- **Logique de rendu** (formatage de phases, couleurs de statut, arbre d'exécution) — même code, différent renderer
- **Types TypeScript** (si migration TS ultérieure) — partagés entre TUI et frontend

Ce n'est pas juste un remplacement 1:1 — c'est un investissement dans une couche de logique UI partagée.

## Alternatives considérées

### A. Garder blessed, ne rien changer
- **Pour** : Zéro effort, le TUI fonctionne aujourd'hui
- **Contre** : Bombe à retardement (cassera avec une future version Node.js), pas de types, debugging pénible, aucun écosystème pour ajouter des features Phase 15
- **Verdict** : Risque croissant, bloque les améliorations UX

### B. Supprimer le TUI, investir dans CLI + Frontend
- **Pour** : Élimine la maintenance TUI, concentre l'effort
- **Contre** : Perd le terrain d'expérimentation rapide, le frontend n'est pas prêt à remplacer le TUI
- **Verdict** : Prématuré — le frontend doit d'abord rattraper

### C. Migrer vers terminal-kit (bas-niveau)
- **Pour** : Maintenu, léger, contrôle total
- **Contre** : Impératif (pas de React), pas de réutilisabilité vers le frontend, plus de code à écrire
- **Verdict** : Effort similaire à Ink mais sans les bénéfices React

### D. Migrer vers Ratatui.cs (Rust/C#)
- **Pour** : Performance native, intégration backend directe
- **Contre** : Encore en alpha (v0.3.3), sépare le TUI du CLI Node.js, stack complètement différente
- **Verdict** : Intéressant pour le futur mais trop immature

### E. @farjs/blessed (fork maintenu)
- **Pour** : Drop-in replacement, zéro migration
- **Contre** : Même API vieillissante, même limitations, communauté minuscule
- **Verdict** : Pansement, pas une solution

## Audit du code existant

### Inventaire des fichiers (24 fichiers, ~4,200 LOC)

```
maestro-cli/monitor/
├── tui-monitor.js              70 LOC   Entry point / routeur
├── global-monitor.js          299 LOC   Liste des sessions
├── session-monitor.js         716 LOC   Monitor principal (le plus gros)
├── monitor.js                 377 LOC   Legacy/fallback
├── components/
│   ├── colors.js              104 LOC   Thème et tag helpers
│   ├── header.js              156 LOC   En-tête session
│   ├── phase-workflow.js      193 LOC   Phases + arbre fusionnés
│   ├── workflow-tree.js       157 LOC   Arbre d'exécution
│   ├── widgets-panel.js       355 LOC   Widgets custom
│   ├── variables.js           132 LOC   Variables groupées
│   ├── session-list.js        187 LOC   Cartes de session
│   ├── filesystem.js          178 LOC   Navigateur fichiers
│   ├── llm-activity.js        109 LOC   Activité LLM
│   ├── metrics-panel.js       102 LOC   Métriques fitness
│   ├── phase-list.js           98 LOC   Liste phases (legacy)
│   ├── status-bar.js           90 LOC   Barre de statut
│   ├── execution-log.js        68 LOC   Log d'exécution
│   ├── block-detail.js              LOC   Détail bloc
│   ├── command-log.js               LOC   Historique commandes
│   └── artifacts.js                 LOC   Artefacts
└── widgets/
    ├── counter.js              81 LOC   Widget compteur
    ├── progress-bar.js         92 LOC   Barre de progression
    ├── score-chart.js         134 LOC   Sparkline scores
    └── status-list.js         138 LOC   Liste de statuts
```

### Utilisation réelle de blessed

| Feature blessed | Utilisée ? | Détail |
|-----------------|-----------|--------|
| `blessed.screen()` | Oui (2x) | GlobalMonitor, SessionMonitor |
| `blessed.box()` | Oui (~25x) | Seul widget utilisé partout |
| `blessed.list()` | Non | |
| `blessed.table()` | Non | |
| `blessed.text()` | Non | |
| `blessed.progressbar()` | Non | |
| `blessed-contrib.*` | Non | Aucun widget contrib |
| Mouse events | Non | |
| Forms / inputs | Non | |

**Conclusion** : blessed est utilisé comme un "framework de boîtes colorées". L'architecture de composants est propre et la logique métier est largement indépendante de blessed.

### Répartition du couplage

| Catégorie | LOC estimé | Couplage blessed | Effort migration |
|-----------|-----------|-----------------|-----------------|
| Logique métier (rendu texte, formatage) | ~1,500 | Aucun | Aucun |
| Tags de couleur (`{cyan-fg}...{/}`) | ~300 | Syntaxe only | Faible (search-replace) |
| Layout (box positioning) | ~400 | Fort | Moyen (JSX flexbox) |
| Screen lifecycle | ~100 | Fort | Faible (Ink gère) |
| Keyboard handling | ~200 | Moyen | Faible (hooks) |
| Scrolling / auto-focus | ~200 | Fort | Moyen |

**~60% du code est réutilisable tel quel ou avec des changements cosmétiques.**

## Plan de migration

### Principes

1. **Composant par composant** — Pas de big bang. Chaque composant migre indépendamment.
2. **Business logic d'abord** — Extraire la logique de rendu dans des fonctions pures, puis wrapper en React.
3. **Garder le blessed fonctionnel** — L'ancien monitor reste disponible via `--legacy` pendant la migration.
4. **Tests dès le départ** — Chaque composant Ink a un test (Jest + ink-testing-library).

### Phases de migration

#### Phase M1 : Fondations Ink (2 jours)

- Installer `ink`, `react`, `ink-testing-library`
- Créer le squelette : `App` component, `useSessionData` hook, thème/couleurs
- Convertir `colors.js` : blessed tags → composants React (`<C color="cyan">`)
- Créer `useKeyboard` hook pour la navigation clavier
- Premier rendu : un écran vide qui se connecte à l'API

#### Phase M2 : Global Monitor (2 jours)

- Convertir `GlobalMonitor` → `<GlobalMonitor>` React
- Convertir `session-list.js` → `<SessionList>` avec navigation clavier
- Convertir `status-bar.js` → `<StatusBar>`
- Test E2E : lister les sessions, naviguer, sélectionner

#### Phase M3 : Session Monitor — Layout (3 jours)

- Convertir `SessionMonitor` → `<SessionMonitor>` React avec state management
- Implémenter le layout adaptatif (execution/idle/descriptor modes) en JSX conditionnel
- Convertir `header.js` → `<Header>`
- Implémenter le toggle de panels (show/hide → conditional rendering)

#### Phase M4 : Composants de contenu (4 jours)

- `phase-workflow.js` → `<PhaseWorkflow>` (arbre récursif en JSX)
- `workflow-tree.js` → `<WorkflowTree>` (rendu d'arbre + auto-scroll)
- `variables.js` → `<Variables>` (groupement + formatage)
- `widgets-panel.js` → `<WidgetsPanel>` + sous-composants widget
- `execution-log.js` → `<ExecutionLog>`
- `filesystem.js` → `<Filesystem>` (arbre collapsible)
- `llm-activity.js` → `<LLMActivity>`
- `metrics-panel.js` → `<MetricsPanel>`

#### Phase M5 : Widgets avancés (2 jours)

- `counter.js` → `<CounterWidget>`
- `progress-bar.js` → `<ProgressBarWidget>`
- `score-chart.js` → `<ScoreChart>` (sparkline)
- `status-list.js` → `<StatusListWidget>`
- Nouveaux widgets Phase 14 : `<FitnessSummary>`, `<KnowledgeStatus>`

#### Phase M6 : Intégration et polish (2 jours)

- Connecter à `tui-monitor.js` (point d'entrée)
- Navigation GlobalMonitor ↔ SessionMonitor
- Gestion des erreurs de connexion
- Performance : vérifier le refresh rate avec Ink
- Flag `--legacy` pour accéder à l'ancien blessed monitor

### Estimation totale : ~15 jours (3 semaines)

## Dépendances à ajouter

| Package | Version | Usage | Remplace |
|---------|---------|-------|----------|
| `ink` | ^6.0 | Framework TUI React | `blessed` |
| `react` | ^18.0 | Composants UI | Implicite avec Ink |
| `ink-testing-library` | ^4.0 | Tests composants | (nouveau) |

**Dépendances à retirer** (après migration complète) :

| Package | Raison |
|---------|--------|
| `blessed` | Remplacé par Ink |
| `blessed-contrib` | Jamais utilisé |

## Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|-----------|
| Performance Ink sur gros arbres d'exécution | Moyenne | Moyen | Profiler tôt, virtualiser les longues listes |
| Scrolling complexe sans équivalent `box.scrollTo()` | Haute | Moyen | Implémenter un hook `useScrollToView` dès Phase M1 |
| Incompatibilité Windows Terminal + Ink | Basse | Haut | Tester sur Windows Terminal dès Phase M1 |
| Régression fonctionnelle pendant la migration | Moyenne | Bas | Flag `--legacy` conserve l'ancien monitor |

## Métriques de succès

- [ ] Tous les modes du monitor fonctionnent (execution, idle, descriptor)
- [ ] Navigation GlobalMonitor → SessionMonitor → retour
- [ ] Auto-refresh toutes les 2s sans clignotement
- [ ] Tous les composants visuellement équivalents à l'ancien
- [ ] Au moins 3 hooks réutilisables identifiés pour le frontend
- [ ] `blessed` et `blessed-contrib` retirés de package.json
- [ ] Tests unitaires pour chaque composant React

## Conséquences

### Positif
- Codebase TUI moderne, maintenable, testable
- Hooks et logique partageable avec le frontend React
- Écosystème Ink actif pour les futures features (mouse, scrollable, select)
- Le TUI reste le terrain d'expérimentation UI rapide pour Maestro

### Négatif
- ~15 jours d'effort de migration
- Période transitoire avec deux monitors (blessed + Ink)
- Dépendance à React dans le CLI (augmente node_modules)

### Neutre
- L'API des composants change (impératif → déclaratif) mais la logique métier reste identique
- Le point d'entrée `tui-monitor.js` garde la même interface externe
