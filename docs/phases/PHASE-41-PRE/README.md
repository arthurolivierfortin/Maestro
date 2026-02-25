# Phase 41-PRE : maestro-code — Spatial TUI Redesign

**Statut** : A faire
**Prerequis** : Phase 40-PRE COMPLETE (verifier checkpoint.md)
**Objectif** : Remplacer le layout panel-grid de maestro-code par une navigation spatiale plein ecran (Page Registry + Ctrl+Arrow), integrer tous les composants du monitor, implementer Agent-in-the-Cockpit.

**Design reference** : `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md`

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md`** — c'est la spec complete
3. **Lire les fichiers obligatoires** dans chaque sous-phase AVANT de coder
4. **Ecrire dans `docs/phases/PHASE-41-PRE/checkpoint.md`** apres chaque sous-phase
5. **Committer apres chaque sous-phase** — jamais de sous-phase entiere non commitee
6. **Verification en 2 etapes** : vitest PUIS `node tests/real-demo-check.cjs` (voir `memory/tui-verification.md`)
7. **Ne PAS modifier le backend** — cette phase est 100% frontend (packages/maestro-code, maestro-monitor, tui)
8. **Ne PAS casser le monitor standalone** — `node index.js monitor <id>` doit continuer a fonctionner
9. **Ne PAS utiliser `require()`** dans les fichiers .ts charges via tsx — utiliser `import`
10. **Ne PAS ajouter de `.catch(() => null)`** — toute erreur doit etre visible

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Dossier | Effort |
|-------|-------|---------|--------|
| 41-A | Foundation : Page Registry + Monitor Exports | `41-A/` | Moyen |
| 41-B | Spatial Navigation + SpatialStatusBar | `41-B/` | Moyen |
| 41-C | Agent Page Redesign (idle/working/completed) | `41-C/` | Eleve |
| 41-D | Execution Page (SessionMonitor complet) | `41-D/` | Eleve |
| 41-E | List Pages (Catalog + Spaces + Models + Details) | `41-E/` | Eleve |
| 41-F | Agent-in-the-Cockpit (JOIN/CALL/DETACH) | `41-F/` | Eleve |
| 41-G | Command Palette + Help + Demo Mode | `41-G/` | Moyen |
| 41-H | Polish, Responsive, Tests, Cleanup | `41-H/` | Moyen |

Chaque sous-phase a son propre `README.md` dans son dossier avec lecture obligatoire, actions, verification, anti-patterns, et checkpoint.

---

## Architecture cible

```
@maestro/tui (design system)
   ↑              ↑
   │              │
   │     @maestro/monitor (composants applicatifs — 28 composants)
   │        ↑
   │        │  (exports granulaires)
   │        │
@maestro/code (app spatiale — PageRegistry + pages + overlays)
```

### Etat actuel vs etat cible

| Element | Actuel | Cible |
|---------|--------|-------|
| Navigation | NavBar A/C/S/M + Tab cycling | Page Registry + Ctrl+Arrow spatial grid |
| Layout agent | Panels cote a cote (FlipperLayout) | Plein ecran conversationnel (AgentPage) |
| Ecrans liste | Stubs appauvris (listes simples) | Composants monitor complets wrapes |
| Execution | Panneaux dans FlipperLayout | Page dediee plein ecran (SessionMonitor 3 modes) |
| StatusBar | RichStatusBar basique | SpatialStatusBar avec direction hints auto-generees |
| Agent overlay | AgentActivity/AgentBadge dans NavBar | MascotteOverlay flottant + toasts + StatusBar hints |
| Mode demo | Silencieux (pas de flag) | Explicite `--demo`, erreur sans backend |
| Help | HelpOverlay statique | Auto-genere depuis Page Registry |
| Command Palette | Aucun | Ctrl+K fuzzy search |

### Page Registry — le concept central

```typescript
// Ajouter une page = UNE ligne + UN composant
pageRegistry.register({
  id: 'terminal', label: 'Terminal', shortLabel: 'Term', icon: '>_',
  position: { x: 1, y: 1 }, component: TerminalPage,
});
// StatusBar, Help, CommandPalette, navigation se mettent a jour automatiquement
```

Grille par defaut (v1) :
```
              (0,-1)
           EXECUTION

  (-1,0)    (0,0)     (1,0)
  CATALOG   AGENT     SPACES

              (0,1)
             MODELS
```

---

## Verification globale

Apres chaque sous-phase, executer :

```bash
# 1. Tests unitaires
cd packages/maestro-code && npx vitest run tests/
cd packages/maestro-monitor && npx vitest run tests/
cd packages/tui && npx vitest run tests/

# 2. Test d'integration real-path (OBLIGATOIRE pour toute modif visuelle)
cd packages/maestro-code && node tests/real-demo-check.cjs

# 3. Verification visuelle (apres 41-B+)
cd packages/maestro-cli && node index.js code --demo --no-splash
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-41-PRE/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 41-PRE complete — spatial navigation, Page Registry, all monitor components integrated"
- Ajouter : "maestro-code uses @maestro/monitor as dependency for screen/component reuse"
- Mettre a jour : "Tests: XXX total" avec le nouveau compte
- Retirer : entries sur l'ancien FlipperLayout panel-grid
