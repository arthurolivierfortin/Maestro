---
description: "Git workflow conventions for B-One Maestro project - branch naming and commit messages"
applyTo: "**/*"
---

# Git Workflow Conventions

This document defines the Git workflow conventions for B-One Maestro, including branch naming patterns and commit message standards following the Conventional Commits specification.

## Branch Naming Conventions

Branches must follow a consistent naming pattern to maintain clarity and organization.

### Format
```
<type>/<issue-id>-<short-description>
```

### Branch Types

**Feature Branches** - New features or enhancements
```bash
feature/MAESTRO-001-workflow-execution-engine
feature/MAESTRO-015-planner-agent
feature/MAESTRO-042-signalr-monitoring
```

**Bugfix Branches** - Bug fixes for existing features
```bash
bugfix/MAESTRO-023-node-connection-validation
bugfix/MAESTRO-056-execution-state-race-condition
bugfix/MAESTRO-089-dto-mapping-null-reference
```

**Hotfix Branches** - Critical production fixes
```bash
hotfix/MAESTRO-101-security-vulnerability
hotfix/MAESTRO-105-data-loss-on-save
```

**Refactor Branches** - Code refactoring without functional changes
```bash
refactor/MAESTRO-030-llm-gateway-abstraction
refactor/MAESTRO-067-extract-common-validation
```

**Architecture Branches** - Architectural changes or major restructuring
```bash
arch/MAESTRO-010-clean-architecture-implementation
arch/MAESTRO-025-domain-event-system
```

**Documentation Branches** - Documentation updates only
```bash
docs/MAESTRO-012-update-api-documentation
docs/MAESTRO-033-add-adr-workflow-persistence
```

**Test Branches** - Test additions or improvements
```bash
test/MAESTRO-045-integration-tests-workflow-api
test/MAESTRO-078-unit-tests-domain-entities
```

**Chore Branches** - Maintenance tasks, dependency updates
```bash
chore/MAESTRO-050-update-dependencies
chore/MAESTRO-091-ci-pipeline-improvements
```

### Branch Naming Rules

1. **Always lowercase**: Use kebab-case for descriptions
2. **Include issue ID**: Reference ticket/issue number (MAESTRO-XXX)
3. **Be descriptive**: Short but clear description of the work
4. **No special characters**: Only letters, numbers, hyphens, and slashes
5. **Max length**: Keep under 50 characters if possible

### Examples

✅ **Good Branch Names:**
```bash
feature/MAESTRO-123-add-git-integration
bugfix/MAESTRO-456-fix-null-pointer-execution
refactor/MAESTRO-789-improve-node-validator
arch/MAESTRO-012-implement-cqrs-pattern
docs/MAESTRO-034-document-llm-gateway-usage
```

❌ **Bad Branch Names:**
```bash
feature/add-stuff                    # No issue ID, too vague
FEATURE/MAESTRO-123-AddGitStuff     # Not lowercase
bugfix/fix                           # No issue ID, too short
feature_add_integration              # Use slashes and hyphens, not underscores
feature/MAESTRO-123-add-git-integration-for-workflow-execution-with-support-for-multiple-repositories  # Too long
```

---

## Commit Message Conventions

Maestro follows **Conventional Commits** specification with layer-specific scopes aligned with Clean Architecture.

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **refactor**: Code refactoring (no functional changes)
- **docs**: Documentation changes
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build, CI/CD)
- **perf**: Performance improvements
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **arch**: Architectural changes
- **revert**: Revert a previous commit

### Scopes (Clean Architecture Layers)

Use scopes to indicate which layer is affected:

- **domain**: Domain layer (entities, value objects, domain services)
- **application**: Application layer (use cases, DTOs, interfaces)
- **infrastructure**: Infrastructure layer (LLM adapters, repositories, external services)
- **api**: Presentation layer (controllers, SignalR hubs)
- **ui**: Frontend components and UI
- **agents**: Specialized agents (Planner, Coder, Tester, Reviewer)
- **workflows**: Workflow engine and orchestration
- **monitoring**: Execution monitoring and observability

