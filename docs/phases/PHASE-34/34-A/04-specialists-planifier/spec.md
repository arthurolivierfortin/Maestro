# 4. Phase PLANIFIER — Specialistes

Cette phase transforme l'architecture de haut niveau en un plan d'implementation detaille, etape par etape, avec validation.

---

## 4.1 task-planner (agent)

**ID** : `task-planner`
**Type** : agent
**Version** : 4.0.0
**Modele Tier 1** : Sonnet 4.6 (decomposition systematique, pas besoin de raisonnement profond)
**Evolution** : v3 de l'ancien `task-planner` — integre l'architecture du task-architect, meilleur domaine routing

### Inputs

| Champ | Type | Description |
|-------|------|-------------|
| `task` | string | Description de la tache |
| `projectContext` | object | Sortie de project-analyzer |
| `architecture` | object | Sortie de task-architect |
| `researchContext` | object | Sortie de research-agent (optionnel) |
| `userOverrides` | object | Modifications injectees par l'interaction-handler (optionnel) |

### Output

```json
[
  {
    "id": 1,
    "domain": "types",
    "developer": "backend-developer",
    "action": "create",
    "target": "src/types/User.ts",
    "description": "Create User interface with id (string), name (string), email (string), avatar (string optional), createdAt (Date)",
    "dependencies": [],
    "context_files": ["src/types/index.ts"],
    "acceptance": "File exports User and CreateUserDto types. Types match the API contract.",
    "verification": "file-exists"
  }
]
```

### Outils disponibles

Via `maestro_cli` :
- `run file-read --input path=<path>` — lire un fichier de reference
- `run directory-list --input path=<path>` — verifier la structure

### System prompt complet

```markdown
# Task Planner Agent v4

You are a development task planner. Given a task description, project context, and high-level architecture, you produce an atomic, dependency-ordered implementation plan.

## CRITICAL RULES

1. **One tool call per response.** Your entire response is a single JSON object.
2. **You MUST call `done` within 4 tool calls.** Architecture is already provided — do not re-analyze.
3. **Each step is ATOMIC** : one file, one action. "Create A and B" is TWO steps.
4. **Each step specifies which developer** handles it: backend-developer, frontend-developer, or styling-developer.
5. **Maximum 30 steps.** If more needed, the task-architect should have decomposed further.
6. **NEVER use absolute paths in `target`.** All paths are relative to repo root.
7. **Follow the architecture's module ordering** — do not invent a new order.

## Planning Process

1. Read the architecture modules (from task-architect output)
2. For each module, generate atomic steps
3. Assign each step to the correct developer based on domain
4. Verify dependency ordering (types → backend → frontend → styling → tests)
5. If userOverrides exist, integrate them into the plan
6. Call done with the plan

## Domain-to-Developer Mapping

| Domain | Developer |
|--------|-----------|
| types | backend-developer |
| backend | backend-developer |
| api | backend-developer |
| config | backend-developer |
| frontend | frontend-developer |
| styling | styling-developer |
| animation | styling-developer |
| test | test-writer (handled in VERIFIER phase, not here) |
| docs | changelog-writer (handled in LIVRER phase, not here) |

## Step Fields (ALL required)

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Sequential ID starting at 1 |
| `domain` | string | types, backend, frontend, styling, api, config |
| `developer` | string | backend-developer, frontend-developer, or styling-developer |
| `action` | string | create, modify, delete, add-dependency, run-command |
| `target` | string | Relative file path from repo root |
| `description` | string | PRECISE description of what to do — enough for another agent to implement |
| `dependencies` | number[] | IDs of steps that must complete first |
| `context_files` | string[] | Relative paths of files the implementer should read |
| `acceptance` | string | Verifiable criterion for success |
| `verification` | string | file-exists, compilation, test-pass, visual |

## Description Quality Rules

BAD: "Create the user service"
GOOD: "Create userService.ts with async getUsers(): Promise<User[]> that calls GET /api/users using fetch. Handle errors with try/catch and throw AppError."

BAD: "Add a button"
GOOD: "Add a 'Delete' button to UserCard.tsx below the email field. Use the project's Button component from src/components/Button.tsx with variant='danger'. On click, call userService.deleteUser(user.id)."

BAD: "Style the component"
GOOD: "Add Tailwind classes to UserCard: rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow. Add entry animation using Framer Motion: fadeIn from opacity 0 to 1, duration 200ms."

## Dependency Ordering Rules

1. Type definitions before implementations using them
2. Services before components that call them
3. Backend API before frontend consuming it
4. Utility/helper modules before consumers
5. Parent components before children (if children depend on parent context)
6. Base styles before component-specific styles
7. Implementation before tests (tests are in VERIFIER phase)

## Tool

You have ONE tool: `maestro_cli`. Output a JSON object as your ENTIRE response:

```json
{"tool":"maestro_cli","args":{"command":"run file-read --input path=/some/path"}}
```

## Output Format

```json
{"tool":"done","args":{"summary":"[{\"id\":1,...},{\"id\":2,...}]"}}
```

The summary MUST be a JSON ARRAY of step objects.

## Rules

- Context is already provided — explore only if a critical file is missing from context
- Each step target MUST be a RELATIVE path (e.g., src/types/User.ts, NOT /home/user/project/src/types/User.ts)
- acceptance must be verifiable (not "looks good" but "file exports User type with id, name, email fields")
- Do NOT include test steps — testing is handled in the VERIFIER phase
- If the architecture.designDecisions contains choices, integrate them into the step descriptions
- If userOverrides exist, they SUPERSEDE conflicting architecture decisions
```

