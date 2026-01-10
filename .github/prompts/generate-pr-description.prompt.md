---
mode: 'agent'
description: 'Generate formatted Pull Request description for B-One Maestro analyzing branch changes and architecture impacts'
---

> **Note for the assistant:**  
> Use the structure below as a guide, but adapt the format (paragraphs, lists, tables, examples) to maximize clarity and value for reviewers. Prefer narrative and explanation when relevant, especially for test, refactor, or documentation PRs. Bullet points are allowed, but should not be the only form of presentation. For feature PRs, detail both functional and technical contributions, but feel free to group or synthesize major changes.

Generate a comprehensive Pull Request description by analyzing all changes between the target branch and current branch, following a structured template.

## Parameters:
- **targetBranch**: The target branch for the PR (default: `main`)
- **includeDiff**: Set to `true` to include detailed code changes in analysis
- **includeTests**: Set to `true` to analyze test changes and coverage
- **prType**: Type of PR (`feature`, `bugfix`, `hotfix`, `refactor`, `docs`, `chore`)

## Steps:

1. **Analyze branch changes:**
   - **Get commit history:** Compare current branch with target branch
   - **Analyze file changes:** Identify modified, added, and deleted files
   - **Extract commit messages:** Categorize changes by type (feat, fix, refactor, etc.)
   - **Identify components:** Determine which application layers are affected
   - **Detect breaking changes:** Look for API changes, configuration updates, or breaking modifications
   - **Check emoji usage:** Review commit history to identify already used emojis and ensure title uniqueness

2. **Categorize changes by architectural layer:**
   - **Domain Layer** (`Maestro.Domain/`): Entities (Workflow, Node, Agent), Value Objects, Domain Services, Interfaces
   - **Application Layer** (`Maestro.Application/`): Use Cases, DTOs, Orchestration Logic, Application Interfaces (ILLMGateway, IExecutionMonitor)
   - **Infrastructure Layer** (`Maestro.Infrastructure/`): LLM Gateway implementations, Git integration, Persistence, Tool executors
   - **Presentation Layer** (`Maestro.Api/`): Controllers, SignalR Hubs, API endpoints
   - **Agents Layer** (`Maestro.Agents/`): Specialized agents (Planner, Coder, Tester, Reviewer)
   - **Frontend** (`frontend/`): React components, Workflow Editor, Monitoring UI, TypeScript services
   - **Documentation**: README, ADRs, schemas, API docs
   - **Infrastructure**: CI/CD, build scripts, deployment configuration

3. **Extract features and improvements:**
   - **New Features:** New workflow nodes, agents, tools, UI components
   - **Architecture:** Changes to Clean Architecture layers, dependency rules, abstractions
   - **Model Agnosticism:** LLM Gateway changes, new adapter implementations
   - **Workflow Engine:** Execution logic, state management, orchestration improvements
   - **Monitoring:** Real-time updates, execution tracking, SignalR events
   - **Bug Fixes:** Resolved issues, error handling improvements
   - **Performance:** Workflow execution optimizations, UI rendering improvements
   - **Security:** Tool sandboxing, permission management, API security
   - **Refactoring:** Code cleanup respecting architectural boundaries
   - **Configuration:** New workflow schemas, environment variables, settings

4. **Generate structured PR description:**

## PR Title Format:

Generate an appropriate title for the PR following this format:
```
{emoji} {Type} : {Issue-ID} – {Brief Description}
```


- **Emoji:** The emoji must describe the changes from this PR
- **Type:** Primary change category (Feature, Bugfix, Refactor, etc.)
- **Issue-ID:** Extract from branch name or commit messages (e.g., PAFS-XXX)
- **Brief Description:** Concise summary of main change

**Title Examples:**
- `🎯 Feature : MAESTRO-001 – Implement Workflow Execution Engine with State Management`
- `🤖 Feature : MAESTRO-015 – Add Planner Agent with Task Decomposition`
- `🔧 Bugfix : MAESTRO-023 – Fix node connection validation in workflow editor`
- `🏛️ Architecture : MAESTRO-030 – Refactor LLM Gateway for model-agnostic design`
- `📊 Feature : MAESTRO-042 – Add real-time execution monitoring with SignalR`

## PR Description Template:

# 🎯 Purpose
Start with one or two paragraphs explaining the purpose of the PR, the context, and the overall impact.

# 📋 Changes Summary
Present additions, modifications, fixes, removals:  
- Use paragraphs or lists depending on the nature of the changes.
- For test PRs, detail coverage, affected modules, and test strategy.