### Subject Line Rules

1. **Max 72 characters**
2. **Lowercase** for type and scope
3. **No period** at the end
4. **Imperative mood**: "add" not "added" or "adds"
5. **Be specific**: Clear and concise description

### Body Rules (Optional but Recommended)

1. **Wrap at 100 characters**
2. **Explain WHAT and WHY**, not HOW
3. **Use bullet points** for multiple changes
4. **Reference issues**: Use "Refs #123" or "Closes #123"

### Footer (Optional)

- **Breaking changes**: Start with `BREAKING CHANGE:`
- **Issue references**: `Closes #123`, `Fixes #456`, `Refs #789`

---

## Commit Message Examples

### Simple Commits

**Simple feature commit:**
```bash
feat(domain): add workflow execution context entity
```

**Simple bug fix:**
```bash
fix(api): correct null reference in workflow controller
```

**Simple refactoring:**
```bash
refactor(application): simplify DTO mapping logic
```

### Detailed Commits

**Feature with body:**
```bash
feat(application): implement workflow execution use case

- Add ExecuteWorkflowUseCase with state management
- Implement pause/resume functionality
- Add validation for workflow readiness
- Integrate with IExecutionMonitor for real-time updates

Refs #MAESTRO-042
```

**Bug fix with context:**
```bash
fix(infrastructure): resolve null reference in LLM gateway

Handle case where model response is null or empty
to prevent NullReferenceException during workflow execution.

Fixes #MAESTRO-089
```

**Breaking change:**
```bash
feat(api): change workflow API response format

BREAKING CHANGE: WorkflowDto now includes executionState property.
Clients must update to handle the new response structure.

Migration guide available in docs/migration/v2.0.md

Refs #MAESTRO-156
```

**Refactoring with explanation:**
```bash
refactor(domain): extract node validation to domain service

Move validation logic from Workflow entity to NodeValidator
domain service to follow Single Responsibility Principle.
No functional changes.
```

**Multiple changes:**
```bash
feat(ui): add workflow editor with drag-and-drop support

- Implement WorkflowCanvas component with React Flow
- Add NodePalette for dragging new nodes
- Create NodeConfigPanel for editing node properties
- Integrate with workflow API for save/load operations
- Add undo/redo functionality
- Implement connection validation

Closes #MAESTRO-034
```

**Architecture change:**
```bash
arch(infrastructure): implement LLM gateway abstraction layer

Introduce ILLMGateway interface to decouple application
from specific LLM providers. Implement adapters for:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3)
- Ollama (local models)

This enables model-agnostic agent design and runtime
provider switching via configuration.

See ADR-0001 for architectural decision rationale.

Refs #MAESTRO-010
```

**Documentation:**
```bash
docs: add ADR for model-agnostic design

Document decision to use Gateway pattern for LLM abstraction,
including context, alternatives considered, and consequences.
```

**Hotfix:**
```bash
fix(api): prevent data loss during concurrent workflow updates

Add optimistic concurrency control using ETag headers
to prevent lost updates when multiple users edit the
same workflow simultaneously.

Fixes #MAESTRO-105 (critical)
```

**Revert:**
```bash
revert: feat(domain): add workflow execution context entity

This reverts commit abc123def456.

Reverted due to performance issues identified in production.
Will be reimplemented with caching strategy.

Refs #MAESTRO-178
```

---

## Layer-Specific Commit Examples

### Domain Layer
```bash
feat(domain): add AgentType value object with validation
fix(domain): correct workflow state transition logic
refactor(domain): extract node connection rules to domain service
test(domain): add unit tests for Workflow entity
```

### Application Layer
```bash
feat(application): implement CreateWorkflowUseCase
fix(application): handle missing workflow in ExecuteWorkflowUseCase
refactor(application): simplify DTO mapping logic
test(application): add integration tests for use cases
```

### Infrastructure Layer
```bash
feat(infrastructure): add OpenAI adapter for LLM gateway
fix(infrastructure): resolve timeout issues in Git service
perf(infrastructure): optimize workflow repository queries
test(infrastructure): add integration tests for LLM adapters
```

