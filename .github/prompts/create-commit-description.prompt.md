
# Output Format Example (MUST MATCH EXACTLY)
```
feat: add batch translation support for multiple Excel files

- Implemented batch processing functionality to handle multiple Excel files
- Updated the file upload UI to support multi-file selection
- Enhanced Azure Translator integration for concurrent processing
- Added progress tracking for batch operations
- Updated Docker configuration for improved memory handling

Follow-up:
- Test batch translation with large files in staging
```

**Do not output any text outside the code block. The output must be only a single code block containing the commit message, with no explanation, no introduction, and no extra lines before or after. If the output does not match the example format exactly, consider the result invalid.**
---
mode: 'agent'
description: 'Generate a commit description for UID-Translation-Tool using git commands and commit conventions'
---


Generate a commit description in **English**, following our team's commit naming convention for the B-One Maestro project.


**The commit description MUST be already formatted and ready to use as a commit message.**
Strictly follow this format:
- The first line is a concise title with the correct prefix (e.g., `feat:`, `fix:`, `docs:`, etc.), max 72 characters.
- Add a single blank line after the title.
- The body is a list of changes, each starting with a dash (`-`), one per line (no paragraphs).
- If needed, add a "Follow-up:" section at the end, also as a bulleted list.
- The output must be a single code block, ready to copy-paste into git, and must not contain any unformatted or raw description.
- Do not output any text outside the code block. If the output does not match the example format exactly, consider the result invalid.

Steps:

1. Use the following standard Git commands to gather information about uncommitted recent changes (the assistant MUST use these commands, in this order, to ensure accuracy):
   - `git status --short` (to list staged and unstaged changes)
   - `git diff --cached` (to show staged diffs)
   - `git diff` (to show unstaged diffs)
   - `git log -n 5 --oneline` (to show recent commit history for context)
   - `git show <commit>` (if needed, to inspect specific recent commits)
   - Any other git command needed to clarify the nature of the changes
   The assistant must use these commands to fully understand the current state before generating the commit message.

2. Analyze the changes to extract:
   - Commit hashes, authors, dates, messages
   - Associated diffs
   - Local worktree changes

3. Consider the B-One Maestro context:
   - Workflow orchestration and execution engine
   - Multi-agent coordination (Planner, Coder, Tester, Reviewer)
   - Clean Architecture layers (Domain, Application, Infrastructure, Presentation)
   - LLM Gateway abstraction (model-agnostic design)
   - Frontend workflow editor (React/TypeScript)
   - Backend API and SignalR hubs (.NET)
   - Git integration and artifact management
   - Real-time monitoring and execution tracking



4. Generate a commit message with:
   - A concise, formatted title (max 72 characters, with prefix)
   - A single blank line after the title
   - A bulleted list of changes, each starting with a dash (`-`), one per line
   - If needed, a "Follow-up:" section at the end, also as a bulleted list
   - Output the result as a single code block, ready to copy-paste into git
   - Example (the output must look exactly like this, not a raw description):
     ```
     feat(domain): add workflow execution context and state management

     - Implemented ExecutionContext entity with node state tracking
     - Added WorkflowState value object for execution lifecycle management
     - Created IExecutionRepository interface in Domain layer
     - Updated Workflow entity to support pause/resume operations
     - Added unit tests for execution state transitions

     Follow-up:
     - Implement persistence layer for execution context
     - Add SignalR events for state change notifications
     ```

Use the following commit naming convention:
- `feat:` for new features (agents, workflow nodes, tools, UI components)
- `feat(domain):` for Domain layer features (entities, value objects, domain services)
- `feat(application):` for Application layer features (use cases, DTOs, orchestration)
- `feat(infrastructure):` for Infrastructure layer features (LLM adapters, Git integration, persistence)
- `feat(api):` for API/Presentation layer features (controllers, SignalR hubs)
- `feat(ui):` for frontend features (workflow editor, monitoring UI)
- `fix:` for bug fixes (execution errors, UI bugs, API issues)
- `fix(domain):` for Domain layer bug fixes
- `fix(application):` for Application layer bug fixes
- `docs:` for documentation changes (README, ADRs, API docs)
- `refactor:` for code restructuring (respecting Clean Architecture boundaries)
- `refactor(domain):` for Domain layer refactoring
- `test:` for adding or updating tests (unit tests, integration tests)
- `chore:` for maintenance tasks (dependency updates, build configuration)
- `arch:` for architectural changes (new patterns, layer modifications)

Make sure the message is clear, actionable, and professional, with specific reference to translation functionality when relevant.
