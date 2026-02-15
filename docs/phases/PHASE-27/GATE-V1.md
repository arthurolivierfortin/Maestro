# Gate V1 — Critères de passage vers V2

> Chaque critère doit être PASS avec une preuve vérifiable.
> On ne commence V2 tant que tous les critères ne sont pas PASS.

---

## Critères fonctionnels

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G1 | **L'app Electron se build** | `npm run build` dans `frontend/` produit un .exe dans `release/` | ⬜ |
| G2 | **L'installeur Windows fonctionne** | L'exe NSIS installe Maestro, crée un raccourci, peut se lancer | ⬜ |
| G3 | **Le backend démarre depuis Electron** | L'app Electron spawne le backend .NET automatiquement | ⬜ |
| G4 | **`maestro setup` guide l'utilisateur** | Lancer `maestro setup` → détecte hardware → montre modèles → configure provider | ⬜ |
| G5 | **Chat fonctionne via CLI** | `maestro chat --model <model>` → conversation interactive | ⬜ |
| G6 | **Chat fonctionne via frontend** | Ouvrir ChatPage → envoyer message → recevoir réponse | ⬜ |
| G7 | **Models visibles dans frontend** | Page Models → voir hardware, modèles compatibles, badges | ⬜ |
| G8 | **Session créée depuis template** | `maestro session create --repo <path> --template <name>` → session prête | ⬜ |
| G9 | **Workflow exécuté via CLI** | `maestro session invoke <id> start` → exécution visible dans le monitor | ⬜ |
| G10 | **Résultats visibles dans monitor** | Monitor → phases avancées, arbre d'exécution avec enfants, logs, métriques | ⬜ |

## Critères de sécurité

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G11 | **API Key générée au premier lancement** | `~/.maestro/config.json` contient une clé, routes protégées | ⬜ |
| G12 | **Routes protégées par auth** | `curl http://localhost:5000/api/sessions` SANS header → 401 | ⬜ |
| G13 | **Localhost exempt d'auth** | Depuis la même machine, l'app fonctionne sans clé manuelle | ⬜ |
| G14 | **Agent limité à sa session** | Clé agent → peut accéder session X, pas session Y | ⬜ |
| G15 | **Backend bind localhost uniquement** | `netstat` montre 127.0.0.1:5000, pas 0.0.0.0:5000 | ⬜ |

## Critères de stabilité

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G16 | **0 sessions zombies après restart** | Restart backend → `session list --status running` → 0 résultats (ou légitimes) | ⬜ |
| G17 | **Cascade delete fonctionne** | Supprimer session → workspace.sessionIds mis à jour automatiquement | ⬜ |
| G18 | **Messages d'erreur lisibles** | LLM down → message clair ("Le serveur LLM ne répond pas"), pas de stacktrace | ⬜ |
| G19 | **Health check complet** | `maestro health --verbose` → statut de chaque service avec message humain | ⬜ |
| G20 | **Sanity checks au démarrage** | Lancer l'app → vérification backend, LLM, espace disque → warnings si problème | ⬜ |

## Critères de documentation

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G21 | **Guide d'installation** | `docs/guides/INSTALLATION.md` → step-by-step Windows testable | ⬜ |
| G22 | **Getting Started** | `docs/guides/GETTING-STARTED.md` → 5 minutes de l'install au premier résultat | ⬜ |

## Critères de distribution

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G23 | **CLI installable globalement** | `npm install -g @maestro-ai/cli` → `maestro` fonctionne partout | ⬜ |
| G24 | **CLI auto-discover backend** | CLI trouve le backend via `~/.maestro/config.json` sans config manuelle | ⬜ |

---

## Résumé

| Section | Critères | PASS | FAIL | Restant |
|---------|----------|------|------|---------|
| Fonctionnel | G1-G10 | 0 | 0 | 10 |
| Sécurité | G11-G15 | 0 | 0 | 5 |
| Stabilité | G16-G20 | 0 | 0 | 5 |
| Documentation | G21-G22 | 0 | 0 | 2 |
| Distribution | G23-G24 | 0 | 0 | 2 |
| **Total** | **24** | **0** | **0** | **24** |