### API Layer
```bash
feat(api): add WorkflowsController with CRUD endpoints
fix(api): return proper HTTP status codes in error cases
docs(api): add XML documentation to all controller methods
test(api): add integration tests for workflow API
```

### Frontend
```bash
feat(ui): implement workflow editor canvas
fix(ui): resolve node positioning bug in workflow editor
style(ui): apply consistent spacing in monitoring dashboard
test(ui): add component tests for WorkflowEditor
```

### Agents
```bash
feat(agents): implement Planner agent with task decomposition
fix(agents): correct prompt template in Coder agent
refactor(agents): extract common agent logic to base class
test(agents): add unit tests for agent coordination
```

---

## Commit Message Best Practices

1. **Atomic commits**: One logical change per commit
2. **Commit often**: Small, focused commits are easier to review and revert
3. **Test before commit**: Ensure tests pass
4. **Meaningful messages**: Future you will thank present you
5. **Reference issues**: Always link to tracking system
6. **Use imperative mood**: "add feature" not "added feature"
7. **Avoid "and"**: If you need "and", consider splitting the commit

---

## Commit Message Anti-Patterns

### ❌ Vague Messages
```bash
fix: bug fix
feat: updates
chore: stuff
refactor: changes
```

**Why it's bad**: Provides no context about what was actually changed.

**Better:**
```bash
fix(infrastructure): resolve null reference in LLM gateway
feat(domain): add workflow execution context entity
chore: update .NET dependencies to version 8.0
refactor(application): extract validation logic to separate class
```

### ❌ Too Detailed (Code in Commit Message)
```bash
feat: add new feature

Changed line 45 in Workflow.cs from:
  if (node == null)
to:
  if (node is null)
Also updated line 67 to use pattern matching...
```

**Why it's bad**: Commit messages should describe WHAT and WHY, not HOW. Code diffs show the HOW.

**Better:**
```bash
feat(domain): add null safety checks to workflow entity

Improve null handling in Workflow entity using modern
C# patterns for better null safety and readability.
```

### ❌ Missing Context
```bash
fix: null check
feat: update
docs: changes
```

**Why it's bad**: No information about where or why the change was made.

**Better:**
```bash
fix(infrastructure): add null check to Git service operations
feat(ui): update workflow editor with real-time collaboration
docs: document LLM gateway configuration options
```

### ❌ Wrong Type
```bash
feat: fix typo in documentation  # Should be docs: or fix(docs):
fix: add new feature             # Should be feat:
chore: implement authentication  # Should be feat(api):
```

**Why it's bad**: Makes semantic versioning and changelog generation incorrect.

### ❌ Multiple Unrelated Changes
```bash
feat: add new feature, fix bug, update dependencies
```

**Why it's bad**: Violates atomic commit principle, makes reverting specific changes difficult.

**Better:** Split into multiple commits:
```bash
feat(domain): add workflow execution context entity
fix(api): correct null reference in workflow controller
chore: update .NET dependencies to version 8.0
```

---

## Pre-Commit Checklist

Before committing, verify:

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Code follows conventions in `code-conventions.instructions.md`
- [ ] No commented-out code
- [ ] No debug statements (console.log, Debug.WriteLine)
- [ ] Commit message follows conventional format
- [ ] Changes are atomic and focused
- [ ] Issue/ticket is referenced in commit body or footer
- [ ] Breaking changes are clearly marked in footer

---

## Complete Git Workflow Example

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/MAESTRO-123-add-workflow-engine

# 2. Make changes
# ... edit files in src/Maestro.Domain/Entities/Workflow.cs ...

# 3. Check status
git status

# 4. Stage changes
git add src/Maestro.Domain/Entities/Workflow.cs
git add tests/Maestro.Domain.Tests/Entities/WorkflowTests.cs

# 5. Commit with conventional message
git commit -m "feat(domain): add workflow execution state management

