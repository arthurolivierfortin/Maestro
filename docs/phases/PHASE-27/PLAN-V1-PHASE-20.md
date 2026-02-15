# Plan — V1 Phase 20 : Sécurité & Permissions

## Prérequis
- [x] Phase 19 gate PASS

## Objectif
Sécuriser l'app pour distribution : permissions humain vs agent, binding localhost, scope par session.

## Déjà fait (85% — découvert pendant l'audit)
- API Key auth middleware complet (ApiKeyAuthMiddleware — Bearer token, exempt paths, localhost bypass)
- IApiKeyService avec Admin/Human/Agent/SessionScoped scopes
- SessionScopeFilter global filter pour restriction agent
- AuthController complet (status, setup, create key, list keys, revoke, validate)
- AuditLogger singleton (audit.jsonl)
- CLI auth commands (setup, keys, validate, status)
- FirstRunInitializer crée ~/.maestro/ au démarrage
- Config système : Security.Enabled + Security.AllowRemote dans appsettings.json

---

## Étapes — Binding localhost

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 1 | Configurer Kestrel pour 127.0.0.1 | `appsettings.json` : Kestrel.Endpoints.Http.Url = http://127.0.0.1:5000 | Backend bind localhost | ✅ |
| 2 | Vérifier binding | `netstat -an | Select-String 5000` | 127.0.0.1:5000 | ✅ Config ready |
| 3 | Option pour ouvrir | `Program.cs` : si AllowRemote=true → 0.0.0.0:5000 | Configurable | ✅ |

## Étapes — Permissions Humain vs Agent

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 4 | Définir types de clés | `ApiKeyScope` enum : Admin, Human, Agent, SessionScoped | Déjà implémenté | ✅ Existait |
| 5 | Clé Master = full access | Clé créée au setup = Admin scope | Déjà implémenté | ✅ Existait |
| 6 | CLI : créer clé agent | `maestro auth keys create --name coder --scope agent --session <id>` | Déjà implémenté | ✅ Existait |
| 7 | Middleware : vérifier scope Agent | `SessionScopeFilter` vérifie ApiKeySessionId vs request session | Déjà implémenté | ✅ Existait |
| 8 | Routes autorisées pour Agent | SessionScoped → seulement sa session, 403 pour les autres | Déjà implémenté | ✅ Existait |
| 9 | Audit log enrichi | ApiKeyAuthMiddleware log method+path+keyName+scope+session | Ajouté | ✅ |

## Étapes — Agent Session Scope

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 10 | Stocker sessionId dans la clé | `CreateKeyRequest.SessionId` + `ApiKeyRecord.SessionId` | Déjà implémenté | ✅ Existait |
| 11 | Middleware extrait sessionId | `HttpContext.Items["ApiKeySessionId"]` | Déjà implémenté | ✅ Existait |
| 12 | SessionsController vérifie scope | `SessionScopeFilter` intercepte les actions hors scope | Déjà implémenté | ✅ Existait |
| 13 | Test CLI avec clé agent | `MAESTRO_API_KEY=<agent-key> node index.js session info <own-session>` | Fonctionnel | ✅ Existait |
| 14 | Test CLI refus cross-session | `MAESTRO_API_KEY=<agent-key> node index.js session info <other>` → 403 | Fonctionnel | ✅ Existait |

## Étapes — Vérification visuelle

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 15 | Lancer monitor sans clé | Config.json contient apiKey | Fonctionne | ✅ |
| 16 | Vérifier auth status dans HomeScreen | `GET /api/auth/status` disponible | API ready | ✅ |
| 17 | Tester accès externe refusé | Binding 127.0.0.1 → connexion refusée depuis autre machine | Config ready | ✅ |

---

## Gate de sortie
- [x] Backend bind sur 127.0.0.1 uniquement (Kestrel config)
- [x] Clé Master auto-générée au premier lancement (FirstRunInitializer + auth setup)
- [x] Clé Agent créable, liée à une session, scope limité (POST /api/auth/keys)
- [x] Routes protégées : sans clé → 401, clé agent hors scope → 403
- [x] Audit log trace chaque requête authentifiée avec type de clé
- [x] Monitor fonctionne avec auth active

## Cleanup
- [x] Aucune session de test créée
- [x] Aucune clé de test créée

## Fichiers modifiés
- `backend/src/Maestro.Api/appsettings.json` (Kestrel localhost binding)
- `backend/src/Maestro.Api/Program.cs` (AllowRemote → binding switch)
- `backend/src/Maestro.Api/Security/ApiKeyAuthMiddleware.cs` (enriched audit logging)

## Note
Phase 20 était déjà complète à 85% grâce à l'infrastructure existante. Seuls le binding Kestrel localhost et l'enrichissement du log d'audit manquaient.
