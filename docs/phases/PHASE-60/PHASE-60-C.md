# 60-C : CLI `maestro playground` + tests

---

## Lecture obligatoire

- `packages/maestro-cli/cli.ts` — pattern des commandes CLI existantes
- `packages/maestro-cli/api-client.ts` — adapter SDK
- `packages/maestro-code/tests/CreateAgentSlash.test.ts` — pattern de tests slash command

---

## Ce que cette sous-phase fait

### 1. CLI `maestro playground`

```bash
# Custom prompt
maestro playground --model gpt-4o --prompt "Explain fibonacci"

# Run capability test
maestro playground --model gpt-4o --test structured-output

# Run all capability tests on a model
maestro playground --model gpt-4o --test-all

# List available tests
maestro playground --list-tests

# Interactive mode (si pas de --prompt ou --test)
maestro playground --model gpt-4o
# → Affiche prompt interactif
```

Output format :
```
Model: gpt-4o (GitHub Models)
Prompt: Explain fibonacci

Response:
  A Fibonacci sequence is a series where each number is the
  sum of the two preceding ones, starting from 0 and 1.

Tokens: 42 + 28 = 70  |  Cost: $0.0003  |  Time: 1.2s
```

Pour `--test-all` :
```
Model: gpt-4o (GitHub Models)
Running 6 capability tests...

  ✓ Structured Output    0.8s  $0.0002  PASS
  ✓ Tool Calling         1.1s  $0.0003  PASS
  ✗ Long Context         2.3s  $0.0008  FAIL (detail not found in response)
  ✓ Code Generation      0.9s  $0.0003  PASS
  ✓ Instruction Following 0.7s $0.0002  PASS
  ✓ Multi-Language       0.6s  $0.0001  PASS

Score: 5/6 (83%)  |  Total cost: $0.0019  |  Total time: 6.4s
```

Supporte `--json` pour output JSON brut.

### 2. Tests unitaires

`packages/maestro-code/tests/PlaygroundSlash.test.ts` :

| # | Test | Description |
|---|------|-------------|
| 1 | `/playground` sans modele | Parse action 'select-model' |
| 2 | `/playground gpt-4o` | Parse avec modelId |
| 3 | `/playground --test structured-output` | Parse avec testId |
| 4 | CLI `--model gpt-4o --prompt "hello"` | Invoque POST /api/playground |
| 5 | CLI `--model gpt-4o --test structured-output` | Invoque POST /api/playground/test |
| 6 | CLI `--model gpt-4o --test-all` | Invoque 6 tests en sequence |
| 7 | CLI `--list-tests` | Invoque GET /api/playground/tests |

### 3. Integration tests

| # | Test | Description |
|---|------|-------------|
| 8 | POST /api/playground retourne une reponse | Avec un modele reel (local ou GitHub) |
| 9 | POST /api/playground/test retourne pass/fail | Structured output test sur un modele reel |
| 10 | GET /api/playground/tests retourne 6 tests | Liste complete |

---

## Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `packages/maestro-cli/cli.ts` | Modifier — commande `playground` avec --model, --prompt, --test, --test-all, --list-tests, --json |
| `packages/maestro-code/tests/PlaygroundSlash.test.ts` | Creer — 7 tests unitaires |

---

## Verification

```bash
# Type check
cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

# Tests
cd C:\Meastro\packages\maestro-code && npx vitest run tests/PlaygroundSlash.test.ts
# 7/7 pass

# CLI test
node packages/maestro-cli/index.js playground --model gpt-4o --prompt "Say hello" --json
# Resultat : JSON avec content, tokens, cost

node packages/maestro-cli/index.js playground --list-tests
# Resultat : 6 tests

node packages/maestro-cli/index.js playground --model gpt-4o --test-all
# Resultat : 6 tests avec ✓/✗ et score
```

---

## Anti-patterns

- Ne PAS faire de mode interactif complexe dans le CLI — `--prompt` et `--test` sont les modes principaux
- Ne PAS ignorer `--json` — les outils d'automatisation en ont besoin
- Ne PAS lancer les tests en parallele dans `--test-all` — sequentiel pour eviter le rate limiting

---

## Checkpoint

```markdown
## 60-C : CLI playground
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**CLI --prompt** : fonctionne
**CLI --test** : fonctionne
**CLI --test-all** : 6 tests, score affiche
**CLI --list-tests** : 6 tests listes
**Tests unitaires** : 7/7 pass
**Type check** : 0 erreurs
```