- Implement ExecutionState value object
- Add state transition validation
- Include pause/resume capabilities
- Add unit tests for state transitions

Refs #MAESTRO-123"

# 6. Make more changes and commits as needed
# ... continue working ...

# 7. Push to remote
git push origin feature/MAESTRO-123-add-workflow-engine

# 8. Create Pull Request
# Use generate-pr-description.prompt.md to create PR description

# 9. After PR approval and merge, delete local branch
git checkout main
git pull origin main
git branch -d feature/MAESTRO-123-add-workflow-engine
```

---

## Working with Multiple Commits

### Scenario: Feature Requires Multiple Commits

```bash
# Commit 1: Domain entity
git commit -m "feat(domain): add Workflow entity with basic properties"

# Commit 2: Domain validation
git commit -m "feat(domain): add validation rules to Workflow entity"

# Commit 3: Use case
git commit -m "feat(application): implement CreateWorkflowUseCase"

# Commit 4: API endpoint
git commit -m "feat(api): add POST endpoint for workflow creation"

# Commit 5: Tests
git commit -m "test(domain): add unit tests for Workflow entity"
```

### Scenario: Fix Mistake in Previous Commit

```bash
# Option 1: Amend last commit (if not pushed yet)
git add forgotten-file.cs
git commit --amend --no-edit

# Option 2: Create fixup commit (if already pushed)
git commit -m "fix(domain): correct validation logic in Workflow entity"
```

---

## Branch Protection and PR Requirements

### Main Branch Protection Rules

The `main` branch must be protected with:

1. **Require pull request reviews**: At least 1 approval required
2. **Require status checks**: All CI/CD checks must pass
3. **Require branches to be up to date**: Must merge latest main before merging PR
4. **No direct commits**: All changes via pull requests
5. **Require conventional commits**: Commit messages validated by CI

### Pull Request Requirements

Before merging a PR:

- [ ] All commits follow conventional commit format
- [ ] Branch name follows naming conventions
- [ ] All tests pass (unit, integration, E2E)
- [ ] Code coverage meets minimum thresholds
- [ ] No merge conflicts with main
- [ ] At least 1 approval from code owner
- [ ] All review comments resolved
- [ ] Documentation updated if needed
- [ ] CHANGELOG updated (if applicable)

---

## Tools and Automation

### Recommended Git Hooks

**Pre-commit hook** - Validate commit message format:
```bash
#!/bin/sh
# .git/hooks/commit-msg

commit_msg=$(cat $1)
pattern="^(feat|fix|docs|style|refactor|perf|test|chore|arch|revert)(\(.+\))?: .{1,72}"

if ! echo "$commit_msg" | grep -qE "$pattern"; then
    echo "Error: Commit message does not follow Conventional Commits format"
    echo "Expected: <type>(<scope>): <subject>"
    echo "Example: feat(domain): add workflow execution context"
    exit 1
fi
```

### Useful Git Aliases

Add to `.gitconfig`:
```ini
[alias]
    # Quick conventional commits
    feat = "!f() { git commit -m \"feat($1): $2\"; }; f"
    fix = "!f() { git commit -m \"fix($1): $2\"; }; f"
    docs = "!f() { git commit -m \"docs: $1\"; }; f"
    
    # View commit history with conventional format
    log-conv = log --pretty=format:'%C(yellow)%h%C(reset) - %C(cyan)%s%C(reset) %C(green)(%cr)%C(reset) %C(blue)<%an>%C(reset)'
    
    # Create feature branch
    feature = "!f() { git checkout -b feature/$1; }; f"
    bugfix = "!f() { git checkout -b bugfix/$1; }; f"
```

---

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Git Branch Naming Best Practices](https://dev.to/varbsan/a-simplified-convention-for-naming-branches-and-commits-in-git-il4)
- [Writing Good Commit Messages](https://chris.beams.io/posts/git-commit/)
- [Clean Architecture in Git Workflow](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Maestro Code Conventions](./code-conventions.instructions.md)
- [Maestro Clean Architecture Guidelines](./clean-architecture.instructions.md)
