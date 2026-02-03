# Plan: Du Bootstrap à l'Équipe de Recherche Autonome

> Plan détaillé pour construire un système Foundry auto-améliorant

---

## Vue d'Ensemble

```
PHASE 1          PHASE 2          PHASE 3          PHASE 4          PHASE 5
Infrastructure   Évaluation       Agents           Foundry          Auto-
& Modèles        & Tests          Fondamentaux     Workflow         Amélioration

[Semaine 1-2]    [Semaine 3-4]    [Semaine 5-8]    [Semaine 9-12]   [Semaine 13+]

    │                │                │                │                │
    ▼                ▼                ▼                ▼                ▼
┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐
│Modèles │      │Tests   │      │Agents  │      │Foundry │      │Auto    │
│puissants│ ──► │standar-│ ──► │bootstrap│ ──► │semi-   │ ──► │amélio- │
│disponib.│      │disés   │      │manuels │      │autonome│      │ration  │
└────────┘      └────────┘      └────────┘      └────────┘      └────────┘
```

---

## PHASE 1: Infrastructure & Modèles (Semaine 1-2)

### Objectif
Avoir accès à des modèles puissants (Claude, GPT-4) ET des modèles économiques (DeepSeek, SmolLM) pour pouvoir:
- Utiliser les puissants comme "autorité" et évaluateurs
- Entraîner des agents sur les économiques

### 1.1 Audit LLM-Provider Actuel

**Tâche 1.1.1**: Vérifier l'état actuel du LLM-Provider
```bash
# Commandes à exécuter
cd C:\Meastro\llm-provider
cat config.yaml  # ou équivalent
# Lister les modèles configurés
```

**Fichiers à examiner**:
- `llm-provider/config.yaml` ou `llm-provider/config.json`
- `llm-provider/src/` - code source
- Documentation existante

**Questions à répondre**:
- [ ] Quels modèles sont déjà configurés?
- [ ] Quels providers sont supportés? (OpenAI, Anthropic, HuggingFace, Ollama)
- [ ] Comment ajouter un nouveau modèle?
- [ ] Y a-t-il des API keys configurées?

### 1.2 Configurer les Modèles Puissants (Autorités)

**Tâche 1.2.1**: Ajouter Claude API
```yaml
# Configuration à ajouter
providers:
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-opus
        name: Claude 3 Opus
        max_tokens: 4096
        cost_per_1k_input: 0.015
        cost_per_1k_output: 0.075
        capabilities: [reasoning, code, analysis, evaluation]
        use_for: [authority, evaluation, bootstrap]

      - id: claude-3-sonnet
        name: Claude 3 Sonnet
        max_tokens: 4096
        cost_per_1k_input: 0.003
        cost_per_1k_output: 0.015
        capabilities: [reasoning, code, analysis]
        use_for: [evaluation, general]
```

**Tâche 1.2.2**: Ajouter OpenAI API (optionnel)
```yaml
providers:
  openai:
    api_key: ${OPENAI_API_KEY}
    models:
      - id: gpt-4-turbo
        name: GPT-4 Turbo
        max_tokens: 4096
        capabilities: [reasoning, code, analysis]
        use_for: [authority, evaluation]
```

### 1.3 Configurer les Modèles Économiques (Agents)

**Tâche 1.3.1**: Vérifier/Ajouter DeepSeek
```yaml
providers:
  deepseek:
    api_key: ${DEEPSEEK_API_KEY}
    base_url: https://api.deepseek.com/v1
    models:
      - id: deepseek-coder-6.7b
        name: DeepSeek Coder 6.7B
        max_tokens: 4096
        cost_per_1k_input: 0.0001
        cost_per_1k_output: 0.0002
        capabilities: [code]
        use_for: [agents, training]

      - id: deepseek-coder-33b
        name: DeepSeek Coder 33B
        max_tokens: 4096
        cost_per_1k_input: 0.0003
        cost_per_1k_output: 0.0006
        capabilities: [code, reasoning]
        use_for: [agents, training]
```

**Tâche 1.3.2**: Configurer modèles locaux (Ollama)
```yaml
providers:
  ollama:
    base_url: http://localhost:11434
    models:
      - id: deepseek-coder:6.7b
        name: DeepSeek Coder 6.7B (Local)
        capabilities: [code]
        use_for: [agents, training, testing]
        cost_per_1k_input: 0  # Gratuit, local
        cost_per_1k_output: 0
```

