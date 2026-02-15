# Phase 26-B : Analyse Approfondie — CLI Agent Providers (Claude Code, OpenCode)

> Date : 2026-02-14
> Status : Analyse
> Auteur : Claude (analyse demandee par l'utilisateur)

---

## 1. Contexte et Motivation

L'utilisateur a decouvert le projet **get-shit-done** (GSD) qui utilise les capacites de **Claude Code** (slash commands, subagents, outils integres) pour orchestrer du developpement autonome. La question est :

> Peut-on integrer Claude Code comme provider LLM dans Maestro, tout en preservant l'architecture Maestro (agent = block, executeur mecanique, contenu dans les prompts) ?

Et plus largement : peut-on creer une abstraction **CLI Agent Provider** qui supporterait Claude Code aujourd'hui et **OpenCode** (ou d'autres) demain ?

---

## 2. Etat des Lieux — Les Providers LLM Actuels

### Architecture actuelle

```
ILLMGateway (interface Application)
├── LLMProviderGateway      ← LLM-Provider local (Python/FastAPI, modeles HuggingFace sur GPU)
├── AzureOpenAIGateway       ← Azure OpenAI (cloud, chat/completions REST API)
└── LLMGateway               ← Placeholder (hello world)
```

Le choix du provider est fait au demarrage dans `Program.cs` :
- Si Azure est configure → `AzureOpenAIGateway`
- Sinon → `LLMProviderGateway` (local)

Chaque gateway recoit un `LLMRequest` (prompt/messages, model, temperature, maxTokens) et retourne un `LLMResponse` (content, tokens, model).

### Limites actuelles

1. **Un seul provider actif** — on ne peut pas utiliser Azure ET local simultanement
2. **Pas de routing par model** — on ne peut pas dire "utilise Claude pour l'agent X et SmolLM2 pour l'inference Y"
3. **Pas de support API Anthropic directe** — pas de `@anthropic-ai/sdk` comme gateway
4. **Pas de support CLI-based providers** — Claude Code/OpenCode fonctionnent via CLI, pas via REST

---

## 3. Qu'est-ce que Claude Code ?

### CLI Tool

Claude Code est un outil CLI (`claude`) qui fournit un acces interactif ou headless a Claude (Opus, Sonnet, Haiku). Modes cles :

| Mode | Usage |
|------|-------|
| `claude` (interactif) | REPL conversationnel avec outils (edit, bash, search) |
| `claude -p "prompt"` | Mode headless — prompt in, response out |
| `claude -p "..." --output-format json` | JSON structure avec `result`, `session_id`, `usage`, `total_cost_usd` |
| `claude -p "..." --output-format stream-json` | Streaming NDJSON event par event |

### SDK (Agent SDK)

