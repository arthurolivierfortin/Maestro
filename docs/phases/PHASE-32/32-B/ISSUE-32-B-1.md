# Issue 32-B-1 : Format du manifeste

**Statut** : A faire
**Estimation** : 1-2 heures
**Prerequis** : 32-A-2 (au moins Tier 2 avec des donnees de fitness)

---

## Description

Definir et implementer le format du manifeste qui est embarque dans chaque workflow publie.

---

## Tache

### 1. Format du manifeste

Le manifeste est dans `metadata.manifest` du .block.json du workflow :

```json
{
  "metadata": {
    "manifest": {
      "version": "1.0.0",
      "tier": 1,
      "requiredModels": {
        "prepare": { "model": "claude-opus", "provider": "anthropic" },
        "plan": { "model": "claude-opus", "provider": "anthropic" },
        "implement-step": { "model": "claude-sonnet", "provider": "anthropic" },
        "test": { "model": "claude-sonnet", "provider": "anthropic" },
        "review": { "model": "claude-opus", "provider": "anthropic" },
        "commit": { "model": "claude-sonnet", "provider": "anthropic" }
      },
      "fitness": {
        "composite": 0.92,
        "perBlock": {
          "prepare": 0.90,
          "plan": 0.95,
          "implement-step": 0.88,
          "test": 0.92,
          "review": 0.94,
          "commit": 0.95
        }
      },
      "testedSubstitutes": {
        "prepare": [
          { "model": "claude-sonnet", "fitness": 0.85, "viable": true },
          { "model": "claude-haiku", "fitness": 0.70, "viable": false }
        ],
        "commit": [
          { "model": "claude-haiku", "fitness": 0.90, "viable": true },
          { "model": "qwen2.5-coder", "fitness": 0.82, "viable": true }
        ]
      },
      "evaluationCriteria": {
        "composite": "weighted: task-completed(0.35) + code-quality(0.25) + tests-pass(0.20) + plan-quality(0.10) + commit-quality(0.10)",
        "perBlock": "scenario-based with 3 test cases each"
      }
    }
  }
}
```

### 2. Generer automatiquement le manifeste

Creer un script ou bloc qui genere le manifeste a partir des donnees de foundry :
- Lire les fitness mesures dans les sessions foundry du workspace
- Lire les modeles utilises dans les .block.json
- Assembler le manifeste

### 3. Integrer dans le publish

Quand `block publish` est execute, le manifeste est genere et insere dans le .block.json.

---

## Critere de completion

- [ ] Le format du manifeste est documente
- [ ] Le manifeste est genere automatiquement a partir des donnees de foundry
- [ ] Chaque workflow publie contient un `metadata.manifest`
- [ ] Le manifeste contient : requiredModels, fitness, testedSubstitutes, evaluationCriteria