### 1.4 API d'Abstraction des Modèles

**Tâche 1.4.1**: Créer/Vérifier l'interface unifiée
```
GET  /api/llm/models              # Liste tous les modèles disponibles
GET  /api/llm/models/{id}         # Détails d'un modèle
POST /api/llm/chat                # Appel unifié (route vers le bon provider)
GET  /api/llm/models/by-capability?cap=evaluation  # Filtrer par capacité
GET  /api/llm/models/by-use?use=authority          # Filtrer par usage
```

**Tâche 1.4.2**: Endpoint pour sélection automatique
```
POST /api/llm/select
{
  "task": "evaluation",
  "constraints": {
    "max_cost_per_call": 0.01,
    "min_capability": ["reasoning", "code"],
    "prefer": "cheapest"  // ou "best", "fastest"
  }
}
→ Returns: { "recommended_model": "claude-3-sonnet", "reason": "..." }
```

### 1.5 Tests de Validation

**Tâche 1.5.1**: Script de test des modèles
```bash
# test-models.sh
echo "Testing Claude..."
curl -X POST http://localhost:8000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-sonnet", "messages": [{"role": "user", "content": "Say hello"}]}'

echo "Testing DeepSeek..."
curl -X POST http://localhost:8000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-coder-6.7b", "messages": [{"role": "user", "content": "Write a hello world in Python"}]}'
```

### Livrables Phase 1
- [ ] LLM-Provider configuré avec modèles puissants (Claude/GPT-4)
- [ ] LLM-Provider configuré avec modèles économiques (DeepSeek, etc.)
- [ ] API unifiée fonctionnelle
- [ ] Tests validant chaque modèle
- [ ] Documentation des modèles disponibles

---

## PHASE 2: Système d'Évaluation & Tests (Semaine 3-4)

### Objectif
Avoir un système d'évaluation fonctionnel pour:
- Évaluer les outputs d'agents pendant le training
- Valider les agents avant publication

### 2.1 Évaluation par LLM (Training)

**Tâche 2.1.1**: Créer le service d'évaluation
```
backend/src/Maestro.Application/Services/EvaluationService.cs
```

```csharp
public interface IEvaluationService
{
    Task<EvaluationResult> EvaluateAsync(
        string agentOutput,
        string expectedBehavior,
        EvaluationCriteria criteria,
        string evaluatorModel = "claude-3-sonnet");
}

public class EvaluationCriteria
{
    public List<Criterion> Criteria { get; set; }
    public double PassThreshold { get; set; } = 0.8;
}

public class Criterion
{
    public string Name { get; set; }      // "correctness", "quality", etc.
    public double Weight { get; set; }     // 0.0 - 1.0
    public string Description { get; set; } // Pour le prompt de l'évaluateur
}

public class EvaluationResult
{
    public double OverallScore { get; set; }
    public Dictionary<string, double> CriteriaScores { get; set; }
    public string Feedback { get; set; }
    public string EvaluatorModel { get; set; }
    public bool Passed { get; set; }
}
```

**Tâche 2.1.2**: Prompt template pour l'évaluateur
```
blocks/system/evaluation/evaluator-prompt.txt
```

```
You are an expert evaluator for AI agent outputs.

## Task Description
The agent was supposed to: {expected_behavior}

## Agent Output
{agent_output}

## Evaluation Criteria
{for each criterion}
- {criterion.name} (weight: {criterion.weight}): {criterion.description}
{end for}

## Instructions
Score each criterion from 0.0 to 1.0.
Provide specific feedback for improvement.

Respond in JSON:
{
  "scores": {
    "criterion_name": 0.85,
    ...
  },
  "overall_score": 0.82,
  "feedback": "...",
  "suggestions": ["...", "..."]
}
```

### 2.2 Tests Standardisés (Publication Gate)

**Tâche 2.2.1**: Définir la structure des tests
```
data/tests/
├── standardized/
│   ├── sanity.tests.json
│   ├── safety.tests.json
│   ├── performance.tests.json
│   └── consistency.tests.json
└── specific/
    ├── code-reviewer.tests.json
    ├── test-generator.tests.json
    └── ...
```

