# ADR : Provider Registration + Model Routing

**Date** : 2026-03-16
**Statut** : Accepte
**Contexte** : Les providers LLM crashaient au demarrage quand non configures, et le routing envoyait des requetes vers des providers non-disponibles.

---

## Decision

### 1. Tous les providers sont TOUJOURS enregistres dans le DI

Raison : l'utilisateur peut configurer un provider pendant que l'app tourne (via TUI setup ou modification du `.env`). Si le provider n'est pas enregistre au demarrage, il faudrait redemarrer l'app.

### 2. Les constructeurs ne crashent JAMAIS

Si la config est vide (pas d'endpoint, pas de cle API), le provider se construit quand meme mais retourne `IsAvailable = false`. Pas de `throw`, pas de `new Uri("")`.

### 3. Le routing filtre sur IsAvailable AVANT de chercher un modele

L'algorithme de routing :
1. Filtrer les providers ou `IsAvailable = true`
2. Parmi ceux-la, chercher le modele demande dans `GetAvailableModelsAsync()`
3. Si trouve → router vers ce provider
4. Si pas trouve → erreur "Model not found in any available provider"

Un modele configure dans un provider non-disponible est IGNORE. Meme si `gpt-4o` est dans la config Azure ET GitHub Models, si Azure n'est pas disponible (pas de cle), seul GitHub Models est considere.

### 4. Les providers relevent leur disponibilite dynamiquement

`IsAvailableAsync()` est appele a chaque requete de routing (avec cache court si necessaire). Quand l'utilisateur configure une cle API, le provider devient disponible au prochain appel sans redemarrage.

---

## Consequences

- Plus de crash au demarrage quand un provider n'est pas configure
- Le health check montre correctement `DOWN` pour les providers non configures
- L'utilisateur peut configurer un provider a tout moment sans redemarrer
- Le routing est deterministe : meme modele dans 2 providers → le premier DISPONIBLE gagne
- Les modeles dans `appsettings.json` pour un provider non configure sont des templates — ils deviennent actifs quand le provider est configure
