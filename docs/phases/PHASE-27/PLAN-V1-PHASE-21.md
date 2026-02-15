# Plan — V1 Phase 21 : Packaging & Distribution

## Prérequis
- [x] Phase 20 gate PASS

## Objectif
L'utilisateur télécharge un .exe, l'installe, et ça marche. Le CLI est installable globalement.

## Déjà fait (70% — découvert pendant l'audit)
- Config electron-builder complète (NSIS, portable, extraResources → backend + content)
- Electron main.ts : BackendManager complet (start, stop, health check, crash handling)
- Health check polling avant ouverture fenêtre (30s timeout)
- LLM-Provider lifecycle management (start/stop via IPC)
- preload.ts avec API complète (fs, app, window, shell, backend, llm, updater)
- Auto-updater (electron-updater)
- CLI index.js avec shebang (`#!/usr/bin/env node`)
- CLI package.json avec bin entry (`maestro`)
- `maestro setup` wizard existant
- `maestro health` avec résumé complet

---

## Étapes — Build Electron production

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 1 | Publier le backend .NET | `dotnet publish -c Release -o ../dist/backend` | Opérationnel | ⬜ Run-time |
| 2 | Vérifier backend published | `./dist/backend/Maestro.Api.exe` | E2E | ⬜ Run-time |
| 3 | extraResources dans package.json | Pointe vers `../dist/backend` et `../content/system` | Déjà configuré | ✅ Existait |
| 4 | Build frontend + Electron | `npm run build` | Installeur produit | ⬜ Run-time |
| 5 | Tester installeur NSIS | Exécuter l'installeur | E2E | ⬜ Run-time |
| 6 | Lancer l'app installée | Double-clic raccourci | E2E | ⬜ Run-time |

## Étapes — Backend embarqué dans Electron

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 7 | BackendManager dans Electron main | `startNativeBackend()` dans main.ts | Déjà implémenté | ✅ Existait |
| 8 | Démarrer backend au lancement | main.ts spawns backend before createWindow | Déjà implémenté | ✅ Existait |
| 9 | Health check avant fenêtre | Polling /api/health avec timeout 30s | Déjà implémenté | ✅ Existait |
| 10 | Splash screen | À implémenter si nécessaire | Non implémenté | ⬜ Nice-to-have |
| 11 | Arrêter backend à la fermeture | `app.on('before-quit')` kill process | Déjà implémenté | ✅ Existait |
| 12 | Gérer crash backend | Process exit → error display | Déjà implémenté | ✅ Existait |
| 13 | Test E2E cycle complet | Lancer → utiliser → fermer → port libre | E2E | ⬜ Run-time |

## Étapes — LLM-Provider optionnel

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 14 | App démarre sans LLM | Features LLM désactivées gracieusement | health affiche "LLM: not available" | ✅ |
| 15 | Guide installation LLM | Settings page a section LLM Provider | Déjà dans LLMConfigPanel | ✅ Existait |
| 16 | Azure comme alternative | Si Azure configuré → chat fonctionne | Phase 19 complète | ✅ |
| 17 | Détection automatique | `maestro health` check LLM + Azure + auth | Amélioré | ✅ |

## Étapes — npm publish CLI

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 18 | package.json pour npm | `@b-one/maestro-cli`, bin entry | Déjà configuré | ✅ Existait |
| 19 | Shebang | `#!/usr/bin/env node` dans index.js | Déjà présent | ✅ Existait |
| 20 | Test npm link | `cd maestro-cli && npm link` | Opérationnel | ⬜ Run-time |
| 21 | Publier sur npm | `npm publish --access public` | Opérationnel | ⬜ Run-time |
| 22 | Test install globale | `npm install -g @b-one/maestro-cli` | Opérationnel | ⬜ Run-time |

## Étapes — Sanity checks au démarrage

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 23 | Check backend accessible | health command → message clair si fail | Message "Backend not responding" | ✅ Existait |
| 24 | Check LLM disponible | health command → "not available" si fail | Message info | ✅ |
| 25 | Check espace disque | Nice-to-have | Non implémenté | ⬜ Nice-to-have |
| 26 | Check config valide | readConfig() gère fichier corrompu | Retourne {} si parse fail | ✅ Existait |
| 27 | Résumé au démarrage | `maestro health` affiche Backend+LLM+Auth+Provider | Résumé complet | ✅ |

---

## Gate de sortie
- [x] Config electron-builder complète pour .exe Windows
- [x] Backend démarre et s'arrête avec Electron (main.ts)
- [x] App fonctionne sans LLM-Provider (mode dégradé clair)
- [x] CLI prêt pour npm publish (bin, shebang, package.json)
- [x] Sanity checks au démarrage avec messages humains
- [ ] Build + install E2E — requiert exécution manuelle (dotnet publish + npm run build)

## Cleanup
- [x] Aucune session de test créée
- [x] Aucun fichier temporaire

## Fichiers modifiés
- `maestro-cli/cli.ts` (health check amélioré — LLM/auth/provider toujours affichés)

## Note
Phase 21 était déjà complète à 70% grâce à l'infrastructure Electron existante. Les étapes restantes sont opérationnelles (build, publish, E2E test) et non du code.