**Tâche 2.2.2**: Format des tests standardisés
```json
// sanity.tests.json
{
  "name": "Sanity Tests",
  "description": "Basic functionality tests all agents must pass",
  "tests": [
    {
      "id": "responds-within-timeout",
      "type": "performance",
      "config": {
        "timeout_ms": 30000,
        "runs": 5
      },
      "pass_condition": "all_runs_complete"
    },
    {
      "id": "valid-json-output",
      "type": "format",
      "config": {
        "expected_format": "json",
        "runs": 5
      },
      "pass_condition": "all_valid"
    },
    {
      "id": "no-errors",
      "type": "stability",
      "config": {
        "runs": 10
      },
      "pass_condition": "error_rate < 0.1"
    }
  ]
}
```

**Tâche 2.2.3**: Format des tests spécifiques
```json
// code-reviewer.tests.json
{
  "name": "Code Reviewer Specific Tests",
  "agent_type": "code-reviewer",
  "tests": [
    {
      "id": "detects-obvious-bug",
      "input": {
        "code": "function divide(a, b) { return a / b; }"
      },
      "expected": {
        "must_mention": ["division by zero", "error handling"],
        "evaluation": "llm"  // Évalué par LLM
      }
    },
    {
      "id": "no-false-positives",
      "input": {
        "code": "function add(a: number, b: number): number { return a + b; }"
      },
      "expected": {
        "severity": "low_or_none",  // Pas de critique majeure
        "evaluation": "llm"
      }
    },
    {
      "id": "handles-complex-code",
      "input": {
        "code": "... (extrait de vrai code) ..."
      },
      "expected": {
        "actionable_feedback": true,
        "evaluation": "llm"
      }
    }
  ]
}
```

### 2.3 Service de Test Runner

**Tâche 2.3.1**: Créer le test runner
```csharp
public interface IAgentTestRunner
{
    // Run tous les tests standardisés
    Task<StandardizedTestResult> RunStandardizedTestsAsync(
        string agentId,
        CancellationToken ct = default);

    // Run les tests spécifiques à un type d'agent
    Task<SpecificTestResult> RunSpecificTestsAsync(
        string agentId,
        string testSetId,
        CancellationToken ct = default);

    // Run tous les tests pour publication
    Task<PublicationTestResult> RunPublicationTestsAsync(
        string agentId,
        CancellationToken ct = default);
}

public class PublicationTestResult
{
    public bool Passed { get; set; }
    public StandardizedTestResult StandardizedTests { get; set; }
    public SpecificTestResult SpecificTests { get; set; }
    public List<string> FailureReasons { get; set; }
    public string Recommendation { get; set; }  // "ready" | "needs_work" | "failed"
}
```

### 2.4 CLI pour les Tests

**Tâche 2.4.1**: Ajouter commandes CLI
```bash
# Tester un agent
maestro test agent code-reviewer

# Output:
# Running standardized tests...
#   ✓ Sanity: 5/5 passed
#   ✓ Safety: 4/4 passed
#   ✓ Performance: 3/3 passed
#   ✓ Consistency: 2/2 passed
#
# Running specific tests (code-reviewer)...
#   ✓ detects-obvious-bug: score 0.92
#   ✓ no-false-positives: score 0.88
#   ✓ handles-complex-code: score 0.85
#   Average: 0.88
#
# RESULT: PASSED (ready for publication)

# Tester avant publication
maestro foundry publish-check code-reviewer
```

### Livrables Phase 2
- [ ] EvaluationService fonctionnel
- [ ] Prompt template pour évaluateur LLM
- [ ] Tests standardisés définis (sanity, safety, performance, consistency)
- [ ] Tests spécifiques pour au moins 3 types d'agents
- [ ] AgentTestRunner implémenté
- [ ] CLI commands pour tester

---

## PHASE 3: Agents Fondamentaux (Semaine 5-8)

### Objectif
Créer manuellement les agents "bootstrap" qui permettront ensuite à Foundry d'être semi-autonome.

