# Issue 32-B-2 : Commande `maestro check`

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 32-B-1 (format du manifeste defini)

---

## Description

Implementer la commande `maestro check` qui compare les modeles disponibles sur la machine de l'utilisateur avec les manifestes des workflows publies, et recommande le meilleur tier.

---

## Tache

### 1. Detection des modeles disponibles

```bash
maestro check
```

La commande :
1. Interroge le LLM-Provider (`GET /api/v1/models/`) pour lister les modeles disponibles
2. Verifie la disponibilite de chaque provider (local, Claude, Azure, etc.)
3. Construit une liste de modeles disponibles

### 2. Comparaison avec les manifestes

Pour chaque workflow publie avec un manifeste :
1. Lire les `requiredModels` du manifeste
2. Pour chaque tier du workflow, verifier si TOUS les modeles requis sont disponibles
3. Identifier le meilleur tier compatible

### 3. Sortie

```
  Maestro Compatibility Check

  Available providers:
    ✓ Anthropic (Claude Opus, Sonnet, Haiku)
    ✓ Local (Qwen2.5-Coder-1.5B)
    ✗ Azure (not configured)

  Workflow: autonomous-dev
    Tier 1 (Opus/Sonnet)     ✓ Compatible — fitness 0.92
    Tier 2 (Sonnet/Haiku)    ✓ Compatible — fitness 0.85
    Tier 3 (Haiku/Qwen)      ✓ Compatible — fitness 0.78
    Tier 4 (Sonnet/Qwen)     ✓ Compatible — fitness 0.68
    Tier 5 (Qwen only)       ✓ Compatible — fitness 0.52

  Recommended: Tier 1 (best quality)
  Best local: Tier 3 (best with local models)
```

### 4. Mode JSON

```bash
maestro check --json
```

Retourne la meme information en JSON structure.

---

## Instructions de test

### Test 1 : Avec Claude disponible

- [ ] Les tiers utilisant Claude sont marques compatibles
- [ ] La recommandation est le meilleur tier

### Test 2 : Sans Claude (local only)

- [ ] Les tiers Claude sont marques incompatibles
- [ ] Le meilleur tier local est recommande

### Test 3 : Aucun modele disponible

- [ ] Message clair : "No compatible tier found"
- [ ] Suggestion : "Configure at least one LLM provider"

---

## Critere de completion

- [ ] Detection des modeles disponibles via LLM-Provider API
- [ ] Comparaison avec les manifestes des workflows publies
- [ ] Recommandation du meilleur tier
- [ ] Sortie lisible en terminal
- [ ] Mode `--json` pour l'integration programmatique
- [ ] Tests sur 3 configurations (tout disponible, local only, rien)