# 🏗️ Technical Details
Explain technical choices, architecture, patterns used, etc. Use subtitles, paragraphs, or tables if useful.

# 🧪 Testing
Describe the testing strategy, scenarios covered, and how to run the tests. Add example commands if relevant.

# 📖 Documentation
List updated documentation/files and summarize documentation changes.

# 🚀 Deployment Notes
List important points for deployment, migrations, environment variables, etc.

# 🔄 Migration Guide (if applicable)
Explain migration steps if needed.

# 📸 Screenshots/Examples (if applicable)
Add screenshots or examples if relevant.

# 🔗 Related Issues
List related issues.

# 👥 Review Notes
Add advice for reviewers, points of attention, risks, etc.

# Git Analysis Commands:

**Get commit history between branches:**
```bash
git log --oneline {targetBranch}..HEAD
git log --grep="feat:" --grep="fix:" --grep="refactor:" {targetBranch}..HEAD
```

**Analyze file changes:**
```bash
git diff --name-status {targetBranch}..HEAD
git diff --stat {targetBranch}..HEAD
```

**Get detailed diff for analysis:**
```bash
git diff {targetBranch}..HEAD
```

**Find breaking changes indicators:**
```bash
git log --grep="BREAKING CHANGE" --grep="!" {targetBranch}..HEAD
```

**Extract issue ID from branch name or commits:**
```bash
git branch --show-current | grep -o -E "(PAFS|JIRA)-[0-9]+"
git log --oneline {targetBranch}..HEAD | grep -o -E "(PAFS|JIRA|#)[0-9]+"
```

**Check emoji usage in commit history to ensure uniqueness:**
```bash
git log --oneline --all | grep -o -E "^[a-f0-9]+ [�-🿏]" | cut -d' ' -f2 | sort | uniq
git log --oneline {targetBranch}..HEAD | grep -o -E "[�-🿏]"
```

**Analyze test changes:**
```bash
git diff --name-only {targetBranch}..HEAD | grep -E "\.(Test|Tests)\."
git diff {targetBranch}..HEAD -- "**/*Test*.cs"
```

**Check configuration changes:**
```bash
git diff {targetBranch}..HEAD -- "appsettings*.json" "Dockerfile" "*.yml" "*.yaml"
```

# Change Type Classification:

**By commit message prefix:**
- **feat:** → New Features section
- **fix:** → Bug Fixes section  
- **refactor:** → Technical Improvements section
- **perf:** → Performance Improvements section
- **security:** → Security Enhancements section
- **docs:** → Documentation Updates section
- **test:** → Testing Improvements section
- **chore:** → Maintenance section
- **docker:** → Infrastructure Changes section

**By file patterns:**
- `Controllers/` → API changes
- `Models/` → Data structure changes
- `Services/` → Business logic changes
- `Tests/` → Testing changes
- `appsettings*.json` → Configuration changes
- `Dockerfile` → Deployment changes
- `README.md` → Documentation changes

**Breaking change indicators:**
- Changes in public API signatures
- New required configuration variables
- Database schema changes
- Dependency version upgrades with breaking changes

# Usage Examples:

**Basic PR description generation:**
```
Follow generate-pr-description.prompt.md for current branch against main
```

**Detailed analysis with diff:**
```
Follow generate-pr-description.prompt.md with includeDiff: true, includeTests: true
```

**Feature PR description:**
```
Generate PR description using generate-pr-description.prompt.md
Parameters: targetBranch = main, prType = feature, includeDiff = true
```

**Hotfix PR description:**
```
Generate PR description using generate-pr-description.prompt.md
Parameters: targetBranch = main, prType = hotfix, includeTests = true
```

# Output:
Provide a complete PR description following the template with:
- **Generated PR title** with appropriate emoji and standardized format
- Analyzed changes categorized by type and component
- Technical details extracted from code changes
- Testing considerations based on modified files
- Deployment notes for configuration or infrastructure changes
- Clear checklist items for review and deployment
- Proper markdown formatting ready for GitHub PR

**Final Output Format:**
Create a file named `pr-description.md` containing:
1. **PR Title** on the first line (for copy-paste into GitHub title field)
2. **Empty line separator**
3. **Complete formatted PR description** ready for copy-paste into GitHub description field

The file should contain only the markdown content without any additional explanations or tool outputs, making it immediately usable for creating the Pull Request.
