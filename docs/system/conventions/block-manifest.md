# Block Manifest Convention

**Date**: February 10, 2026
**Phase**: 14

---

## Purpose

The Block Manifest (`manifest.json`) is a standardized metadata file that accompanies every published block. It describes what the block does, what it requires to run, how well it performs, and where its documentation lives.

The manifest serves three audiences:
- **Humans**: Browse the catalogue, evaluate requirements, compare blocks
- **Agents**: Programmatically discover blocks, check compatibility, select by fitness
- **Infrastructure**: Index published blocks, enforce quality gates at publish time

The manifest is a **separate file** (`manifest.json`) that lives alongside the block's `definition.json`. It is generated at publish time, not during development. It contains runtime data (fitness scores, test dates) that does not belong in the static block definition.

```
content/user/blocks/gen-commit/
  definition.json      <-- Block definition (design-time)
  manifest.json        <-- Block manifest (publish-time)
  script.ps1
  docs/
    README.md
    CHANGELOG.md
```

---

## Schema

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema` | string | Yes | Schema identifier. Always `"maestro-block-manifest/1.0"` |
| `id` | string | Yes | Block ID including namespace (`user:gen-commit`, `system:shell`) |
| `version` | string | Yes | Semver version (`"1.0.0"`, `"2.1.3"`) |
| `type` | string | Yes | Block type: `tool`, `agent`, `workflow`, `validator`, `inference`, etc. |
| `author` | object | Yes | Author information (see below) |
| `description` | string | Yes | Human-readable description of what the block does |
| `tags` | string[] | Yes | Searchable tags for catalogue discovery |
| `fitness` | object | Yes | Multi-level fitness scores (see below) |
| `requirements` | object | Yes | Hardware, OS, and dependency requirements (see below) |
| `metrics` | object | No | Additional performance metrics beyond fitness |
| `documentation` | object | No | Paths to documentation files relative to block directory |

### `author`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Author name or handle |
| `type` | string | Yes | `"human"` or `"agent"` |

### `fitness`

Fitness has three levels. Each level is nullable -- a block populates only the levels relevant to its type. See `docs/system/conventions/fitness-levels.md` for full specification.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `block` | object or null | Yes | Level 1: Block Fitness for atomic blocks |
| `task` | object or null | Yes | Level 2: Task Fitness for agents/workflows |
| `value` | object or null | Yes | Level 3: Value Fitness for baseline comparison |

#### `fitness.block` (when not null)

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Overall fitness score [0-1] |
| `formula` | string | Formula used, e.g. `"maestro-v2"` |
| `components` | object | Breakdown: `{ performance, specialization, composability, economicCost, computeCost, hardwareCost, lambda }` |
| `testedAt` | string | ISO date of last test |
| `sessionId` | string | Session that produced this score |

#### `fitness.task` (when not null)

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Weighted aggregate score [0-1] |
| `dimensions` | object | `{ completion, quality, costEfficiency, reliability, resilience }` each [0-1] |
| `weights` | object | Weights used: `{ completion, quality, costEfficiency, reliability, resilience }` |
| `benchmark` | string | Benchmark block ID used for evaluation |
| `runs` | number | Number of benchmark runs |
| `testedAt` | string | ISO date of last benchmark |

#### `fitness.value` (when not null)

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Value fitness score. > 1.0 means orchestration is worth the cost |
| `baseline` | string | Baseline model or approach compared against |
| `qualityDelta` | number | Quality improvement vs baseline |
| `costRatio` | number | Cost of agent / cost of baseline |
| `testedAt` | string | ISO date of comparison |

### `requirements`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hardware` | object | Yes | Hardware requirements |
| `os` | string[] | Yes | Supported operating systems: `["windows", "linux", "macos"]` |
| `dependencies` | object | Yes | Software and block dependencies |

#### `requirements.hardware`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vram` | string or null | Yes | Minimum VRAM (e.g. `"4GB"`, `null` if no GPU needed) |
| `ram` | string | Yes | Minimum RAM (e.g. `"8GB"`) |
| `gpu` | string | Yes | `"required"`, `"optional"`, or `"none"` |
| `disk` | string | No | Disk space needed (e.g. `"50MB"`) |

#### `requirements.dependencies`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `models` | object[] | No | Required LLM models. Each: `{ id, role, vram }` |
| `blocks` | string[] | No | Required block IDs (e.g. `["system:shell", "system:llm-generate"]`) |
| `runtime` | string | No | Runtime requirement (e.g. `"node >= 18"`) |

### `metrics`

Optional additional metrics beyond fitness. Structure is free-form but common fields include:

| Field | Type | Description |
|-------|------|-------------|
| `tokenEfficiency` | number | Tokens used relative to output quality [0-1] |
| `avgLatencyMs` | number | Average execution latency in milliseconds |
| `fitnessHistory` | number[] | Historical fitness scores across training iterations |

