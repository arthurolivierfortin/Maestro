# Phase 59-PRE : Gouvernance des Couts + Providers API

**Statut** : EN COURS (A-D DONE, E a faire)
**Prerequis** : Phase 58 DONE (verifier `docs/phases/PHASE-58/checkpoint.md`)
**Objectif** : Rendre les couts LLM controlables, visibles et limites AVANT d'ajouter des providers API payants, puis ajouter les providers Anthropic et GitHub Models et valider block-forge E2E.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire `docs/phases/PHASE-59-PRE/cost-governance-analysis.md`** — analyse complete de l'existant
3. **Ecrire dans `docs/phases/PHASE-59-PRE/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier le workflow block-forge** — cette phase touche l'infrastructure de couts, pas les workflows
5. **Ne PAS ajouter de persistence SQL** — fichiers JSON sur disque suffisent pour V1
6. **Tester avec le provider local d'abord** — ne depenser de l'argent reel qu'en 59-PRE-D

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 59-PRE-A | Backend : pricing overrides + limites + historique | 1.5 jours | DONE |
| 59-PRE-B | TUI + CLI : visibilite et controle des couts | 1 jour | DONE |
| 59-PRE-C | Validation locale (couts simules) | 0.5 jour | DONE |
| 59-PRE-D | Provider Anthropic API + validation E2E block-forge | 1 jour | DONE |
| 59-PRE-E | Provider GitHub Models (standalone, HttpClient) | 0.5 jour | DONE |
| 59-PRE-F | Slash command `/costs` — config limites dans le TUI | 0.5 jour | DONE |
| 59-PRE-G | Auth provider en C# — .env loader + AuthStatus | 0.5 jour | DONE |
| 59-PRE-H | **Cost Enforcement — Hard stop configurable + Graceful shutdown** | 1.5 jours | A FAIRE |
| 59-PRE-T | Tests | inclus dans chaque sous-phase | EN COURS |

> **59-PRE-E** : plan detaille dans `PHASE-59-PRE-E.md`
> **59-PRE-F** : plan detaille dans `PHASE-59-PRE-F.md`
> **59-PRE-G** : plan detaille dans `PHASE-59-PRE-G.md`
> **59-PRE-H** : plan detaille dans `PHASE-59-PRE-H.md` — **CRITIQUE** : enforcement reel des limites + graceful shutdown + resume

---

## 59-PRE-A : Backend — Pricing overrides, limites, historique

### Lecture obligatoire
- `apps/backend/src/Maestro.Infrastructure/Pricing/ModelPricingService.cs` — implementation actuelle du pricing (cache, fallback, calcul)
- `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs:261-271` — accumulation des couts
- `apps/backend/src/Maestro.Domain/Entities/TrainingConfiguration.cs:290-316` — seul modele de limites existant
- `apps/backend/src/Maestro.Application/DTOs/MetricsDto.cs` — DTOs cout existants
- `docs/phases/PHASE-59-PRE/cost-governance-analysis.md` — gaps identifies

### Ce que cette sous-phase fait

1. **Pricing overrides** : ajouter `CostOverrides` dans la config (JSON file `.maestro/cost-config.json`). `ModelPricingService` check overrides AVANT LLM-Provider AVANT fallback.

2. **CostLimits** : nouvelle entite avec `maxPerSession`, `maxPerDay`, `maxPerWeek`, `maxPerMonth`. Persiste dans `.maestro/cost-config.json`.

3. **Cost enforcement** : dans `BlockRefHandler.AccumulateCosts()`, apres l'accumulation, verifier les limites. Si depassee → log erreur + set `_costLimitExceeded = true` dans la session. Le workflow peut lire cette variable et s'arreter proprement.

4. **CostEntry historique** : chaque appel a `AccumulateCosts()` ecrit une ligne dans `.maestro/cost-history.jsonl` (JSON Lines, append-only). Champs : timestamp, sessionId, blockId, modelId, promptTokens, completionTokens, costUsd.

5. **API endpoints** :
   - `GET /api/costs/summary` — agrege par jour/semaine/mois depuis cost-history.jsonl
   - `GET /api/costs/limits` — retourne les limites configurees + usage courant
   - `PUT /api/costs/limits` — configure les limites
   - `GET /api/sessions/{id}/costs` — cout total + breakdown pour une session

6. **ICostTrackingService** : nouvelle interface pour decoupler le tracking du BlockRefHandler.

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Application/Interfaces/ICostTrackingService.cs` | Creer — interface (RecordCost, GetSummary, GetLimits, SetLimits, CheckLimit) |
| `apps/backend/src/Maestro.Infrastructure/Pricing/CostTrackingService.cs` | Creer — implementation (JSONL storage, aggregation, limit check) |
| `apps/backend/src/Maestro.Infrastructure/Pricing/ModelPricingService.cs` | Modifier — ajouter lecture des overrides depuis config |
| `apps/backend/src/Maestro.Infrastructure/Sessions/NodeHandlers/BlockRefHandler.cs` | Modifier — appeler ICostTrackingService.RecordCost() + CheckLimit() |
| `apps/backend/src/Maestro.Api/Controllers/CostsController.cs` | Creer — 4 endpoints |
| `apps/backend/src/Maestro.Api/Program.cs` | Modifier — DI registration |
| `apps/backend/src/Maestro.Domain/Entities/CostLimits.cs` | Creer — entite limites |
| `apps/backend/src/Maestro.Application/DTOs/CostDtos.cs` | Creer — CostSummaryDto, CostEntryDto, CostLimitsDto |