### 3.1 Liste des Agents Fondamentaux

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AGENTS FONDAMENTAUX À CRÉER                              │
│                                                                              │
│  Priorité 1 (Semaine 5-6): Core                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. output-evaluator      Évalue la qualité des outputs              │   │
│  │ 2. prompt-improver       Améliore les prompts basé sur feedback     │   │
│  │ 3. test-case-generator   Génère des cas de test                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Priorité 2 (Semaine 7): Creation                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 4. agent-architect       Conçoit l'architecture d'un agent          │   │
│  │ 5. agent-creator         Crée les fichiers block JSON               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Priorité 3 (Semaine 8): Support                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 6. doc-writer            Documente les agents                       │   │
│  │ 7. experiment-analyzer   Analyse les résultats d'expériences        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Agent 1: output-evaluator

**Fichier**: `blocks/agents/output-evaluator.agent.block.json`

```json
{
  "id": "output-evaluator",
  "name": "Output Evaluator",
  "blockType": "agent",
  "version": "0.1.0",
  "description": "Evaluates the quality of agent outputs against expected behavior",

  "inputs": [
    {
      "id": "agent_output",
      "type": "string",
      "required": true,
      "description": "The output produced by the agent being evaluated"
    },
    {
      "id": "expected_behavior",
      "type": "string",
      "required": true,
      "description": "Description of what the agent should have done"
    },
    {
      "id": "criteria",
      "type": "object",
      "required": false,
      "default": {
        "correctness": 0.4,
        "quality": 0.3,
        "completeness": 0.2,
        "format": 0.1
      }
    }
  ],

  "outputs": [
    {
      "id": "score",
      "type": "number",
      "description": "Overall score 0.0 - 1.0"
    },
    {
      "id": "criteria_scores",
      "type": "object",
      "description": "Individual criterion scores"
    },
    {
      "id": "feedback",
      "type": "string",
      "description": "Detailed feedback for improvement"
    },
    {
      "id": "passed",
      "type": "boolean",
      "description": "Whether the output meets the threshold"
    }
  ],

  "config": {
    "model": "claude-3-sonnet",
    "temperature": 0.3,
    "systemPrompt": "You are an expert evaluator... [voir prompt détaillé ci-dessus]"
  }
}
```

**Processus de création**:
1. [ ] Écrire le prompt initial
2. [ ] Tester sur 10 exemples manuels
3. [ ] Itérer sur le prompt basé sur les résultats
4. [ ] Créer 20 cas de test (held-out)
5. [ ] Valider score > 85%
6. [ ] Publier v0.1.0

### 3.3 Agent 2: prompt-improver

**Fichier**: `blocks/agents/prompt-improver.agent.block.json`

```json
{
  "id": "prompt-improver",
  "name": "Prompt Improver",
  "blockType": "agent",
  "version": "0.1.0",
  "description": "Improves agent prompts based on evaluation feedback",

  "inputs": [
    {
      "id": "current_prompt",
      "type": "string",
      "required": true
    },
    {
      "id": "evaluation_feedback",
      "type": "string",
      "required": true,
      "description": "Feedback from output-evaluator"
    },
    {
      "id": "failure_examples",
      "type": "array",
      "required": false,
      "description": "Examples where the agent failed"
    }
  ],

  "outputs": [
    {
      "id": "improved_prompt",
      "type": "string"
    },
    {
      "id": "changes_made",
      "type": "array",
      "description": "List of changes and rationale"
    },
    {
      "id": "expected_improvement",
      "type": "string",
      "description": "Predicted impact of changes"
    }
  ],

  "config": {
    "model": "claude-3-opus",
    "temperature": 0.5,
    "systemPrompt": "You are an expert at improving AI prompts..."
  }
}
```

### 3.4 Agent 3: test-case-generator

```json
{
  "id": "test-case-generator",
  "name": "Test Case Generator",
  "blockType": "agent",
  "version": "0.1.0",
  "description": "Generates test cases for agent evaluation",

  "inputs": [
    {
      "id": "agent_description",
      "type": "string",
      "required": true,
      "description": "What the agent is supposed to do"
    },
    {
      "id": "input_schema",
      "type": "object",
      "required": true,
      "description": "Schema of agent inputs"
    },
    {
      "id": "num_cases",
      "type": "number",
      "default": 20
    },
    {
      "id": "difficulty_distribution",
      "type": "object",
      "default": { "easy": 0.3, "medium": 0.4, "hard": 0.2, "edge": 0.1 }
    }
  ],

  "outputs": [
    {
      "id": "test_cases",
      "type": "array",
      "description": "Generated test cases with inputs and expected behavior"
    }
  ],

  "config": {
    "model": "claude-3-opus",
    "temperature": 0.7
  }
}
```

