# 60-B : TUI — Model Detail refonte + Playground mode

---

## Lecture obligatoire

- `packages/maestro-code/components/ModelsScreen.ts` — page Models actuelle (providers + modeles)
- `packages/maestro-code/App.ts` — slash commands, navigation entre pages
- `packages/tui/types/api-client.ts` — IApiClient interface
- `packages/maestro-code/mocks/DemoApiClient.ts` — mock pour demo mode

---

## Ce que cette sous-phase fait

### 1. Fixer la page Models — liste des modeles fonctionnelle

La page Models montre actuellement "0 models" meme quand des providers sont actifs. Corriger :
- Appeler `GET /api/v1/models` (LLM-Provider) ou un endpoint backend qui forward la liste
- Afficher chaque modele avec : nom, provider, statut (✓/✗)
- Navigation j/k dans la liste des modeles
- Enter sur un modele → Model Detail

### 2. Model Detail — nouvelle vue

Quand l'utilisateur selectionne un modele et appuie Enter, afficher une vue detail :

```
┌─ MODEL DETAIL ──────────────────────────────────────────────────────┐
│                                                                      │
│  gpt-4o                                                             │
│  Provider: GitHub Models  │  Status: ✓ Available                     │
│                                                                      │
│  SPECS                                                               │
│  Context: 128,000 tokens  │  Max output: 16,384 tokens              │
│  Capabilities: chat, function_calling, structured-output             │
│                                                                      │
│  PRICING                                                             │
│  Input:  $2.50 / MTok  │  Output: $10.00 / MTok                    │
│                                                                      │
│  USAGE (today)                                                       │
│  Requests: 23  │  Tokens: 15,200  │  Cost: $0.06                    │
│                                                                      │
│  [T] Test this model  [Esc] Back                                     │
└──────────────────────────────────────────────────────────────────────┘
```

Les donnees viennent de :
- `/api/v1/models` — specs, pricing, capabilities
- `/api/costs/summary` → `byModel` — usage du jour

### 3. Playground mode — composant reutilisable

Un composant `PlaygroundView` qui s'affiche quand :
- L'utilisateur appuie `[T]` dans Model Detail
- Ou tape `/playground` dans la page Agent

Le composant recoit le `modelId` selectionne (ou demande de choisir si venu de `/playground`).

```
┌─ PLAYGROUND: gpt-4o ────────────────────────────────────────────────┐
│                                                                      │
│  Quick tests:                                                        │
│    [1] Structured output    [2] Tool calling    [3] Long context     │
│    [4] Code generation      [5] Instruction following  [6] Multi-lang│
│                                                                      │
│  Or press / to type a custom prompt                                  │
│                                                                      │
│  ── Test: Structured Output ────────────────────────────────────     │
│                                                                      │
│  System: Return a JSON object with fields: name, age, hobbies       │
│  Prompt: Describe a 25-year-old software developer                   │
│                                                                      │
│  ┌─ Response ────────────────────────────────────────────────────┐   │
│  │ {"name":"Alex","age":25,"hobbies":["coding","hiking"]}       │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Result: ✓ PASS (valid JSON, all fields present)                     │
│  Tokens: 52 + 18 = 70  │  Cost: $0.0003  │  Time: 0.8s             │
│                                                                      │
│  [1-6] Run test  [/] Custom prompt  [M] Change model  [Esc] Back    │
└──────────────────────────────────────────────────────────────────────┘
```

Flow :
- `[1-6]` → lance un test pre-configure, affiche resultat avec ✓/✗
- `/` → focus input, taper un prompt custom, Enter pour envoyer
- `[M]` → retour a la liste des modeles pour en choisir un autre
- `[Esc]` → retour a la vue precedente (Model Detail ou Agent page)

### 4. `/playground` slash command

Dans `App.ts`, ajouter le handler `/playground` :
- Si un modele est specifie : `/playground gpt-4o` → ouvre directement le playground avec ce modele
- Si pas de modele : `/playground` → affiche la liste des modeles disponibles, l'utilisateur choisit avec `[1-N]`
- Utilise le meme composant `PlaygroundView`

### 5. Navigation

```
Page Agent → /playground → PlaygroundView (choisir modele d'abord)
Page Models → j/k → Enter → ModelDetail → [T] → PlaygroundView (modele pre-selectionne)
PlaygroundView → [Esc] → retour a l'origine
PlaygroundView → [M] → liste modeles → choisir → PlaygroundView avec nouveau modele
```

---

## Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/ModelsScreen.ts` | Refactorer — fixer liste modeles, ajouter navigation, Model Detail view |
| `packages/maestro-code/components/PlaygroundView.ts` | Creer — composant playground reutilisable (tests + custom prompt) |
| `packages/maestro-code/App.ts` | Modifier — handler /playground, navigation vers PlaygroundView |
| `packages/maestro-code/components/HelpOverlay.ts` | Modifier — ajouter /playground |
| `packages/maestro-client/src/domains/playground.ts` | Creer — SDK domain (send, listTests, runTest) |
| `packages/maestro-client/src/client.ts` | Modifier — ajouter playground domain |
| `packages/maestro-client/index.ts` | Modifier — exporter types playground |
| `packages/maestro-cli/api-client.ts` | Modifier — adapter playground methods |
| `packages/tui/types/api-client.ts` | Modifier — ajouter playground methods a IApiClient |
| `packages/maestro-code/mocks/DemoApiClient.ts` | Modifier — mock playground pour demo mode |

---

## Verification

```bash
# Type check
cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

# Tests
cd C:\Meastro\packages\maestro-code && npx vitest run
# Pas de regression

# Verification visuelle OBLIGATOIRE via MCP :
# 1. Page Models : liste des modeles visible, j/k fonctionne
# 2. Enter sur un modele → Model Detail avec specs + pricing
# 3. [T] → Playground avec tests pre-configures
# 4. [1] → lance Structured Output test, affiche ✓/✗
# 5. / → custom prompt, reponse affichee
# 6. /playground depuis Agent → meme playground
```

---

## Anti-patterns

- Ne PAS creer le PlaygroundView comme un slash command inline (addLine) — c'est un COMPOSANT React avec son propre state
- Ne PAS dupliquer le code playground entre Models et Agent — un seul composant, deux points d'entree
- Ne PAS bloquer le TUI pendant l'appel LLM — afficher "Sending..." puis la reponse quand elle arrive
- Ne PAS ignorer les erreurs API — afficher clairement "Model not available" ou "Provider error: ..."

---

## Checkpoint

```markdown
## 60-B : TUI playground
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Models liste** : visible et fonctionnelle
**Model Detail** : specs + pricing + usage affiches
**PlaygroundView** : tests + custom prompt fonctionnels
**/playground** : accessible depuis Agent
**[T]** : accessible depuis Model Detail
**Type check** : 0 erreurs
**Verification visuelle** : validee
```
