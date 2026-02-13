# Phase 22 — Stabilisation

## Résumé

Gestion globale des erreurs, diagnostics améliorés, et documentation utilisateur pour la V1.

## ExceptionHandlingMiddleware

Middleware global qui capture toutes les exceptions non gérées et retourne du JSON structuré :

| Exception | Status | Error Type |
|-----------|--------|------------|
| LLMProviderUnavailableException | 503 | `llm_provider_unavailable` |
| HttpRequestException (503) | 503 | `service_unavailable` |
| HttpRequestException (autre) | 502 | `upstream_error` |
| InvalidOperationException | 400 | `invalid_operation` |
| ArgumentException | 400 | `invalid_argument` |
| KeyNotFoundException | 404 | `not_found` |
| FileNotFoundException | 404 | `file_not_found` |
| TaskCanceledException | 504 | `timeout` |
| UnauthorizedAccessException | 403 | `forbidden` |
| Tout autre | 500 | `internal_error` |

Format de réponse :
```json
{
  "error": "error_type",
  "message": "Description de l'erreur",
  "status": 500
}
```

## CLI Améliorations

### `health --verbose`
Affiche des diagnostics étendus :
- URL de l'API
- Timestamp
- Statut du LLM Provider et modèle actif
- Statut de la sécurité

### `logs [type]`
Lire les logs d'audit :
```bash
maestro logs               # 20 dernières entrées
maestro logs audit --limit 50
```

## Documentation Utilisateur

- `docs/guides/users/INSTALLATION.md` — Guide d'installation Windows complet
- `docs/guides/users/GETTING-STARTED.md` — Démarrage en 5 minutes

## Pipeline Middleware

Ordre dans le pipeline HTTP :
1. CORS
2. **ExceptionHandlingMiddleware** (attrape tout)
3. **ApiKeyAuthMiddleware** (authentification)
4. Controllers