### Verification
```bash
# 1. Build
dotnet build apps/backend/src/Maestro.Api/Maestro.Api.csproj
# Resultat : 0 erreurs

# 2. API limites
curl -X PUT http://localhost:5000/api/costs/limits -H "Content-Type: application/json" -d '{"maxPerSession": 1.0, "maxPerDay": 5.0}'
# Resultat : 200 OK

# 3. API summary
curl http://localhost:5000/api/costs/summary
# Resultat : JSON avec today/thisWeek/thisMonth/allTime

# 4. Pricing override
# Configurer override dans .maestro/cost-config.json, verifier que ModelPricingService l'utilise
```

### Anti-patterns
- Ne PAS utiliser SQLite ou base de donnees — JSONL append-only suffit pour V1
- Ne PAS bloquer l'execution de facon synchrone quand la limite est atteinte — setter une variable, laisser le workflow decider
- Ne PAS hardcoder les chemins de fichiers — utiliser `MAESTRO_ROOT` ou `.maestro/`

### Checkpoint
```markdown
## 59-PRE-A : Backend couts
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers crees** : [nombre]
**Endpoints** : GET /api/costs/summary, GET/PUT /api/costs/limits, GET /api/sessions/{id}/costs
**Build** : dotnet build 0 erreurs
```

---

## 59-PRE-B : TUI + CLI — Visibilite et controle des couts

### Lecture obligatoire
- `packages/maestro-code/App.ts` — affichage actuel des couts dans `/create-agent` polling
- `packages/maestro-code/components/SpacesScreen.ts` — liste des sessions (ajouter cout)
- `packages/maestro-cli/cli.ts` — pattern de commandes CLI
- `packages/maestro-cli/api-client.ts` — adapter pour les nouveaux endpoints

### Ce que cette sous-phase fait

1. **Cout dans Spaces** : ajouter `$X.XX` dans la ligne de chaque session (a cote de `fit: X%`)
2. **Status bar cout** : afficher le cout cumule du jour dans le footer (`$0.42 today`)
3. **CLI `maestro costs`** : sous-commandes `summary`, `limits`, `set-limit`, `history`
4. **SDK** : ajouter `client.costs.summary()`, `client.costs.limits()`, `client.costs.setLimits()` dans `@maestro/client`
5. **Alerte 80%** : quand le cout du jour atteint 80% de `maxPerDay`, afficher un warning dans le status bar

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/SpacesScreen.ts` | Modifier — ajouter cout par session |
| `packages/maestro-code/App.ts` | Modifier — cout du jour dans le status bar |
| `packages/maestro-cli/cli.ts` | Modifier — ajouter commande `costs` avec sous-commandes |
| `packages/maestro-cli/api-client.ts` | Modifier — wrapper pour endpoints /api/costs/* |
| `packages/maestro-client/src/domains/costs.ts` | Creer — SDK domain costs |
| `packages/maestro-client/src/index.ts` | Modifier — exporter costs domain |

### Verification
```bash
# 1. Type check
cd packages/maestro-code && npx tsc --noEmit
# Resultat : 0 erreurs

