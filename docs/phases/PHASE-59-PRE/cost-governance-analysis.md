# Phase 59 — Analyse : Gouvernance des Couts LLM

**Date** : 2026-03-15
**Contexte** : Avant d'ajouter un provider API payant (Anthropic, Azure), il faut s'assurer que les couts soient controlables, visibles et monitorables. Cette phase solidifie l'infrastructure de couts AVANT de depenser de l'argent reel.

---

## 1. Etat actuel de l'infrastructure de couts

### Ce qui existe

| Couche | Implementation | Fichier cle |
|--------|---------------|-------------|
| Pricing par modele | `IModelPricingService` — cache 5 min, fetch depuis LLM-Provider | `ModelPricingService.cs` |
| Calcul par block | `EstimateCostAsync()` dans chaque executor | `LLMBlockExecutorBase.cs` |
| Accumulation session | `_accumulatedCost` += apres chaque block | `BlockRefHandler.cs:261-271` |
| Tokens par session | `_accumulatedPromptTokens`, `_accumulatedCompletionTokens` | `BlockRefHandler.cs` |
| Metriques workflow | `TotalCostUsd`, `CostByModel`, `CostByBlockType` | `MetricsDto.cs` |
| Limites training | `MaxCostPerIteration`, `MaxTotalCost` | `TrainingConfiguration.cs:290-316` |
| Affichage TUI | `_accumulatedCost` pendant le polling `/create-agent` | `App.ts:790-830` |
| Pricing LLM-Provider | `InputTokenPrice`, `OutputTokenPrice` par modele | `ModelsEndpoints.cs:50-55` |

### Ce qui manque (gaps critiques)

| Gap | Impact | Risque financier |
|-----|--------|-----------------|
| **Pas de limite de cout par session** | Un workflow peut depenser sans controle | ELEVE |
| **Pas de limite globale** | Aucun plafond de depense journalier/mensuel | ELEVE |
| **Pas de limite par provider** | Un provider mal configure peut exploser les couts | ELEVE |
| **Cout pas visible dans Spaces** | L'utilisateur ne voit pas combien une session a coute | MOYEN |
| **Pas d'historique des couts** | Aucune tendance, pas de suivi temporel | MOYEN |
| **Pas d'alerte** | Aucune notification quand un seuil est depasse | MOYEN |
| **$0.000 pour modeles locaux** | Impossible de tester les features de cout avec le provider local | BLOQUANT pour les tests |
| **Pas d'API cout agrege** | Pas de `GET /api/costs/summary`, pas de dashboard | MOYEN |

---

## 2. Strategie de test : simuler des couts avec le provider local

Le provider local (Python FastAPI sur port 8000) reporte correctement les tokens (prompt + completion). Mais `ModelPricingService` attribue `$0/$0` a tout modele contenant "llama", "qwen", "deepseek", etc.

### Solution : pricing configurable

Ajouter un mecanisme de **pricing override** dans la configuration :

```json
// appsettings.json ou .maestro/config.json
{
  "CostOverrides": {
    "deepseek-ai/deepseek-coder-1.3b-instruct": {
      "inputPricePerMillion": 3.0,
      "outputPricePerMillion": 15.0
    }
  }
}
```

`ModelPricingService` verifie d'abord les overrides AVANT le fallback local/cloud. Ca permet de tester toute la chaine de couts avec des modeles locaux gratuits.

**Avantage** : zero cout reel, mais la chaine de tracking est exercee de bout en bout.

---

## 3. Plan propose : Phase 59 — Gouvernance des Couts

### 59-A : Fondations (backend) — 1.5 jours

| Tache | Description |
|-------|-------------|
| **A1. Pricing overrides** | Config `CostOverrides` dans `IModelPricingService`. Priorite : override > LLM-Provider > fallback |
| **A2. Session cost on entity** | Ajouter `TotalCostUsd` sur `ProjectSession` (persiste, pas seulement variable temporaire) |
| **A3. Cost limits model** | `CostLimits` entity : `maxPerSession`, `maxPerDay`, `maxPerWeek`, `maxPerMonth`, `maxGlobal` |
| **A4. Cost limit enforcement** | Check dans `BlockRefHandler.AccumulateCosts()` — si limite depassee, throw `CostLimitExceededException` |
| **A5. Cost history table** | `CostEntry` entity : sessionId, blockId, modelId, cost, tokens, timestamp. Persiste chaque execution |
| **A6. API endpoints** | `GET /api/costs/summary` (par jour/semaine/mois), `GET /api/sessions/{id}/costs`, `GET/PUT /api/costs/limits` |

### 59-B : TUI + CLI — 1 jour

| Tache | Description |
|-------|-------------|
| **B1. Cout dans Spaces** | Afficher `$X.XX` a cote de chaque session dans la liste |
| **B2. Cout dans le status bar** | Cout cumule de la session courante dans le footer |
| **B3. Page/widget couts** | Section dans Home ou page dediee : cout jour/semaine/mois, par provider, par session |
| **B4. CLI `maestro costs`** | `costs summary`, `costs set-limit`, `costs history` |
| **B5. Alerte dans le TUI** | Notification quand 80% d'une limite est atteinte. Arret a 100% |

### 59-C : Validation avec provider local — 0.5 jour