Le package `@anthropic-ai/claude-agent-sdk` (TypeScript) / `claude-agent-sdk` (Python) expose la meme fonctionnalite via code :

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "...",
  options: {
    allowedTools: [],           // Pas d'outils = inference pure
    model: "sonnet",
    systemPrompt: "...",
    maxTurns: 1,
    permissionMode: "bypassPermissions"
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Capacites natives de Claude Code

| Capacite | Description |
|----------|-------------|
| **Outils integres** | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Task (subagents) |
| **Subagents** | Spawn d'agents fils avec contexte frais (200k tokens chacun) |
| **MCP Servers** | Extension via outils custom (protocol MCP) |
| **Hooks** | Lifecycle hooks (PreToolUse, PostToolUse, Stop) |
| **Session management** | `--continue`, `--resume <session_id>` |
| **System prompt** | `--system-prompt "..."` pour override complet |
| **Model selection** | `--model sonnet/opus/haiku` |
| **Budget control** | `--max-budget-usd N` |
| **Structured output** | `--json-schema '{...}'` pour output JSON contraint |

### Authentification

| Methode | Facturation |
|---------|-------------|
| `ANTHROPIC_API_KEY` | Pay-per-token (API rates) |
| `claude login` (Pro/Max) | Subscription ($20-200/mois) |
| Bedrock/Vertex/Foundry | Cloud provider billing |

**ATTENTION** : L'Agent SDK pour usage tiers **requiert une API key**. On ne peut pas utiliser le login Pro/Max dans un produit tiers.

---

## 4. Qu'est-ce que OpenCode ?

OpenCode est un CLI d'agent de code **open-source** (MIT) similaire a Claude Code mais **provider-agnostic** :

| Dimension | Claude Code | OpenCode |
|-----------|-------------|----------|
| Source | Proprietaire | Open source (MIT) |
| Modeles | Claude uniquement | 75+ providers + Ollama (local) |
| Architecture | CLI + SDK | Client/serveur avec HTTP API |
| Prix | Subscription ou API | Gratuit (payez votre provider) |
| Lock-in | Anthropic | Aucun |

OpenCode est pertinent comme futur provider car il pourrait donner acces a des modeles non-Anthropic (GPT-4, Gemini, Llama, etc.) via la meme interface CLI.

---

## 5. Analyse Critique : Ce qu'il faut et ce qu'il ne faut PAS faire

### 5.1 Le piege GSD — Utiliser les capacites natives de Claude Code

GSD utilise **directement** les capacites de Claude Code :
- Slash commands pour orchestrer
- Subagents natifs pour deleguer
- Outils integres (Edit, Bash) pour agir
- Fichiers markdown pour l'etat

C'est elegant pour un utilisateur de Claude Code, mais **c'est l'inverse de l'architecture Maestro**.

| Approche GSD | Approche Maestro | Pourquoi |
|--------------|------------------|----------|
| Orchestration dans Claude Code | Orchestration dans Maestro (workflows, EntryPointExecutor) | Maestro controle le pipeline |
| Subagents Claude Code | Blocks agents (AgentBlockExecutor) | Les agents sont des blocks avec fitness |
| Outils Claude Code (Edit, Bash) | Outils Maestro (tool blocks, CLI executor) | Un seul outil : `maestro_cli` |
| Etat dans des fichiers .md | Etat dans les session variables | Maestro a son propre state management |
| System prompt par defaut de Claude Code | System prompt dans `system-prompt.md` du block | Le contenu est dans le block |

**Si on utilise Claude Code comme agent complet, on bypasse tout Maestro.** Plus de fitness, plus de metrics, plus de blocks, plus de monitor. Maestro devient un lanceur de Claude Code — inutile.

### 5.2 L'approche correcte — Claude Code comme LLM Gateway (inference pure)

Claude Code/Agent SDK peut etre utilise comme une **interface vers les modeles Claude** :

```
Maestro block → AgentBlockExecutor → ILLMGateway → ClaudeCodeGateway → claude -p "..." → response
                                                    ↑
                                         Le prompt complet vient du block
                                         Temperature, max_tokens viennent du config
                                         Pas d'outils Claude Code actives
                                         Reponse brute retournee a Maestro
```

Dans ce mode :
- **Maestro controle le prompt** (system prompt du block, user message construit par l'executor)
- **Maestro controle la boucle agentic** (AgentBlockExecutor parse les tool calls, execute via CLI)
- **Claude Code est juste un tuyau** vers les modeles Claude (Opus, Sonnet, Haiku)
- **Les outils de Claude Code sont desactives** (`allowedTools: []`)

### 5.3 Mais est-ce que ca vaut le coup ? Analyse cout/benefice

| Avantage | Inconvenient |
|----------|-------------|
| Acces a Claude Opus/Sonnet/Haiku | Plus cher que les modeles locaux |
| Modeles tres capables (200k contexte) | Latence reseau vs GPU local |
| Abonnement Max = usage illimite | SDK tiers = API key obligatoire (pay-per-token) |
| Structured output (`--json-schema`) | Overhead du CLI/SDK vs API directe |
| Pas besoin de GPU | Dependance a Anthropic |

**Question critique** : pourquoi utiliser Claude Code/Agent SDK plutot que l'API Anthropic directe (`@anthropic-ai/sdk`) ?

| Via Claude Code / Agent SDK | Via Anthropic API directe |
|---------------------------|--------------------------|
| Overhead (agent loop, tool infra) | Direct, minimal |
| Plus de features (streaming NDJSON, sessions) | REST classique, SSE streaming |
| Prix identique (API key = memes tarifs) | Prix identique |
| Depend de Claude Code installe | Depend uniquement de la cle API |
| Prompt system Claude Code ajoute par defaut | Full controle du prompt |

**Mon verdict** : Pour de l'**inference pure** (ce que Maestro fait), l'API Anthropic directe est superieure. Claude Code/Agent SDK ajoute de l'overhead sans benefice quand on desactive tous les outils.

Mais il y a **un cas d'usage precis** ou Claude Code a un avantage : **l'execution d'agents Claude Code complets** en tant que **tool blocks Maestro**. Plus sur ca dans la section 7.

---

## 6. Architecture Proposee

### 6.1 Hierarchie de classes

L'idee de l'utilisateur est correcte : creer une abstraction parent qui supporte Claude Code et OpenCode.

Mais je propose d'aller plus loin. Le vrai besoin est un **multi-provider gateway** qui route les requetes par model :

```
ILLMGateway (interface — inchangee)
│
├── MultiProviderGateway (NEW — router)
│   │
│   ├── LLMProviderGateway         (local GPU, SmolLM2, Qwen, etc.)
│   ├── AzureOpenAIGateway         (Azure, GPT-4, etc.)
│   ├── AnthropicApiGateway        (NEW — API directe Anthropic)
│   └── CliAgentGateway (abstract) (NEW — providers CLI)
│       ├── ClaudeCodeGateway      (NEW — via claude CLI / Agent SDK)
│       └── OpenCodeGateway        (FUTURE — via opencode CLI)
│
└── (registre de models → provider mapping)
```

### 6.2 Le MultiProviderGateway (router)

Aujourd'hui, `Program.cs` choisit UN gateway au demarrage. Avec plusieurs providers :

```csharp
public class MultiProviderGateway : ILLMGateway
{
    private readonly Dictionary<string, ILLMGateway> _providers;  // "local", "azure", "anthropic", "claude-code"
    private readonly Dictionary<string, string> _modelRoutes;     // "claude-sonnet" → "anthropic", "SmolLM2" → "local"
    private readonly string _defaultProvider;

    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken ct)
    {
        var provider = ResolveProvider(request.ModelId);
        return await provider.SendAsync(request, ct);
    }

    private ILLMGateway ResolveProvider(string? modelId)
    {
        if (modelId != null && _modelRoutes.TryGetValue(modelId, out var providerName))
            return _providers[providerName];
        return _providers[_defaultProvider];
    }
}
```

Configuration dans `appsettings.json` :

```json
{
  "LLMProviders": {
    "Default": "local",
    "Providers": {
      "local": { "Type": "LLMProvider", "BaseUrl": "http://localhost:8000" },
      "anthropic": { "Type": "AnthropicApi", "ApiKey": "sk-ant-..." },
      "claude-code": { "Type": "ClaudeCode", "Model": "sonnet" }
    },
    "ModelRoutes": {
      "claude-sonnet": "anthropic",
      "claude-opus": "anthropic",
      "claude-haiku": "anthropic",
      "SmolLM2-1.7B-Instruct": "local",
      "Qwen2.5-Coder-1.5B-Instruct": "local"
    }
  }
}
```

### 6.3 AnthropicApiGateway (recommande en priorite)

Avant Claude Code, implementer un gateway API Anthropic directe. C'est plus simple, plus performant, et couvre 90% du besoin :

```csharp
public class AnthropicApiGateway : ILLMGateway
{
    // POST https://api.anthropic.com/v1/messages
    // Headers: x-api-key, anthropic-version
    // Body: { model, messages, max_tokens, temperature, system }
    // Response: { content[{type:"text", text:"..."}], usage{input_tokens, output_tokens} }
}
```

C'est **exactement** le pattern de `AzureOpenAIGateway` — REST, JSON, chat/completions-like. Implementation directe, ~150 lignes.

### 6.4 CliAgentGateway (abstraction CLI)

Pour les providers CLI (Claude Code, OpenCode), une abstraction commune :

```csharp
/// <summary>
/// Base class for LLM gateways that work via CLI tools (claude, opencode).
/// Invokes the CLI in headless mode, captures the response.
/// </summary>
public abstract class CliAgentGateway : ILLMGateway
{
    protected abstract string CliExecutable { get; }   // "claude" ou "opencode"

    protected abstract string[] BuildArguments(LLMRequest request);

    protected abstract LLMResponse ParseOutput(string jsonOutput);

    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken ct)
    {
        var args = BuildArguments(request);
        var output = await ExecuteCliAsync(args, ct);
        return ParseOutput(output);
    }

    private async Task<string> ExecuteCliAsync(string[] args, CancellationToken ct)
    {
        // Process.Start() avec capture stdout
        // Timeout configurable
        // Parsing JSON de la sortie
    }
}
```

### 6.5 ClaudeCodeGateway

```csharp
public class ClaudeCodeGateway : CliAgentGateway
{
    private readonly ClaudeCodeSettings _settings;

    protected override string CliExecutable => "claude";

    protected override string[] BuildArguments(LLMRequest request)
    {
        var args = new List<string>
        {
            "-p", BuildPromptFromRequest(request),
            "--output-format", "json",
            "--model", request.ModelId ?? _settings.DefaultModel,
            "--allowedTools", "",  // CRITICAL: pas d'outils = inference pure
        };

        if (!string.IsNullOrEmpty(request.SystemPrompt))
            args.AddRange(new[] { "--system-prompt", request.SystemPrompt });

        // Construire le prompt a partir de Messages si present
        // (Claude Code supporte --system-prompt + prompt user dans -p)
        return args.ToArray();
    }

    protected override LLMResponse ParseOutput(string jsonOutput)
    {
        // Parse: { "result": "...", "session_id": "...", "usage": {...}, "total_cost_usd": 0.05 }
        var doc = JsonDocument.Parse(jsonOutput);
        return new LLMResponse
        {
            Content = doc.RootElement.GetProperty("result").GetString() ?? "",
            Model = _settings.DefaultModel,
            // Note: Claude Code JSON output inclut usage et cout
        };
    }
}
```

**Alternative via SDK** (plus robuste que le CLI) :

Si Maestro a un composant Node.js (le CLI `maestro-cli/`), on pourrait utiliser le SDK TypeScript directement :

```typescript
// maestro-cli/providers/claude-code-provider.ts
import { query } from "@anthropic-ai/claude-agent-sdk";

export async function claudeInference(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
  for await (const message of query({
    prompt,
    options: {
      allowedTools: [],
      model: model ?? "sonnet",
      systemPrompt: systemPrompt,
      maxTurns: 1,
      permissionMode: "bypassPermissions"
    }
  })) {
    if ("result" in message) return message.result;
  }
  throw new Error("No result from Claude Code");
}
```

Puis exposer ca via un endpoint HTTP dans un micro-service Node.js, que le backend C# appelle comme il appelle LLM-Provider.

---

## 7. Le Cas d'Usage Avance : Claude Code comme Tool Block

Au-dela de l'inference pure, il y a un scenario ou Claude Code apporte une vraie valeur ajoutee : **comme outil Maestro**.

Imagine un tool block `claude-code-execute` :

```json
{
  "id": "claude-code-execute",
  "blockType": "tool",
  "config": {
    "runtime": "claude-code",
    "allowedTools": ["Read", "Edit", "Bash", "Glob", "Grep"],
    "maxBudgetUsd": 1.0,
    "model": "sonnet"
  }
}
```

Ce block recoit une tache, la delegue a Claude Code **avec ses outils actives**, et retourne le resultat. Claude Code fait le travail (lire des fichiers, editer du code, executer des commandes) — mais Maestro controle :
- **Quel block est execute** (decision de l'agent Maestro)
- **Quel prompt est envoye** (system prompt du block parent)
- **Quel budget** (config du block)
- **Quels outils** (config du block, pas hardcode)
- **Les metriques** (duree, cout, succes)
- **Le fitness** (evaluation du resultat)

C'est le meilleur des deux mondes :
- Maestro orchestre, mesure, optimise
- Claude Code execute avec ses capacites natives (edit, bash, search)

**Mais attention** : ca cree une dependance forte a Claude Code. Si Claude Code change son API ou ses prix, le block casse. C'est un choix a faire consciemment.

---

## 8. Priorite d'Implementation

### Tier 1 : AnthropicApiGateway (PRIORITE)

| Aspect | Detail |
|--------|--------|
| **Effort** | 2-3h |
| **Impact** | Enorme — acces a Claude Opus/Sonnet/Haiku |
| **Complexite** | Faible — copier le pattern AzureOpenAIGateway |
| **Prerequis** | API key Anthropic |
| **Risque** | Faible — API stable et documentee |

C'est de loin le plus rentable. L'API Anthropic (`POST /v1/messages`) est quasi-identique a Azure OpenAI. On obtient Claude Opus 4.6 directement, sans overhead.

### Tier 2 : MultiProviderGateway (router)

| Aspect | Detail |
|--------|--------|
| **Effort** | 3-4h |
| **Impact** | Eleve — routing par model |
| **Complexite** | Moyenne — refactoring DI dans Program.cs |
| **Prerequis** | Au moins 2 providers configures |
| **Risque** | Moyen — changement architectural |

Permet d'utiliser SmolLM2 pour les taches simples et Claude Opus pour les taches complexes, dans la meme session.

### Tier 3 : CliAgentGateway + ClaudeCodeGateway

| Aspect | Detail |
|--------|--------|
| **Effort** | 4-6h |
| **Impact** | Moyen — meme resultat que Tier 1 avec plus d'overhead |
| **Complexite** | Elevee — gestion processus, timeouts, parsing CLI |
| **Prerequis** | Claude Code installe, API key |
| **Risque** | Eleve — depends de la CLI Claude Code |

**Mon avis honnete** : Tier 3 est inferieur a Tier 1 pour l'inference pure. Le seul avantage de Claude Code sur l'API directe est les **outils integres** (Edit, Bash, etc.) — mais on les desactive pour l'inference pure. Donc pourquoi payer l'overhead ?

Le Tier 3 ne devient pertinent que si on veut le **Cas d'Usage Avance** (section 7) : utiliser Claude Code comme tool block avec ses outils actives.

### Tier 4 : OpenCodeGateway (futur)

| Aspect | Detail |
|--------|--------|
| **Effort** | 2-3h (si CliAgentGateway existe) |
| **Impact** | Moyen — acces multi-provider via OpenCode |
| **Complexite** | Faible (si l'abstraction existe) |
| **Prerequis** | OpenCode installe |
| **Risque** | Moyen — OpenCode est jeune |

---

## 9. Ce qui doit etre Preserve (Non-Negociable)

Quelle que soit l'approche choisie, ces principes Maestro sont **non-negociables** :

| Principe | Implication pour le provider |
|----------|------------------------------|
| **Agent = Block** | Maestro controle la boucle agent, pas Claude Code |
| **System prompt dans le block** | Le prompt vient de `config.systemPrompt` / `system-prompt.md`, pas du provider |
| **Outils dans le prompt** | Les outils disponibles sont decrits dans le system prompt Maestro, pas les outils natifs du provider |
| **Fitness sur tout** | Le provider retourne une reponse — Maestro evalue la qualite |
| **CLI-First** | Les agents Maestro utilisent `maestro_cli` — pas les outils Claude Code |
| **Pas de fallback silent** | Si le provider echoue, erreur visible |
| **Un seul entity** | `BlockDefinition` — pas de `ClaudeCodeAgentDefinition` |

---

## 10. Recommandation Finale

### Phase 26-B : Implementation en 3 etapes

```
Etape 1: AnthropicApiGateway                    ← Le plus de valeur, le moins de risque
Etape 2: MultiProviderGateway (router par model) ← Permet local + cloud dans la meme session
Etape 3: CliAgentGateway + ClaudeCodeGateway     ← Uniquement si le cas d'usage avance (tool block) est desire
```

### Ce que je NE recommande PAS

1. **Utiliser Claude Code comme orchestrateur** (a la GSD) — ca bypasse Maestro completement
2. **Utiliser les subagents Claude Code** — les agents sont des blocks Maestro
3. **Utiliser les outils Claude Code pour les agents Maestro** — les agents utilisent `maestro_cli`
4. **Commencer par le CliAgentGateway** — l'API directe est superieure pour l'inference
5. **Creer un `ClaudeCodeAgentDefinition`** — on vient de supprimer `AgentDefinition` pour une bonne raison

### Ce que je RECOMMANDE

1. **Commencer par `AnthropicApiGateway`** — 2h de travail, acces immediat a Claude Opus 4.6
2. **Puis `MultiProviderGateway`** — routing SmolLM2 (simple) + Claude (complexe)
3. **Puis evaluer** si le tool block `claude-code-execute` vaut le cout (section 7)
4. **Garder `CliAgentGateway`** comme abstraction propre pour le futur (OpenCode, etc.)

---

## 11. Questions Ouvertes pour l'Utilisateur

1. **Avez-vous une API key Anthropic ?** Si oui, Tier 1 est faisable immediatement.
2. **Voulez-vous le routing multi-model ?** (SmolLM2 pour training, Claude pour production)
3. **Le cas d'usage avance (section 7)** vous interesse-t-il ? Utiliser Claude Code comme outil (avec Edit/Bash actives) ?
4. **Budget** : API Anthropic = ~$3-25 par million de tokens selon le modele. Les modeles locaux sont gratuits apres le cout GPU. Quel est votre budget ?
5. **OpenCode** : est-ce un objectif a court terme ou juste "garder la porte ouverte" ?

---

## Annexe A : Comparaison des Approches d'Integration

```
                        ┌──────────────────────────────────────────────────┐
                        │              Maestro Backend (C#)                 │
                        │                                                  │
                        │  Block → Executor → ILLMGateway → ???           │
                        └──────────────────┬───────────────────────────────┘
                                           │
                 ┌─────────────────────────┼──────────────────────────┐
                 │                         │                          │
    ┌────────────▼──────────┐  ┌──────────▼──────────┐  ┌──────────▼──────────────┐
    │   Option A:           │  │   Option B:          │  │   Option C:              │
    │   Anthropic API       │  │   Claude CLI         │  │   Claude Agent SDK       │
    │   (REST, C#)          │  │   (Process, C#)      │  │   (Node.js micro-svc)    │
    │                       │  │                      │  │                          │
    │  POST /v1/messages    │  │  claude -p "..."     │  │  query({ prompt: ... })  │
    │  x-api-key header     │  │  --output-format json│  │  allowedTools: []        │
    │  Direct, minimal      │  │  Parse stdout        │  │  HTTP bridge to C#       │
    │                       │  │                      │  │                          │
    │  Pro: Simple, rapide  │  │  Pro: Meme interface │  │  Pro: SDK officiel       │
    │  Pro: Pas de deps     │  │       que user       │  │  Pro: Sessions, resume   │
    │  Con: Pas de sessions │  │  Con: Process spawn  │  │  Con: Node.js dep        │
    │  Con: Pas d'outils    │  │  Con: Parsing fragile│  │  Con: Micro-service      │
    └───────────────────────┘  └──────────────────────┘  └──────────────────────────┘

    RECOMMANDE (Tier 1)        Possible (Tier 3)         Possible (Tier 3 alt)
```

## Annexe B : References

| Ressource | URL |
|-----------|-----|
| Claude Code headless mode | https://code.claude.com/docs/en/headless |
| Agent SDK overview | https://platform.claude.com/docs/en/agent-sdk/overview |
| Agent SDK TypeScript | https://platform.claude.com/docs/en/agent-sdk/typescript |
| Anthropic Messages API | https://docs.anthropic.com/en/api/messages |
| Get-Shit-Done | https://github.com/glittercowboy/get-shit-done |
| OpenCode | https://github.com/opencode-ai/opencode |
| Anthropic pricing | https://www.anthropic.com/pricing |