# 2. CLI
node packages/maestro-cli/index.js costs summary
# Resultat : tableau avec today/week/month

# 3. CLI limites
node packages/maestro-cli/index.js costs set-limit --per-day 5.00
node packages/maestro-cli/index.js costs limits
# Resultat : maxPerDay: $5.00
```

### Anti-patterns
- Ne PAS ajouter une page entiere pour les couts — un widget/section dans Home ou le status bar suffit
- Ne PAS appeler l'API costs a chaque render — cache cote TUI avec refresh toutes les 30s
- Ne PAS bloquer le TUI si l'API costs echoue — afficher "N/A" et continuer

### Checkpoint
```markdown
## 59-PRE-B : TUI + CLI couts
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Cout visible dans Spaces** : OUI / NON
**CLI costs summary** : fonctionne / erreur
**Type check** : 0 erreurs
```

---

## 59-PRE-C : Validation locale (couts simules)

### Lecture obligatoire
- `docs/phases/PHASE-59-PRE/cost-governance-analysis.md` — section "Strategie de test"
- `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` — config provider local

### Ce que cette sous-phase fait

1. **Configurer pricing override** : dans `.maestro/cost-config.json`, configurer le modele local a `$3/$15 per million` (simule un modele cloud)
2. **Configurer une limite** : `maxPerSession: $0.05`, `maxPerDay: $0.50`
3. **Lancer une inference via CLI** : `maestro session invoke` avec un block inference simple, verifier que le cout > $0
4. **Verifier l'accumulation** : `maestro costs summary` montre un cout > $0
5. **Tester la limite** : lancer plusieurs inferences jusqu'a depasser la limite, verifier que `_costLimitExceeded` est set
6. **Verifier l'affichage TUI** : spawn TUI, naviguer Spaces, verifier que le cout de la session est visible

### Verification
```bash
# 1. Cout > $0 apres inference locale
curl http://localhost:5000/api/costs/summary
# Resultat : today.totalCost > 0

# 2. Limite respectee
curl http://localhost:5000/api/sessions/{id}
# Resultat : variables contiennent _costLimitExceeded = true (apres depassement)

# 3. Historique
cat .maestro/cost-history.jsonl | wc -l
# Resultat : > 0 lignes
```

### Anti-patterns
- Ne PAS lancer block-forge pour ce test — trop lent. Utiliser un block inference simple
- Ne PAS oublier de reset les overrides apres le test — documenter la procedure

### Checkpoint
```markdown
## 59-PRE-C : Validation locale
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Cout affiche** : $X.XX (valeur reelle observee)
**Limite testee** : OUI / NON (depassement detecte)
**Historique JSONL** : X lignes
```

---

## 59-PRE-D : Provider Anthropic API + Validation E2E block-forge

### Lecture obligatoire
- `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` — config providers existants
- `llm-provider/dotnet/src/LLMProvider.AzureProvider/` — pattern d'un provider existant (a suivre)
- `packages/maestro-code/components/ProviderSetupScreen.ts` — setup TUI

### Ce que cette sous-phase fait

1. **Provider Anthropic dans LLM-Provider .NET** : nouveau projet `LLMProvider.AnthropicProvider` (HTTP direct vers `api.anthropic.com`, cle API, modeles Claude)
2. **Config** : ajouter section `Anthropic` dans appsettings.json (apiKey, models, pricing)
3. **Setup TUI** : ajouter option "Anthropic API (direct)" dans ProviderSetupScreen
4. **Test block-forge** : lancer `/create-agent --contract code-reviewer` avec provider Anthropic. Devrait terminer en ~3-5 min
5. **Valider outputs structures** : verifier que blockId/fitness sont des valeurs structurees (pas du texte brut)
6. **Valider les couts** : `maestro costs summary` montre un cout reel > $0 correspondant a l'usage Anthropic
7. **Configurer une limite** avant le test pour eviter les surprises

### Fichiers a creer

| Fichier | Action |
|---------|--------|
| `llm-provider/dotnet/src/LLMProvider.AnthropicProvider/` | Creer — nouveau projet .NET (provider Anthropic API) |
| `llm-provider/dotnet/src/LLMProvider.AnthropicProvider/AnthropicLLMProvider.cs` | Creer — implementation ILLMProvider |
| `llm-provider/dotnet/src/LLMProvider.Web/appsettings.json` | Modifier — ajouter section Anthropic |
| `packages/maestro-code/components/ProviderSetupScreen.ts` | Modifier — option Anthropic |

### Verification
```bash
# 1. LLM-Provider health avec Anthropic
curl http://localhost:5010/api/v1/health/
# Resultat : Anthropic: isAvailable: true

