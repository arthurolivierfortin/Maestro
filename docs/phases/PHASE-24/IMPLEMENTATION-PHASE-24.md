# Phase 24 — Monitors "vivants"

## Résumé

Amélioration des monitors TUI existants avec animations subtiles pour rendre l'interface plus "vivante". Pas de nouveau monitor créé — le Monitor LLM-Provider (ModelsScreen + ModelDetail) existe déjà depuis Phase 15/17.

## Principe

Le TUI était déjà live (auto-refresh via useApiData), mais statique visuellement. Les améliorations ajoutent des indicateurs animés qui donnent le sentiment que le système "respire".

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `maestro-cli/monitor/ink/hooks/useAnimationTick.ts` | Hook React retournant un compteur incrémental pour piloter les animations (120ms par défaut) |

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `maestro-cli/monitor/ink/theme.ts` | Ajout des helpers d'animation : `SPINNER_FRAMES`, `BREATHING_DOTS`, `ACTIVITY_FRAMES`, `spinnerFrame()`, `breathingDot()`, `activityFrame()` |
| `maestro-cli/monitor/ink/components/StatusBar.ts` | Import `useAnimationTick` + `spinnerFrame`/`breathingDot`. L'icône de connexion est animée : spinner pendant 'connecting', dot pulsant pour 'connected' |
| `maestro-cli/monitor/ink/components/HomeScreen.ts` | Import `useAnimationTick` + `breathingDot` + `spinnerFrame`. SystemStatus avec dots pulsants, sessions running avec spinner animé |
| `maestro-cli/monitor/ink/components/ModelsScreen.ts` | Import `useAnimationTick` + `breathingDot`. ModelStatusPanel avec dot pulsant pour le statut online |

## Animations

| Animation | Où | Comportement |
|-----------|-----|-------------|
| Breathing dot | StatusBar (connected), HomeScreen (system status), ModelsScreen (online) | Alterne entre ●, ◉, ○ — donne un effet "respiration" |
| Spinner | StatusBar (connecting), HomeScreen (running sessions) | Braille spinner ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ — indique une activité |
| Staggered | HomeScreen system status | Les dots backend et LLM sont décalés de 3 frames pour un effet visuel |
