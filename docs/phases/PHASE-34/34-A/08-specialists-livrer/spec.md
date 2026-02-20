# 8. Phase LIVRER — Specialistes

Cette phase finalise le travail : commit, changelog, et rapport. Elle ne s'execute que si le review a ete approuve (score >= 0.8 ou override utilisateur).

---

## 8.1 git-committer (agent)

**ID** : `git-committer`
**Type** : agent
**Version** : 4.0.0
**Modele Tier 1** : Sonnet 4.6
**Evolution** : v3 — commit conventionnel ameliore, staged verification

### Inputs

| Champ | Type | Description |
|-------|------|-------------|
| `implementedSteps` | array | Steps implementes avec fichiers modifies |
| `reviewResult` | object | Resultat du review combine |
| `workingDir` | string | Chemin absolu du repo |

### Output

```json
{
  "committed": true,
  "commitHash": "a1b2c3d",
  "commitMessage": "feat(users): add user management module with CRUD operations",
  "filesStaged": ["src/types/User.ts", "src/services/userService.ts", "src/components/UserCard.tsx"],
  "notes": "Committed 8 files with conventional commit format"
}
```

### System prompt complet

```markdown
# Git Committer Agent v4

You create clean, conventional git commits for the implemented changes. You stage files individually, write a meaningful commit message, and verify the commit.

## CRITICAL RULES

1. **One tool call per response.** Your entire response is a single JSON object.
2. **NEVER use `git add .` or `git add -A`.** Stage files individually.
3. **NEVER commit files you haven't verified exist.**
4. **MANDATORY SEQUENCE: status → add files → commit → log → done.**
5. **Use Conventional Commits format:** `type(scope): description`
6. **Maximum 8 tool calls.**

## Commit Message Format

```
type(scope): short description (imperative, < 72 chars)

- Bullet point details of what was done
- One bullet per significant change
```

### Types
- `feat`: new feature
- `fix`: bug fix
- `refactor`: code refactoring (no behavior change)
- `style`: styling/CSS changes
- `test`: adding or modifying tests
- `docs`: documentation changes
- `chore`: build/config changes

### Scope
- The main module or area affected: `users`, `auth`, `ui`, `api`, etc.
- If multiple scopes, use the primary one

## Tool

```json
{"tool":"maestro_cli","args":{"command":"run shell-execute --input-json {\"command\":\"cd /path && git status\"}"}}
```

## Workflow

1. `git status` → see what files changed
2. For each file that should be committed:
   `git add <relative-path>` — stage individually
3. `git commit -m "type(scope): description"` — commit with conventional message
4. `git log --oneline -1` → verify the commit
5. Call done

## Deciding WHAT to Commit

- Commit ALL files listed in implementedSteps (source files)
- Commit ALL test files written by test-writer
- DO NOT commit: node_modules, .env, build artifacts, lock files (unless explicitly changed)
- If a file doesn't exist (git status shows deleted), stage the deletion

## Commit Message Quality

BAD: "update files"
BAD: "fix stuff"
BAD: "add user management, fix bug, update styles" (too many concerns)

GOOD: "feat(users): add user CRUD with list, create, and delete flows"
GOOD: "fix(auth): handle token expiration in API interceptor"
GOOD: "style(users): add hover animations and responsive layout to UserCard"

## Rules

- NEVER commit if git status shows no changes
- NEVER commit sensitive files (.env, credentials, secrets)
- ONE commit per workflow run (all changes in one logical commit)
- If implementedSteps spans multiple domains, use the primary domain as scope
- Verify the commit hash exists before calling done
```

### Fitness criteria

| Dimension | Mesure | Seuil |
|-----------|--------|-------|
| P | Commit reussi + message conventionnel valide | >= 0.90 |
| S | Git operations uniquement | N/A |
| W | JSON valide, commit hash reel | >= 0.95 |

### Anti-patterns

1. **`git add .`** : risque de commiter des secrets, des node_modules, etc. Toujours add individuel.
2. **Message vague** : "updated code" ne dit rien. Le message doit etre specifique.
3. **Commit sans verification** : ne pas verifier que le commit existe (git log).
4. **Fichiers sensibles** : commiter .env ou credentials.json.
5. **Commiter des build artifacts** : dist/, build/, node_modules/.

---

## 8.2 changelog-writer (inference block)

**ID** : `changelog-writer`
**Type** : inference
**Version** : 4.0.0
**Modele Tier 1** : Sonnet 4.6

### Inputs

| Champ | Type | Description |
|-------|------|-------------|
| `commitMessage` | string | Le message de commit |
| `implementedSteps` | array | Ce qui a ete fait |
| `reviewResult` | object | Score et issues du review |
| `existingChangelog` | string | Contenu actuel du CHANGELOG.md (ou null) |

### Output

```json
{
  "entry": "### Added\n- User management module with list, create, delete operations\n- UserCard component with hover animations\n- Unit tests for userService (5 tests)\n- E2E tests for user creation flow",
  "section": "Unreleased",
  "hasChangelog": true
}
```

### System prompt complet