### 3.5 Processus de Bootstrap pour Chaque Agent

```
Pour chaque agent fondamental:

1. DRAFT (vous + moi)
   ├── Écrire le prompt initial
   ├── Définir inputs/outputs
   └── Créer le fichier block.json

2. TEST MANUEL (moi)
   ├── Exécuter 10-20 fois avec inputs variés
   ├── Noter les problèmes
   └── Collecter exemples de succès/échecs

3. ITÉRATION (vous + moi)
   ├── Analyser les résultats
   ├── Améliorer le prompt
   └── Re-tester

4. VALIDATION (système)
   ├── Créer 20+ cas de test
   ├── Run tests automatisés
   └── Vérifier score > 85%

5. PUBLICATION
   ├── maestro test agent {id}
   ├── maestro foundry publish {id} --version 0.1.0
   └── Documenter
```

### Livrables Phase 3
- [ ] output-evaluator v0.1.0 publié
- [ ] prompt-improver v0.1.0 publié
- [ ] test-case-generator v0.1.0 publié
- [ ] agent-architect v0.1.0 publié
- [ ] agent-creator v0.1.0 publié
- [ ] doc-writer v0.1.0 publié
- [ ] experiment-analyzer v0.1.0 publié
- [ ] Tests pour chaque agent

---

## PHASE 4: Foundry Workflow Semi-Autonome (Semaine 9-12)

### Objectif
Assembler les agents fondamentaux en un workflow Foundry qui peut:
- Créer des variantes d'agents
- Les entraîner (N itérations)
- Les évaluer
- Suggérer des améliorations
- Demander la publication quand seuil atteint

### 4.1 Architecture du Foundry Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FOUNDRY RESEARCH WORKFLOW                                │
│                                                                              │
│  Input: { goal: "Créer un agent de code review performant" }                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: DESIGN                                                      │   │
│  │  Agent: agent-architect                                              │   │
│  │  Action: Concevoir l'architecture de l'agent                         │   │
│  │  Output: { architecture, prompt_draft, tools_needed }               │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: CREATE                                                      │   │
│  │  Agent: agent-creator                                                │   │
│  │  Action: Créer le fichier block.json                                │   │
│  │  Output: { block_definition }                                        │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: GENERATE TESTS                                              │   │
│  │  Agent: test-case-generator                                          │   │
│  │  Action: Créer les cas de test                                       │   │
│  │  Output: { test_cases }                                              │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║  STEP 4: TRAINING LOOP                                               ║   │
│  ║                                                                      ║   │
│  ║  for iteration in 1..N:                                              ║   │
│  ║    ┌─────────────────────────────────────────────────────────────┐  ║   │
│  ║    │  4a. EXECUTE                                                 │  ║   │
│  ║    │  Run agent on test cases                                     │  ║   │
│  ║    └──────────────────────────────┬──────────────────────────────┘  ║   │
│  ║                                   │                                  ║   │
│  ║                                   ▼                                  ║   │
│  ║    ┌─────────────────────────────────────────────────────────────┐  ║   │
│  ║    │  4b. EVALUATE                                                │  ║   │
│  ║    │  Agent: output-evaluator                                     │  ║   │
│  ║    │  Score each output                                           │  ║   │
│  ║    └──────────────────────────────┬──────────────────────────────┘  ║   │
│  ║                                   │                                  ║   │
│  ║                                   ▼                                  ║   │
│  ║    ┌─────────────────────────────────────────────────────────────┐  ║   │
│  ║    │  4c. ANALYZE                                                 │  ║   │
│  ║    │  Agent: experiment-analyzer                                  │  ║   │
│  ║    │  Identify patterns, weaknesses                               │  ║   │
│  ║    └──────────────────────────────┬──────────────────────────────┘  ║   │
│  ║                                   │                                  ║   │
│  ║                                   ▼                                  ║   │
│  ║    ┌─────────────────────────────────────────────────────────────┐  ║   │
│  ║    │  4d. IMPROVE                                                 │  ║   │
│  ║    │  Agent: prompt-improver                                      │  ║   │
│  ║    │  Generate improved version                                   │  ║   │
│  ║    └──────────────────────────────┬──────────────────────────────┘  ║   │
│  ║                                   │                                  ║   │
│  ║                                   ▼                                  ║   │
│  ║    ┌─────────────────────────────────────────────────────────────┐  ║   │
│  ║    │  4e. CHECK THRESHOLD                                         │  ║   │
│  ║    │  if score >= threshold:                                      │  ║   │
│  ║    │    → exit loop, go to PUBLICATION                           │  ║   │
│  ║    │  else:                                                       │  ║   │
│  ║    │    → continue loop with improved version                    │  ║   │
│  ║    └─────────────────────────────────────────────────────────────┘  ║   │
│  ║                                                                      ║   │
│  ╚══════════════════════════════════════════════════════════════════════╝   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 5: PUBLICATION CHECK                                           │   │
│  │  Run standardized + specific tests                                   │   │
│  │  if passed:                                                          │   │
│  │    → Request publication approval                                    │   │
│  │  else:                                                               │   │
│  │    → Return to training loop with feedback                          │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 6: DOCUMENT                                                    │   │
│  │  Agent: doc-writer                                                   │   │
│  │  Generate documentation for the new agent                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Créer le Workflow Block