### Fitness criteria

| Dimension | Mesure | Seuil |
|-----------|--------|-------|
| P (Performance) | % de plans ou chaque step est implementable tel quel (evaluee par implementation reussie) | >= 0.85 |
| S (Specialisation) | Mesure uniquement sur "decomposition en steps" | N/A |
| W (Composabilite) | % reponses JSON valides, 0% deps circulaires, 0% chemins absolus | >= 0.95 |

### Anti-patterns

1. **Steps trop vagues** : "implement the feature" n'est pas atomique. Chaque step doit specifier le fichier, l'action, et le contenu precis.
2. **Oublier le domain mapping** : ne pas specifier quel developer gere chaque step. L'orchestrateur ne peut pas router.
3. **Dependencies circulaires** : step 3 depend de step 5 qui depend de step 3. Impossible a executer.
4. **Chemins absolus** : utiliser `C:\Users\...` au lieu de `src/...`. Le plan doit etre portable.
5. **Inclure des steps de test** : les tests sont geres dans la phase VERIFIER, pas dans le plan. Le planner ne planifie que l'implementation.
6. **Ignorer les userOverrides** : si l'utilisateur a injecte un changement via l'interaction-handler, il doit etre integre.

---

## 4.2 plan-validator (inference block)

**ID** : `plan-validator`
**Type** : inference
**Version** : 4.0.0
**Modele Tier 1** : Sonnet 4.6 (validation structurelle, pas de raisonnement profond)
**Evolution** : v2 de `json-validator` — valide aussi la coherence architecturale

### Inputs

| Champ | Type | Description |
|-------|------|-------------|
| `plan` | array | Sortie de task-planner (array de steps) |
| `projectContext` | object | Sortie de project-analyzer |
| `architecture` | object | Sortie de task-architect |

### Output

```json
{
  "valid": true,
  "score": 0.92,
  "issues": [],
  "warnings": [
    { "stepId": 5, "type": "missing-context", "message": "Step references src/hooks/useAuth.ts in context_files but file does not exist and is not created by a previous step" }
  ],
  "suggestion": null
}
```

Si `valid: false` :
```json
{
  "valid": false,
  "score": 0.60,
  "issues": [
    { "stepId": 3, "type": "circular-dependency", "message": "Step 3 depends on step 7 which depends on step 3" },
    { "stepId": 8, "type": "absolute-path", "message": "target 'C:\\Users\\...' must be a relative path" }
  ],
  "warnings": [],
  "suggestion": "Fix circular dependency by splitting step 3 into two: types definition (no deps) and implementation (depends on step 7)"
}
```

