# Phase 20 — Sécurité & Permissions

## Résumé

Ajout d'un système d'authentification par API key pour sécuriser l'API Maestro.

## Architecture

- **Format des clés** : `mst_` + 32 hex (SHA-256 stocké, jamais la clé en clair)
- **Stockage** : `~/.maestro/keys.json` (hashes uniquement)
- **Middleware** : Extrait Bearer token → valide → 401 si invalide
- **Exemptions** : `/`, `/api/health`, `/api/auth/status`, `/api/auth/setup`, `/hubs/*`
- **Localhost bypass** : Quand `AllowRemote=false`, les requêtes locales passent sans clé
- **Scopes** : Admin, Human, Agent, SessionScoped
- **SessionScopeFilter** : Les clés SessionScoped ne peuvent accéder qu'à leur session
- **Audit** : JSONL dans `~/.maestro/logs/audit.jsonl`

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `Domain/Enums/ApiKeyScope.cs` | Enum des scopes |
| `Application/DTOs/AuthDtos.cs` | DTOs auth (records, requests, responses) |
| `Application/Interfaces/IApiKeyService.cs` | Interface du service de clés |
| `Infrastructure/Security/ApiKeyService.cs` | Implémentation SHA-256 + fichier JSON |
| `Infrastructure/Security/AuditLogger.cs` | IAuditLogger → JSONL |
| `Api/Security/ApiKeyAuthMiddleware.cs` | Middleware d'authentification |
| `Api/Security/ApiKeyAuthOptions.cs` | Options de configuration (Enabled, AllowRemote) |
| `Api/Security/SessionScopeFilter.cs` | Filtre de scope session |
| `Api/Controllers/AuthController.cs` | Endpoints auth (setup, keys, validate) |

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `Program.cs` | DI services sécurité, middleware, first-launch check |
| `appsettings.json` | Section `Security` |
| `appsettings.Development.json` | `Security.Enabled: false` |
| `shared/api-client.js` | apiKey dans constructor + header Authorization |
| `maestro-cli/cli.ts` | Import config, commandes `auth` |

## Mode développement

`appsettings.Development.json` désactive la sécurité (`Enabled: false`).
Tout fonctionne sans clé en dev.

## CLI

```bash
maestro auth status          # État de la sécurité
maestro auth setup           # Créer la première clé admin
maestro auth create-key      # Créer une clé (--name, --scope)
maestro auth list-keys       # Lister les clés actives
maestro auth revoke <id>     # Révoquer une clé
```