| Tache | Description |
|-------|-------------|
| **C1. Configurer pricing override** | Modele local a $3/$15 per million (simule un modele cloud) |
| **C2. Lancer block-forge** | Verifier que les couts s'accumulent correctement |
| **C3. Tester les limites** | Fixer une limite a $0.01, verifier que l'execution s'arrete |
| **C4. Verifier l'affichage** | Spaces, status bar, `maestro costs summary` — tout montre des valeurs > $0 |
| **C5. Verifier l'historique** | `GET /api/costs/summary` retourne des donnees coherentes |

### 59-D : Provider Anthropic API — 1 jour

| Tache | Description |
|-------|-------------|
| **D1. Provider Anthropic** | Ajouter dans LLM-Provider .NET (cle API, modeles Claude) |
| **D2. Setup TUI** | Ajouter option "Anthropic API" dans ProviderSetupScreen |
| **D3. Test block-forge** | Lancer `/create-agent` avec provider API rapide (~3-5s/iteration vs 30-60s) |
| **D4. Valider outputs structures** | blockId/fitness dans le resultat (fix C# de Phase 58-C) |
| **D5. Valider les couts reels** | Verifier que les couts affiches correspondent a la realite Anthropic |

---

## 4. Priorites et dependances

```
59-A (backend fondations)
  |
  +---> 59-B (TUI + CLI)     ---> 59-C (validation locale)
  |                                    |
  +------------------------------------+--> 59-D (provider Anthropic)
```

**59-A est le prerequis de tout.** 59-B et 59-C peuvent etre en parallele. 59-D depend de 59-C (on veut s'assurer que tout marche en local avant de depenser de l'argent reel).

---

## 5. Modele de donnees propose

### CostLimits (nouveau)

```csharp
public class CostLimits
{
    public decimal? MaxPerSession { get; set; }      // USD max par session
    public decimal? MaxPerDay { get; set; }           // USD max par jour (toutes sessions)
    public decimal? MaxPerWeek { get; set; }          // USD max par semaine
    public decimal? MaxPerMonth { get; set; }         // USD max par mois
    public decimal? MaxGlobal { get; set; }           // USD max total (lifetime)
    public string? DefaultProvider { get; set; }      // Provider par defaut pour les limites
    public Dictionary<string, decimal> PerProvider { get; set; } // Limites par provider
}
```

### CostEntry (nouveau, pour historique)

```csharp
public class CostEntry
{
    public string Id { get; set; }                // UUID
    public string SessionId { get; set; }
    public string BlockId { get; set; }
    public string ModelId { get; set; }
    public string ProviderId { get; set; }
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public decimal CostUsd { get; set; }
    public DateTime Timestamp { get; set; }
}
```

### CostSummary (reponse API)

```json
{
  "today": { "totalCost": 0.42, "totalTokens": 15200, "requestCount": 23 },
  "thisWeek": { "totalCost": 1.87, "totalTokens": 68400, "requestCount": 112 },
  "thisMonth": { "totalCost": 5.23, "totalTokens": 194000, "requestCount": 342 },
  "allTime": { "totalCost": 12.50, "totalTokens": 467000, "requestCount": 891 },
  "byProvider": {
    "Anthropic": { "totalCost": 4.10, "totalTokens": 150000 },
    "Local": { "totalCost": 0.00, "totalTokens": 44000 }
  },
  "limits": {
    "maxPerSession": 1.00,
    "maxPerDay": 5.00,
    "maxPerMonth": 50.00,
    "currentDay": 0.42,
    "remainingDay": 4.58
  }
}
```

---

## 6. Definition of Done

- [ ] Pricing overrides fonctionnent (modele local simule un cout > $0)
- [ ] Limites de cout configurables (session, jour, semaine, mois)
- [ ] Execution s'arrete quand une limite est depassee (avec message clair)
- [ ] Cout visible dans Spaces (par session) et status bar
- [ ] `maestro costs summary` affiche un resume coherent
- [ ] Historique des couts consultable via API
- [ ] Alerte a 80% de la limite
- [ ] Validation E2E avec provider local (couts simules)
- [ ] Provider Anthropic API fonctionnel
- [ ] Block-forge termine en < 5 min avec provider API
- [ ] Outputs structures (blockId/fitness) valides E2E

### NOT in scope
- Dashboard web (TUI seulement)
- Facturation/paiement (pas de billing)
- Quotas par utilisateur (single-user pour V1)
- Budgets par workspace (session + global suffisent)

---

## 7. Estimation effort

| Sous-phase | Effort | Prerequis |
|------------|--------|-----------|
| 59-A Backend | 1.5 jours | Aucun |
| 59-B TUI + CLI | 1 jour | 59-A |
| 59-C Validation locale | 0.5 jour | 59-A + 59-B |
| 59-D Provider Anthropic | 1 jour | 59-C |
| **Total** | **4 jours** | |

---

## 8. Risques

| Risque | Mitigation |
|--------|------------|
| Persistence : sessions en memoire seulement | CostEntry persiste sur disque (JSON file ou SQLite) |
| Sidecar restart perd l'historique | Ecrire les CostEntry sur disque immediatement |
| Provider API lent (rate limits) | Configurer retry + backoff dans LLM-Provider |
| Couts reels plus eleves que prevu | Limites strictes + alerte a 80% + tests locaux d'abord |
| Modele local trop lent pour block-forge | Le but est de tester les features de cout, pas la qualite agent |
