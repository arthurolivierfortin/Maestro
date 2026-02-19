# Quickstart: Autonomous Development with Maestro

This guide shows how to use Maestro to autonomously implement tasks in a target project. The workflow analyzes the project, creates a plan, implements each step, validates on disk, runs tests, reviews code quality, and commits.

---

## Prerequisites

1. **Maestro backend running** on port 5000
2. **LLM-Provider running** on port 5010 with at least one model available

```bash
# Start all services (skips already-running services)
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1

# Verify
cd C:\Meastro\maestro-cli
node index.js health
```

Expected output:
```
Status:       healthy
Blocks:       105
LLM:          healthy
```

If LLM shows "unavailable", the LLM-Provider is not running. Start it separately:
```bash
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\LLM-Provider\dotnet; dotnet run --project src/LLMProvider.Web'"
```

3. **A target project** (git repository) where you want Maestro to work

---

## Fast Path: `maestro code`

The fastest way to use Maestro (Phase 33):

### Interactive TUI

```bash
cd C:\Meastro\maestro-cli
node index.js code --repo C:\path\to\your\project
```

This opens an Ink-based TUI with a prompt. Type your task, press Enter, and watch the execution in real-time. Session creation, template import, and workflow invocation are handled automatically.

### Headless Mode

For CI, automation, or non-TTY environments:

```bash
node index.js code --headless --task "Add a MIT LICENSE file" --repo C:\path\to\your\project
```

Output is structured text to stdout:
```
[12:34:56] [INFO ] Task: Add a MIT LICENSE file
[12:34:56] [INFO ] Creating session...
[12:34:57] [INFO ] Session started
[12:34:57] [NODE ] ▶ Plan
[12:35:02] [NODE ] ✓ Plan
[12:35:02] [NODE ] ▶ Implement
[12:35:10] [NODE ] ✓ Implement
[12:35:15] [DONE ] Task completed successfully
```

### Using Aliases

If you've initialized your project with `maestro init`:

```bash
cd C:\path\to\your\project
cd C:\Meastro\maestro-cli

# Initialize project (creates .maestro/ with config + aliases)
node index.js init C:\path\to\your\project

# Then use aliases
node index.js agent "Add login page"
```

Aliases map short commands to templates + entry points. See `.maestro/aliases.json`.

---

## Advanced: Manual Session Workflow

For full control over session lifecycle, use the manual workflow:

### Step 1: Create a Session

```bash
cd C:\Meastro\maestro-cli
node index.js session create \
  --type project \
  --name "MyProject - Add feature X" \
  --repo "C:\path\to\your\project" \
  --template project-autonomous \
  --start
```

Note the **Session ID** returned (e.g., `38ec6ae5-f7dd-44bd-9037-2b051666b0fe`).

### Step 2: Launch the Monitor

Open a new terminal window with the TUI monitor:

```bash
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"
```

The monitor shows real-time progress: phases (Prepare, Plan, Validate, Implement, Test, Review, Commit), execution tree, and logs.

### Step 3: Invoke the Workflow

```bash
node index.js session invoke <session-id> dev \
  --input task="<description of what you want done>" \
  repoPath="C:\path\to\your\project"
```

---

## Example Tasks (Tested)

```bash
# Simple: create a file
node index.js code --headless --task "Add a MIT LICENSE file to the project" --repo C:\Cantante

# Medium: fix code issues
node index.js code --headless --task "Fix TypeScript compilation errors in src/modules/file-tree.ts" --repo C:\Cantante

# Complex: create new module
node index.js code --headless --task "Create the Electron main process entry point in src/main/index.ts with a BrowserWindow" --repo C:\Cantante
```

---

## What Happens

The workflow runs through 7 phases:

| Phase | Agent | What it does |
|-------|-------|-------------|
| 1. Prepare | project-preparer | Reads package.json, directory structure, detects stack/conventions |
| 2. Plan | task-planner | Decomposes task into atomic steps (create, modify, delete files) |
| 3. Validate | json-validator | Validates the plan JSON structure |
| 4. Implement | implement-single-step | Executes each step: reads files, writes changes, verifies |
| 5. Test | test-executor | Detects test framework, runs tests if available, runs type check |
| 6. Review | code-reviewer | Scores the implementation (completeness, quality, tests, architecture, security) |
| 7. Commit | git-committer | Creates a conventional commit with only the modified files |

Each implementation step is verified on disk by the `step-validator` tool before proceeding.

---

## Checking Results

After the workflow completes:

```bash
cd C:\path\to\your\project
git log --oneline -3     # See the commit
git diff HEAD~1          # See what changed
```

---

## Troubleshooting

### "Block not found: autonomous-development"
The workflow block isn't published. Run:
```bash
cd C:\Meastro\maestro-cli
node index.js block publish autonomous-development
node index.js approvals list
node index.js approvals approve <approval-id>
```

### Test step takes too long (timeout after 300s)
The test-executor may try to run a test framework that doesn't exist. Ensure your package.json has the test framework in devDependencies, or the test step will correctly report "no test framework detected" and continue.

### Workflow stops mid-execution
Check the execution log:
```bash
curl -s http://localhost:5000/api/sessions/<session-id>/variables/_executionLog | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const j=JSON.parse(d); j.value.slice(-5).forEach(l=>console.log(l.time+' ['+l.level+'] '+l.msg))})"
```

### "LLM request failed" errors
The LLM-Provider may be down or the model unavailable. Check:
```bash
curl -s http://localhost:5010/api/v1/health/
curl -s http://localhost:5010/api/v1/models
```

### Interactive mode requires a terminal (TTY)
If running `maestro code` in a non-TTY context, use `--headless` mode instead:
```bash
node index.js code --headless --task "your task"
```

---

## Tips

- **Be specific in task descriptions.** Instead of "fix the code", say "Fix TypeScript compilation errors in src/modules/file-tree.ts — FileNode is used as a class but declared as an interface."
- **One task per session.** Create a new session for each task (or use `maestro code` which does this automatically).
- **Check git status first.** If your repo has uncommitted changes, the agent may include them in its commit.
- The review score is informational. Currently, `approved: false` does not block the commit.
- **`maestro code` is the recommended workflow.** Manual session management is only needed for advanced use cases.