### `documentation`

Paths are relative to the block's directory.

| Field | Type | Description |
|-------|------|-------------|
| `readme` | string | Path to README (e.g. `"docs/README.md"`) |
| `changelog` | string | Path to changelog |
| `testReport` | string | Path to test report |

---

## Example: Atomic Tool

```json
{
  "schema": "maestro-block-manifest/1.0",
  "id": "user:gen-commit",
  "version": "1.0.0",
  "type": "tool",
  "author": {
    "name": "arthur",
    "type": "human"
  },
  "description": "Generates conventional commit messages from git diff using a small specialized LLM",
  "tags": ["git", "commit", "automation", "structured-output"],

  "fitness": {
    "block": {
      "score": 0.95,
      "formula": "maestro-v2",
      "components": {
        "performance": 0.96,
        "specialization": 0.98,
        "composability": 0.94,
        "economicCost": 0.12,
        "computeCost": 0.30,
        "hardwareCost": 0.25,
        "lambda": 1.5
      },
      "testedAt": "2026-02-10",
      "sessionId": "session-abc-123"
    },
    "task": null,
    "value": null
  },

  "requirements": {
    "hardware": {
      "vram": "4GB",
      "ram": "8GB",
      "gpu": "optional",
      "disk": "50MB"
    },
    "os": ["windows", "linux", "macos"],
    "dependencies": {
      "models": [
        {
          "id": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
          "role": "primary",
          "vram": "4GB"
        }
      ],
      "blocks": ["system:shell", "system:llm-generate"],
      "runtime": "node >= 18"
    }
  },

  "metrics": {
    "tokenEfficiency": 0.92,
    "avgLatencyMs": 2300,
    "fitnessHistory": [0.70, 0.85, 0.92, 0.95]
  },

  "documentation": {
    "readme": "docs/README.md",
    "changelog": "docs/CHANGELOG.md",
    "testReport": "docs/test-report.md"
  }
}
```

## Example: Composite Agent

```json
{
  "schema": "maestro-block-manifest/1.0",
  "id": "user:coding-agent-v1",
  "version": "1.0.0",
  "type": "agent",
  "author": {
    "name": "arthur",
    "type": "human"
  },
  "description": "Orchestrated coding agent using 10 specialized sub-agents for code generation, review, and testing",
  "tags": ["coding", "agent", "orchestration", "multi-model"],

  "fitness": {
    "block": null,
    "task": {
      "score": 0.78,
      "dimensions": {
        "completion": 0.82,
        "quality": 0.75,
        "costEfficiency": 0.70,
        "reliability": 0.85,
        "resilience": 0.60
      },
      "weights": {
        "completion": 0.35,
        "quality": 0.25,
        "costEfficiency": 0.20,
        "reliability": 0.10,
        "resilience": 0.10
      },
      "benchmark": "benchmark:coding-tasks-v1",
      "runs": 3,
      "testedAt": "2026-02-10"
    },
    "value": null
  },

  "requirements": {
    "hardware": {
      "vram": "8GB",
      "ram": "16GB",
      "gpu": "required",
      "disk": "200MB"
    },
    "os": ["windows", "linux"],
    "dependencies": {
      "models": [
        {
          "id": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
          "role": "orchestrator",
          "vram": "4GB"
        },
        {
          "id": "Qwen/Qwen2.5-Coder-1.5B-Instruct",
          "role": "code-generator",
          "vram": "4GB"
        },
        {
          "id": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
          "role": "reviewer",
          "vram": "4GB"
        }
      ],
      "blocks": [
        "system:shell",
        "system:llm-generate",
        "system:file-read",
        "system:file-write"
      ],
      "runtime": "node >= 18"
    }
  },

  "metrics": {
    "avgLatencyMs": 15000,
    "fitnessHistory": [0.45, 0.58, 0.70, 0.78]
  },

  "documentation": {
    "readme": "docs/README.md",
    "changelog": "docs/CHANGELOG.md",
    "testReport": "docs/benchmark-results.md"
  }
}
```

---

## Rules

1. Every published block MUST have a `manifest.json` alongside its `definition.json`
2. The manifest is generated at publish time by the publishing workflow, not written manually
3. Fitness scores in the manifest come from actual session results -- never fabricated
4. All three fitness levels MUST be present in the manifest object, set to `null` when not applicable
5. A block with `type: tool | validator | inference | prompt` populates `fitness.block`
6. A block with `type: agent | workflow` populates `fitness.task`
7. `fitness.value` is populated only when a baseline comparison has been performed
8. The `requirements` section MUST accurately reflect what the block needs to run -- this is what allows catalogue users to filter by "what runs on my machine"
9. The `schema` field enables future schema evolution without breaking existing manifests

---

*"The manifest is the block's resume. It tells the catalogue everything it needs to know."*