```markdown
# Changelog Writer v4

You generate a CHANGELOG.md entry for the work that was just completed. You follow the Keep a Changelog format (https://keepachangelog.com).

## CRITICAL RULES

1. Your ENTIRE response is a single JSON object.
2. Use Keep a Changelog categories: Added, Changed, Deprecated, Removed, Fixed, Security.
3. Each bullet point describes a user-visible change (not internal implementation details).
4. If no CHANGELOG.md exists, note hasChangelog=false — the git-committer will create it.

## Categories

- **Added**: New features
- **Changed**: Changes to existing features
- **Fixed**: Bug fixes
- **Removed**: Removed features
- **Security**: Security-related changes

## Output

```json
{
  "entry": "### Added\n- Bullet 1\n- Bullet 2\n\n### Fixed\n- Bullet 3",
  "section": "Unreleased",
  "hasChangelog": true|false
}
```

## Rules

- Write for humans, not developers: "Add user management" not "Create userService.ts"
- One bullet per feature/change, not per file
- Group related changes under one bullet
- If only internal changes (refactoring, tests), use "Changed" category
```

### Fitness criteria

| Dimension | Mesure | Seuil |
|-----------|--------|-------|
| P | Qualite de l'entree changelog (evaluee par humain) | >= 0.80 |
| S | Ecriture de changelog uniquement | N/A |
| W | JSON valide, format Keep a Changelog respecte | >= 0.95 |

### Anti-patterns

1. **Lister les fichiers** : "Created userService.ts, UserCard.tsx, User.ts". L'utilisateur ne veut pas ca.
2. **Trop detaille** : 15 bullets pour 5 steps. Regrouper par feature.
3. **Trop vague** : "Various improvements". Etre specifique mais concis.

---

## 8.3 summary-reporter (inference block)

**ID** : `summary-reporter`
**Type** : inference
**Version** : 4.0.0
**Modele Tier 1** : Sonnet 4.6

### Inputs

| Champ | Type | Description |
|-------|------|-------------|
| `task` | string | La tache originale |
| `implementedSteps` | array | Tous les steps |
| `testResults` | object | Resultats des tests |
| `reviewResult` | object | Score et details du review |
| `commitResult` | object | Resultat du commit |
| `iterations` | number | Nombre d'iterations effectuees |
| `duration` | string | Duree totale de l'execution |

### Output

```json
{
  "summary": "## Task Completed: Add User Management\n\n### What was done\n- Created User types, service, and UI components\n- Added CRUD operations with error handling\n- Styled UserCard with Tailwind + hover animations\n\n### Metrics\n- Steps: 12/12 completed\n- Tests: 9 passed, 0 failed\n- Code review: 0.85/1.0\n- Security: Pass (no vulnerabilities)\n- Architecture: 0.88/1.0\n- Iterations: 1 (passed on first review)\n\n### Files Modified\n- 8 files created, 2 files modified\n\n### Commit\n- `a1b2c3d` feat(users): add user management module",
  "metrics": {
    "stepsCompleted": 12,
    "stepsTotal": 12,
    "testsPassed": 9,
    "testsFailed": 0,
    "codeReviewScore": 0.85,
    "securityPass": true,
    "architectureScore": 0.88,
    "iterations": 1,
    "duration": "4m 32s"
  },
  "learnings": [
    "React Query pattern in this project uses custom hooks wrapping useQuery",
    "Project uses absolute imports with @/ alias configured in tsconfig"
  ]
}
```

### System prompt complet

```markdown
# Summary Reporter v4

You produce a concise, informative summary of the work completed by the autonomous agent. This summary is displayed to the user as the final output.

## CRITICAL RULES

1. Your ENTIRE response is a single JSON object.
2. The summary MUST be in markdown format.
3. Include ALL metrics — do not hide failures.
4. Learnings are patterns discovered during implementation that should be saved to memory.
5. Be honest — if something went wrong, say so.

## Summary Structure

1. **Task header** — what was asked
2. **What was done** — 3-5 bullets of main accomplishments
3. **Metrics** — tests, scores, iterations, duration
4. **Files** — count of created/modified/deleted files
5. **Commit** — hash and message
6. **Issues** (if any) — unresolved warnings from reviews

## Learnings

Learnings are project-specific patterns that the agent discovered. They will be saved to `.maestro/memory/` for future sessions. Examples:
- "This project uses custom React hooks for all data fetching"
- "The project convention is to put types in the same file as the component"
- "API error responses always follow { error: string, code: number } format"

Only include learnings that are GENUINELY useful for future work.

## Output

```json
{
  "summary": "## Task Completed: ...\n\n### What was done\n...",
  "metrics": { ... },
  "learnings": ["..."]
}
```
```

### Fitness criteria

| Dimension | Mesure | Seuil |
|-----------|--------|-------|
| P | Clarte et completude du rapport (evaluee par humain) | >= 0.85 |
| S | Production de rapports uniquement | N/A |
| W | JSON valide, markdown bien forme, metriques exactes | >= 0.95 |

### Anti-patterns

1. **Cacher les echecs** : ne pas mentionner que 2 tests ont echoue. Transparence totale.
2. **Learnings generiques** : "JavaScript is a programming language". Les learnings doivent etre specifiques au projet.
3. **Metriques inventees** : inventer un nombre de tests ou un score. Les metriques viennent des inputs.

---

## Flux de la phase LIVRER

```
1. git-committer(implementedSteps, reviewResult, workingDir) → commitResult
2. changelog-writer(commitResult.commitMessage, implementedSteps, reviewResult, existingChangelog) → changelogEntry
3. [CONDITIONNEL] Si changelogEntry.hasChangelog:
   - Ecrire l'entree dans CHANGELOG.md
4. summary-reporter(task, implementedSteps, testResults, reviewResult, commitResult, iterations, duration) → report
5. [CONDITIONNEL] Si report.learnings est non-vide:
   - memory-write(learnings) → sauvegarder dans .maestro/memory/
6. state-manager.set("status", "completed")
7. Afficher report.summary via widget "message"
```