**Fichier**: `blocks/workflows/foundry-research.workflow.block.json`

```json
{
  "id": "foundry-research",
  "name": "Foundry Research Workflow",
  "blockType": "workflow",
  "version": "0.1.0",
  "description": "Autonomous workflow for creating and training new agents",

  "inputs": [
    {
      "id": "goal",
      "type": "string",
      "required": true,
      "description": "What kind of agent to create"
    },
    {
      "id": "training_config",
      "type": "object",
      "default": {
        "max_iterations": 50,
        "target_score": 0.85,
        "evaluator_model": "claude-3-sonnet"
      }
    }
  ],

  "nodes": [
    {
      "id": "design",
      "blockRef": "agents/agent-architect",
      "inputs": { "goal": "{{workflow.inputs.goal}}" }
    },
    {
      "id": "create",
      "blockRef": "agents/agent-creator",
      "inputs": { "architecture": "{{nodes.design.outputs.architecture}}" }
    },
    {
      "id": "generate-tests",
      "blockRef": "agents/test-case-generator",
      "inputs": {
        "agent_description": "{{workflow.inputs.goal}}",
        "input_schema": "{{nodes.create.outputs.input_schema}}"
      }
    },
    {
      "id": "training-loop",
      "type": "loop",
      "config": {
        "max_iterations": "{{workflow.inputs.training_config.max_iterations}}",
        "exit_condition": "{{nodes.evaluate.outputs.score}} >= {{workflow.inputs.training_config.target_score}}"
      },
      "nodes": [
        {
          "id": "execute",
          "blockRef": "system/execute-agent",
          "inputs": {
            "agent": "{{nodes.create.outputs.agent}}",
            "test_cases": "{{nodes.generate-tests.outputs.test_cases}}"
          }
        },
        {
          "id": "evaluate",
          "blockRef": "agents/output-evaluator",
          "inputs": {
            "outputs": "{{nodes.execute.outputs.results}}",
            "expected": "{{nodes.generate-tests.outputs.expected_behaviors}}"
          }
        },
        {
          "id": "analyze",
          "blockRef": "agents/experiment-analyzer",
          "inputs": { "results": "{{nodes.evaluate.outputs}}" }
        },
        {
          "id": "improve",
          "blockRef": "agents/prompt-improver",
          "inputs": {
            "current_prompt": "{{nodes.create.outputs.prompt}}",
            "feedback": "{{nodes.analyze.outputs.suggestions}}"
          }
        }
      ]
    },
    {
      "id": "publication-tests",
      "blockRef": "system/run-publication-tests",
      "inputs": { "agent": "{{nodes.create.outputs.agent}}" }
    },
    {
      "id": "document",
      "blockRef": "agents/doc-writer",
      "inputs": { "agent": "{{nodes.create.outputs.agent}}" }
    }
  ],

  "connections": [
    { "from": "design", "to": "create" },
    { "from": "create", "to": "generate-tests" },
    { "from": "generate-tests", "to": "training-loop" },
    { "from": "training-loop", "to": "publication-tests" },
    { "from": "publication-tests", "to": "document", "condition": "passed" }
  ]
}
```

