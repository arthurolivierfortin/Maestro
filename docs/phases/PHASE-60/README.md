# Phase 60 : Model Playground — Tester un modele directement dans le TUI

**Statut** : A faire
**Prerequis** : Phase 59 COMPLETE (agent isolation)
**Objectif** : Ajouter `/playground` dans le TUI et `maestro playground` dans le CLI pour tester un modele directement — choisir un provider/modele, envoyer un prompt, voir la reponse + tokens + cout. Utile pour verifier qu'un provider fonctionne avant de lancer un workflow.
**Duree estimee** : 2-3 jours

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-60/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS creer une page TUI entiere** — c'est un slash command interactif dans l'AgentPanel
5. **Ne PAS bypasser LLM-Provider** — toutes les requetes passent par le gateway (port 5010)

---

## Contexte

### Le probleme

Quand un utilisateur configure un nouveau provider (Anthropic, GitHub Models, local), il n'a aucun moyen de verifier que ca marche avant de lancer un workflow long (block-forge, /adapt). Si le provider est mal configure, il decouvre l'erreur apres plusieurs minutes d'attente.

### La solution

`/playground` permet de tester un modele en < 30 secondes :
1. Choisir un modele parmi ceux disponibles
2. Taper un prompt
3. Voir la reponse + tokens utilises + cout
4. Iterer ou changer de modele

```
> /playground

Available models:
  1. claude-sonnet-4-6 (Anthropic) ✓
  2. gpt-4o (GitHub Models) ✓
  3. deepseek-coder-v2 (Local) ✓

Choose model [1-3]: 1

Prompt: Explain what a fibonacci sequence is in one sentence.

Response: A Fibonacci sequence is a series of numbers where each number
is the sum of the two preceding ones, starting from 0 and 1.

Tokens: 42 prompt + 28 completion = 70 total
Cost: $0.0003
Time: 1.2s

[Enter] New prompt  [M] Change model  [Q] Quit playground
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 60-A | Backend : endpoint playground (prompt → reponse + metriques) | 0.5 jour |
| 60-B | TUI : `/playground` slash command + UI interactive | 1-1.5 jours |
| 60-C | CLI : `maestro playground` + tests | 0.5 jour |
| 60-T | Tests | 0.5 jour |

---

## 60-A : Backend endpoint playground

### Fichiers cibles

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Api/Controllers/PlaygroundController.cs` | Creer — POST /api/playground (modelId, prompt → response, tokens, cost, latency) |
| `apps/backend/src/Maestro.Application/DTOs/PlaygroundDtos.cs` | Creer — PlaygroundRequestDto, PlaygroundResponseDto |
| `apps/backend/src/Maestro.Api/Program.cs` | Modifier — DI registration |

### Verification

```bash
dotnet build apps/backend/src/Maestro.Api/Maestro.Api.csproj
curl -X POST http://localhost:5000/api/playground -H "Content-Type: application/json" \
  -d '{"modelId": "claude-sonnet-4-6", "prompt": "Hello"}'
# Resultat : JSON avec response, promptTokens, completionTokens, costUsd, latencyMs
```

---

## 60-B : TUI /playground

### Fichiers cibles

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | Modifier — parsePlayground() + /playground slash command handler |
| `packages/maestro-code/components/HelpOverlay.ts` | Modifier — ajouter /playground dans l'aide |
| `packages/maestro-client/src/domains/playground.ts` | Creer — SDK domain playground |

### Verification

```bash
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && node tests/real-demo-check.cjs
```

---

## 60-C : CLI + tests

### Fichiers cibles

| Fichier | Action |
|---------|--------|
| `packages/maestro-cli/cli.ts` | Modifier — commande `playground` |
| `packages/maestro-code/tests/PlaygroundSlash.test.ts` | Creer — tests parsing + integration |

### Verification

```bash
cd packages/maestro-code && npx vitest run
node packages/maestro-cli/index.js playground --model claude-sonnet-4-6 --prompt "Hello"
```

---

## 60-T : Tests

### Couches applicables

| Couche | Quand obligatoire |
|--------|-------------------|
| C1 — Type Check | Toujours |
| C2 — Tests unitaires | Parsing /playground, SDK domain |
| C4 — Real Demo Check | TUI /playground visible |
| C5 — Tests d'integration | POST /api/playground retourne une reponse valide |

---

## Definition of Done

- [ ] POST /api/playground fonctionne avec au moins 1 provider
- [ ] `/playground` dans le TUI affiche modeles + prompt + reponse + tokens + cout
- [ ] `maestro playground` dans le CLI fonctionne
- [ ] L'utilisateur peut tester un modele en < 30s
- [ ] Tests passent
- [ ] 0 regression

### NOT in scope

- Conversation multi-tour dans le playground (un prompt → une reponse)
- Streaming de la reponse (V1 = reponse complete)
- Historique des prompts playground
- Page TUI dediee (c'est un slash command)

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-60/checkpoint.md`

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 60 : Model Playground (/playground TUI + CLI)"
- Mettre a jour : "Current Project State"