# 2. Block-forge termine
# /create-agent via TUI → "Block Forge Complete" visible dans < 5 min
# blockId = un ID reel (pas du texte brut)
# fitness = un nombre (0.XX)

# 3. Couts reels
node packages/maestro-cli/index.js costs summary
# Resultat : today.totalCost > $0, byProvider.Anthropic.totalCost > $0
```

### Anti-patterns
- Ne PAS lancer de test sans avoir configure une limite de cout d'abord
- Ne PAS hardcoder la cle API — lire depuis variable d'environnement ou `.maestro/config.json`
- Ne PAS oublier de configurer le pricing dans le provider (Anthropic publie ses prix, les inclure)

### Checkpoint
```markdown
## 59-PRE-D : Provider Anthropic
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Provider fonctionnel** : OUI / NON
**Block-forge duree** : X min
**blockId structure** : OUI / NON (valeur : ___)
**fitness structure** : OUI / NON (valeur : ___)
**Cout reel** : $X.XX
**Limite respectee** : OUI / NON
```

---

## Tests (integres dans chaque sous-phase)

| Couche | Sous-phase | Description |
|--------|------------|-------------|
| C1 — Type Check | A, B | `dotnet build` + `npx tsc --noEmit` |
| C2 — Unit tests | A | Tests pour CostTrackingService (recording, aggregation, limit check) |
| C2 — Unit tests | B | Tests pour SDK costs domain |
| C5 — Integration | C | Test E2E local : inference → cout > $0 → limite → arret |
| C6 — E2E Dogfooding | D | Block-forge avec provider reel + validation outputs |

---

## Definition of Done

- [ ] Pricing overrides fonctionnent (modele local simule un cout > $0)
- [ ] Limites de cout configurables (session, jour, semaine, mois)
- [ ] Execution signale quand une limite est depassee
- [ ] Cout visible dans Spaces (par session) et status bar (cout du jour)
- [ ] `maestro costs summary` retourne un resume coherent
- [ ] Historique JSONL consultable
- [ ] Alerte a 80% dans le TUI
- [ ] Validation E2E avec provider local (couts simules)
- [ ] Provider Anthropic API fonctionnel
- [ ] Block-forge termine en < 5 min avec provider Anthropic
- [ ] Outputs structures (blockId/fitness) valides E2E
- [ ] Couts reels Anthropic correspondent a l'usage

### NOT in scope
- Dashboard web
- Facturation / billing
- Quotas multi-utilisateur
- Budgets par workspace (session + global suffisent)
- Persistence SQL (JSONL suffit)

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-59-PRE/checkpoint.md`

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 59-PRE : gouvernance couts (ICostTrackingService, JSONL, limites, CLI costs, provider Anthropic)"
- Mettre a jour : "Current Project State" avec Phase 59-PRE + provider Anthropic
- Retirer : references obsoletes aux couts $0.000