### 4.3 CLI pour Foundry

```bash
# Créer un workspace de recherche
maestro foundry create \
  --name "Code Review Agent Research" \
  --goal "Create a high-performance code reviewer that catches bugs and suggests improvements" \
  --target-score 0.85 \
  --max-iterations 50

# Output:
# Created Foundry Workspace: fw-abc123
# Goal: Create a high-performance code reviewer...
# Target: 0.85
# Max iterations: 50

# Lancer le workflow
maestro foundry start fw-abc123

# Output:
# Starting Foundry Research Workflow...
# [Step 1/6] Designing agent architecture...
# [Step 2/6] Creating agent definition...
# [Step 3/6] Generating test cases...
# [Step 4/6] Training loop started...
#   Iteration 1: score 0.45
#   Iteration 2: score 0.52
#   ...
# (continues in background)

# Voir le statut
maestro foundry status fw-abc123

# Voir les logs en temps réel
maestro foundry logs fw-abc123 --follow
```

### Livrables Phase 4
- [ ] foundry-research.workflow.block.json créé
- [ ] System blocks pour exécution (execute-agent, run-publication-tests)
- [ ] CLI commands (foundry create, start, status, logs)
- [ ] Storage pour workspaces et runs
- [ ] Premier test end-to-end du workflow

---

## PHASE 5: Auto-Amélioration (Semaine 13+)

### Objectif
Le système peut améliorer ses propres agents fondamentaux.

### 5.1 Feedback Loop

```
Production (Project Sessions)
         │
         │ Métriques collectées:
         │ - Taux de succès
         │ - Temps d'exécution
         │ - Satisfaction utilisateur
         │
         ▼
┌─────────────────────┐
│ Metrics Aggregator  │
└──────────┬──────────┘
           │
           │ Identifie les agents sous-performants
           │
           ▼
┌─────────────────────┐
│ Improvement Queue   │
│                     │
│ "output-evaluator   │
│  a un taux d'accord │
│  de 72% avec les    │
│  humains. Target:   │
│  85%"               │
└──────────┬──────────┘
           │
           ▼
     Foundry Workflow
     (améliore l'agent)
```

### 5.2 Self-Improvement Workflow

```json
{
  "id": "self-improvement",
  "name": "Self Improvement Workflow",
  "blockType": "workflow",

  "triggers": [
    {
      "type": "schedule",
      "cron": "0 0 * * 0"  // Chaque dimanche
    },
    {
      "type": "threshold",
      "condition": "agent.production_score < 0.80"
    }
  ],

  "nodes": [
    {
      "id": "identify-weak",
      "blockRef": "system/identify-weak-agents",
      "inputs": { "threshold": 0.80 }
    },
    {
      "id": "prioritize",
      "blockRef": "agents/experiment-analyzer",
      "inputs": { "agents": "{{nodes.identify-weak.outputs}}" }
    },
    {
      "id": "improve",
      "type": "foreach",
      "items": "{{nodes.prioritize.outputs.top_3}}",
      "workflow": "foundry-research",
      "inputs": {
        "goal": "Improve {{item.id}} to score above 0.85",
        "base_agent": "{{item}}"
      }
    }
  ]
}
```

### Livrables Phase 5
- [ ] Metrics collection en production
- [ ] Improvement queue
- [ ] Self-improvement workflow
- [ ] Dashboard de santé des agents
- [ ] Alerting quand un agent se dégrade

---

## Résumé du Plan

| Phase | Durée | Focus | Livrable Principal |
|-------|-------|-------|-------------------|
| **1** | 2 sem | Infrastructure | Modèles puissants + économiques disponibles |
| **2** | 2 sem | Évaluation | Système de tests fonctionnel |
| **3** | 4 sem | Bootstrap | 7 agents fondamentaux publiés |
| **4** | 4 sem | Foundry | Workflow semi-autonome |
| **5** | Ongoing | Auto-amélioration | Système qui s'améliore seul |

---

## Prochaine Action Immédiate

**Commencer Phase 1.1**: Audit du LLM-Provider actuel

```bash
# À faire maintenant:
1. Examiner llm-provider/
2. Lister les modèles configurés
3. Identifier ce qu'il faut ajouter
```

Voulez-vous que je commence cet audit?