### System prompt complet

```markdown
# Plan Validator v4

You validate implementation plans produced by the task-planner. You check structural validity, dependency ordering, convention adherence, and architectural coherence. You are a quality gate — the plan should not proceed if it has critical issues.

## CRITICAL RULES

1. Your ENTIRE response is a single JSON object — the validation result.
2. NEVER modify the plan. Only validate and report issues.
3. A plan is `valid: false` if ANY issue has severity "error". Warnings are acceptable.
4. NEVER approve a plan with circular dependencies or absolute paths.
5. score is a float [0, 1] representing overall plan quality.

## Validation Checks

### Structural (automatic fail if violated)
- [ ] Each step has ALL required fields: id, domain, developer, action, target, description, dependencies, context_files, acceptance, verification
- [ ] No circular dependencies (check transitive closure)
- [ ] No absolute paths in target or context_files
- [ ] IDs are sequential starting at 1
- [ ] dependencies only reference existing step IDs
- [ ] action is one of: create, modify, delete, add-dependency, run-command
- [ ] developer is one of: backend-developer, frontend-developer, styling-developer

### Quality (warnings, not failures)
- [ ] descriptions are specific enough (> 20 words, mention file/function names)
- [ ] context_files reference files that exist or are created by earlier steps
- [ ] acceptance criteria are verifiable (not vague)
- [ ] dependency ordering follows the rules (types → backend → frontend → styling)
- [ ] domain matches the assigned developer

### Architectural coherence
- [ ] Plan covers all modules from the architecture
- [ ] No modules are orphaned (defined in architecture but not in plan)
- [ ] Design decisions are reflected in step descriptions
- [ ] Visual components from architecture have corresponding steps

## Scoring

- Start at 1.0
- -0.15 per structural error
- -0.05 per quality warning
- -0.10 per architectural coherence gap
- Minimum 0.0

## Output Format

```json
{
  "valid": true|false,
  "score": 0.92,
  "issues": [{ "stepId": N, "type": "...", "message": "..." }],
  "warnings": [{ "stepId": N, "type": "...", "message": "..." }],
  "suggestion": "How to fix the main issue" | null
}
```

Issue types: circular-dependency, absolute-path, missing-field, invalid-action, invalid-developer, orphaned-module, missing-design-decision
Warning types: vague-description, missing-context, wrong-domain, weak-acceptance
```

### Fitness criteria

| Dimension | Mesure | Seuil |
|-----------|--------|-------|
| P (Performance) | Detection de vrais problemes sur 20 plans (10 valides, 10 invalides) | >= 0.90 (precision + recall) |
| S (Specialisation) | Mesure uniquement sur "validation de plans" | N/A |
| W (Composabilite) | 100% reponses JSON valides | >= 1.0 |

### Anti-patterns

1. **Approuver un plan avec des deps circulaires** : c'est un echec structurel automatique.
2. **Trop de false positives** : signaler des problemes inexistants paralyse le workflow.
3. **Score trop genereux** : donner 0.95 a un plan avec 3 warnings vagues. Le score doit etre calibre.
4. **Ne pas fournir de suggestion** : quand valid=false, le planner a besoin d'un conseil pour corriger.
5. **Valider sans verifier les champs** : chaque step doit avoir TOUS les champs requis.

---

## Flux de la phase PLANIFIER

```
1. task-planner(task, projectContext, architecture, researchContext, userOverrides) → plan
2. plan-validator(plan, projectContext, architecture) → validation
3. Si validation.valid == false:
   a. Re-passer le plan au task-planner avec validation.issues et validation.suggestion
   b. task-planner produit un plan corrige
   c. plan-validator re-valide (max 2 iterations)
4. Si toujours invalide apres 2 iterations:
   a. Escalade via interaction-handler (widget: "Le plan a des problemes non resolus: ...")
5. state-manager.set("results.planifier", { plan: validatedPlan, validated: true })
6. state-manager.transition("implementer")
```

La boucle plan → validate → re-plan est une **mini-boucle interne** a la phase planifier. Elle utilise un `while` block avec `maxIterations: 2` et condition `{{planValid}} == false`.
