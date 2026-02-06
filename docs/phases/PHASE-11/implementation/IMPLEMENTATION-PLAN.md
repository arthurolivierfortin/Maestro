# Implementation Plan: Phase 8
**Date**: February 5, 2026
**Status**: Ready for Implementation

---

## 1. Overview

This implementation plan is organized into two parts:

**Part A: Generic Infrastructure** - Features that apply to ALL sessions
**Part B: Sample Session Content** - Content specific to the "Generate Commit Tool" session

This separation ensures the infrastructure is reusable for any future session with any architecture.

---

# PART A: GENERIC INFRASTRUCTURE

These work packages create features usable by ANY session.

---

## WP1: Session Variables System (Generic)

**Priority**: High (Foundation)
**Scope**: All session types

### Tasks

1. **Add Variables to ContainerSession base class**
   - File: `backend/src/Maestro.Domain/Entities/ContainerSession.cs`
   ```csharp
   // Generic key-value store - no predefined keys
   public Dictionary<string, object> Variables { get; protected set; } = new();

   public void SetVariable(string key, object value)
   {
       Variables[key] = value;
       UpdatedAt = DateTime.UtcNow;
       RecordEvent(SessionEvent.Info($"Variable set: {key}"));
   }

   public T GetVariable<T>(string key, T defaultValue = default)
   {
       return Variables.TryGetValue(key, out var value) && value is T typed
           ? typed
           : defaultValue;
   }

   public bool HasVariable(string key) => Variables.ContainsKey(key);

   public void RemoveVariable(string key)
   {
       if (Variables.Remove(key))
       {
           UpdatedAt = DateTime.UtcNow;
           RecordEvent(SessionEvent.Info($"Variable removed: {key}"));
       }
   }
   ```

2. **Update all session DTOs**
   - Add `Variables` property to `FoundrySessionDto`, `ProjectSessionDto`
   - Include in serialization

3. **Update repositories**
   - Include Variables in JSON persistence

4. **Add API endpoints**
   ```csharp
   // Generic endpoints for any session type
   [HttpGet("sessions/{id}/variables")]
   [HttpGet("sessions/{id}/variables/{key}")]
   [HttpPut("sessions/{id}/variables/{key}")]
   [HttpDelete("sessions/{id}/variables/{key}")]
   ```

5. **Add CLI commands**
   ```javascript
   // tools/maestro-cli/index.js
   // session vars <id> list
   // session vars <id> get <key>
   // session vars <id> set <key> <value>
   // session vars <id> set <key> --json '{...}'
   // session vars <id> remove <key>
   ```

### Acceptance Criteria
- [ ] Variables work on FoundrySession
- [ ] Variables work on ProjectSession
- [ ] Variables work on Workspace
- [ ] CLI commands functional
- [ ] Variables persist across restart

---

## WP2: Maestro Shell (Generic)

**Priority**: High
**Scope**: All users

### Tasks

1. **Create shell module**
   - File: `tools/maestro-cli/shell.js`
   ```javascript
   const readline = require('readline');
   const { execCommand } = require('./index.js');

   class MaestroShell {
     constructor() {
       this.rl = readline.createInterface({
         input: process.stdin,
         output: process.stdout,
         prompt: 'maestro> ',
         historySize: 100
       });
     }

     async start() {
       this.printBanner();
       this.rl.prompt();

       this.rl.on('line', async (line) => {
         const trimmed = line.trim();
         if (trimmed === 'exit' || trimmed === 'quit') {
           console.log('\nGoodbye!');
           process.exit(0);
         }
         if (trimmed) {
           await this.executeCommand(trimmed);
         }
         this.rl.prompt();
       });
     }

     async executeCommand(line) {
       // Parse and route to existing command handlers
       const args = this.parseArgs(line);
       try {
         await execCommand(args);
       } catch (error) {
         console.error(`Error: ${error.message}`);
       }
     }
   }
   ```

2. **Update CLI entry point**
   ```javascript
   // index.js
   if (!argv._[0]) {
     const { MaestroShell } = require('./shell.js');
     const shell = new MaestroShell();
     return shell.start();
   }
   ```

3. **Add banner and help**
   - ASCII art banner
   - Help command showing all available commands

### Acceptance Criteria
- [ ] `maestro` (no args) launches shell
- [ ] All existing commands work
- [ ] History works (up/down arrows)
- [ ] `exit` exits cleanly

---

## WP3: Monitor Shell Framework (Generic with Pluggable Widgets)

**Priority**: High
**Scope**: All sessions

### Tasks

1. **Create monitor framework**
   - File: `tools/maestro-cli/monitor/monitor.js`
   ```javascript
   class MonitorShell {
     constructor(sessionId, apiClient) {
       this.sessionId = sessionId;
       this.client = apiClient;
       this.refreshInterval = 2000;
       this.showWidgets = true;
     }

     async start() {
       // Hide cursor, start refresh loop
       process.stdout.write('\x1B[?25l');
       await this.refresh();
       this.intervalId = setInterval(() => this.refresh(), this.refreshInterval);
       this.setupKeyboardHandlers();
     }

     async refresh() {
       const session = await this.client.getSession(this.sessionId);
       this.render(session);
     }

     render(session) {
       process.stdout.write('\x1B[2J\x1B[0;0H'); // Clear screen
       this.renderHeader(session);
       this.renderVariables(session);
       this.renderExecutionTree(session);
       this.renderEvents(session);
       if (this.showWidgets) {
         this.renderWidgets(session);
       }
       this.renderControls();
     }

     renderWidgets(session) {
       const widgetConfigs = session.monitorWidgets || [];
       if (widgetConfigs.length === 0) {
         console.log('\n  Custom Widgets: (none registered)\n');
         return;
       }

       console.log('\n  Custom Widgets:\n');
       for (const config of widgetConfigs) {
         const widget = this.createWidget(config);
         widget.render(session);
       }
     }

     createWidget(config) {
       // Factory for widget types
       const WidgetClass = WIDGET_TYPES[config.type];
       return new WidgetClass(config);
     }
   }
   ```

2. **Create generic widget types**
   - File: `tools/maestro-cli/monitor/widgets/`
   ```javascript
   // progress-bar.js
   class ProgressBarWidget {
     constructor(config) {
       this.label = config.config.label;
       this.currentPath = config.config.current; // e.g., "$.variables.phase"
       this.maxPath = config.config.max;
     }

     render(session) {
       const current = this.resolvePath(session, this.currentPath);
       const max = this.resolvePath(session, this.maxPath);
       const percent = (current / max) * 100;
       const filled = Math.round(percent / 5);
       const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
       console.log(`  ${this.label}: ${bar} ${current}/${max}`);
     }

     resolvePath(session, path) {
       // Resolve "$.variables.xxx" to actual value
       if (path.startsWith('$.variables.')) {
         const key = path.replace('$.variables.', '');
         return session.variables?.[key];
       }
       return path; // literal value
     }
   }

   // score-chart.js
   class ScoreChartWidget { ... }

   // counter.js
   class CounterWidget { ... }

   // status-list.js
   class StatusListWidget { ... }
   ```

3. **Add widget registration to session**
   - Sessions can define `monitorWidgets` in their config
   - Stored in session metadata or variables

4. **Add CLI command**
   ```javascript
   if (cmd === 'monitor') {
     const sessionId = argv._[1];
     const monitor = new MonitorShell(sessionId, client);
     return monitor.start();
   }
   ```

### Acceptance Criteria
- [ ] `monitor <id>` works for any session
- [ ] Generic zones display correctly (variables, tree, events)
- [ ] Sessions without widgets show "none registered"
- [ ] Sessions with widgets render them
- [ ] Widget types are reusable (same progress-bar works for any session)

---

## WP4: Entry Points Mechanism (Generic)

**Priority**: Medium
**Scope**: All sessions

### Tasks

1. **Add EntryPoints to Session**
   ```csharp
   // In Session.cs
   public Dictionary<string, string> EntryPoints { get; protected set; } = new();

   public void RegisterEntryPoint(string name, string workflowId)
   {
       EntryPoints[name] = workflowId;
   }

   public string GetEntryPoint(string name)
   {
       return EntryPoints.TryGetValue(name, out var wf) ? wf : null;
   }
   ```

2. **Add API endpoint**
   ```csharp
   [HttpGet("sessions/{id}/entry-points")]
   [HttpPost("sessions/{id}/invoke/{entryPoint}")]
   ```

3. **Add CLI commands**
   ```bash
   maestro session entry-points <id>
   maestro session invoke <id> <entry-point> [--input key=value]
   ```

### Acceptance Criteria
- [ ] Entry points can be registered
- [ ] `session invoke` triggers the mapped workflow
- [ ] Works for any session type

---

## WP5: Block Approval System (Generic)

**Priority**: High
**Scope**: Any session that publishes blocks

### Tasks

1. **Create PendingBlockApproval entity**
   - File: `backend/src/Maestro.Domain/Entities/PendingBlockApproval.cs`
   ```csharp
   public class PendingBlockApproval
   {
       public string Id { get; private set; }
       public string BlockId { get; private set; }
       public string BlockName { get; private set; }
       public string BlockType { get; private set; }
       public BlockDefinition BlockDefinition { get; private set; }
       public string SourceSessionId { get; private set; }
       public ApprovalStatus Status { get; private set; }
       public string? RejectionReason { get; private set; }
       public Dictionary<string, object> Metadata { get; private set; }
       public DateTime SubmittedAt { get; private set; }
       public DateTime? ReviewedAt { get; private set; }
   }
   ```

2. **Create repository**
   - File: `backend/src/Maestro.Infrastructure/Repositories/FileSystemPendingApprovalRepository.cs`

3. **Create service**
   ```csharp
   public interface IBlockApprovalService
   {
       Task<PendingBlockApproval> SubmitAsync(string blockId, string sessionId, Dictionary<string, object> metadata);
       Task<IEnumerable<PendingBlockApproval>> GetPendingAsync();
       Task<PendingBlockApproval> ApproveAsync(string id);
       Task<PendingBlockApproval> RejectAsync(string id, string reason);
   }
   ```

4. **Create API controller**
   - File: `backend/src/Maestro.Api/Controllers/BlockApprovalController.cs`

5. **Add CLI commands**
   ```bash
   maestro block publish <id> --from-session <session-id>
   maestro block --pending-approval
   maestro block info <pending-id>
   maestro block approve <pending-id>
   maestro block reject <pending-id> --reason "..."
   ```

6. **Store rejection in session repo**
   - When rejected, write reason to `{session-repo}/rejections/{id}.json`
   - Available for session to read and iterate

### Acceptance Criteria
- [ ] Any session can submit blocks for approval
- [ ] Pending list shows all pending blocks
- [ ] Approve publishes to global catalog
- [ ] Reject stores feedback

---

## WP6: Widget Registration Storage (Generic)

**Priority**: Medium
**Scope**: Sessions that want custom monitor widgets

### Tasks

1. **Add MonitorWidgets to Session**
   ```csharp
   public List<MonitorWidgetConfig> MonitorWidgets { get; protected set; } = new();

   public void RegisterWidget(MonitorWidgetConfig config)
   {
       MonitorWidgets.Add(config);
   }
   ```

2. **Define MonitorWidgetConfig**
   ```csharp
   public class MonitorWidgetConfig
   {
       public string Id { get; set; }
       public string Type { get; set; } // "progress-bar", "score-chart", etc.
       public Dictionary<string, object> Config { get; set; }
   }
   ```

3. **Update DTOs and persistence**

4. **Add CLI commands**
   ```bash
   maestro session widgets <id> list
   maestro session widgets <id> add --type progress-bar --config '{...}'
   maestro session widgets <id> remove <widget-id>
   ```

### Acceptance Criteria
- [ ] Widgets can be registered on sessions
- [ ] Widgets persist across restart
- [ ] Monitor shell reads and renders them

---

# PART B: SAMPLE SESSION CONTENT

These are specific to the "Generate Commit Tool" session example.

---

## WP7: Sample Session Template (Optional)

**Priority**: Low (can be done manually)
**Scope**: Example/Template

### Tasks

1. **Create session template**
   - File: `templates/generate-tool-foundry/`
   ```
   templates/generate-tool-foundry/
   ├── template.json              # Template metadata
   ├── variables.json             # Default variables
   ├── entry-points.json          # Default entry points
   ├── widgets.json               # Custom widgets
   └── blocks/
       ├── three-phase-pipeline.workflow.json
       ├── creation-phase.workflow.json
       ├── optimization-phase.workflow.json
       ├── publication-phase.workflow.json
       ├── creator-context.context.json
       ├── evaluator.inference.json
       └── scripts/
           └── test-case-generator.py
   ```

2. **Template metadata**
   ```json
   {
     "id": "generate-tool-foundry",
     "name": "Generate Tool Training Template",
     "description": "3-phase pipeline for creating and optimizing tools",
     "sessionType": "foundry"
   }
   ```

3. **Add template import command**
   ```bash
   maestro session import <session-id> --template <template-name>
   ```

### Acceptance Criteria
- [ ] Template can be imported into a session
- [ ] All blocks and config are copied

---

## WP8: Sample Session Workflows (Session-Specific Content)

**Priority**: Medium
**Scope**: This specific session only

### Tasks

1. **Create three-phase-pipeline workflow**
   - Orchestrates the 3 phases
   - Updates `currentPhase` variable

2. **Create creation-phase workflow**
   - While loop with creator agent
   - Test and evaluate sub-workflow

3. **Create optimization-phase workflow**
   - Optimization loop
   - Version control for rollback

4. **Create publication-phase workflow**
   - Final validation
   - Package and publish

5. **Create creator-context block**
   - Specific system prompt for this task

6. **Create evaluator inference block**
   - Specific evaluation criteria for commit messages

7. **Create test-case-generator script**
   - Python script with git output examples

### Note

These are NOT system blocks. They are:
- Part of a template (optional)
- Created manually by the user
- Or created by an AI during session

---

# PART C: IMPLEMENTATION ORDER

## Recommended Sequence

```
Phase 1: Core Infrastructure
├── WP1: Session Variables (foundation)
├── WP2: Maestro Shell (user interface)
└── WP4: Entry Points (workflow triggering)

Phase 2: Monitoring & Approval
├── WP3: Monitor Shell Framework
├── WP6: Widget Registration
└── WP5: Block Approval System

Phase 3: Sample Session (Optional)
├── WP7: Session Template
└── WP8: Sample Workflows
```

## Dependency Graph

```
WP1 (Variables) ──────┬──────────────────────────┐
                      │                          │
WP2 (Shell) ──────────┤                          │
                      │                          │
WP4 (Entry Points) ───┼──► Can test basic flow   │
                      │                          │
WP6 (Widgets) ────────┤                          │
                      │                          │
WP3 (Monitor) ────────┼──► Full monitoring       │
                      │                          │
WP5 (Approval) ───────┼──► Publication workflow  │
                      │                          │
                      └──────────────────────────┼──► WP7/WP8 (Sample)
```

---

## File Changes Summary

### New Files (Generic Infrastructure)

```
tools/maestro-cli/
├── shell.js                          # WP2: Interactive shell
└── monitor/
    ├── monitor.js                    # WP3: Monitor framework
    └── widgets/
        ├── progress-bar.js           # WP3: Widget type
        ├── score-chart.js            # WP3: Widget type
        ├── counter.js                # WP3: Widget type
        └── status-list.js            # WP3: Widget type

backend/src/Maestro.Domain/
├── Entities/
│   └── PendingBlockApproval.cs       # WP5: Approval entity
└── ValueObjects/
    └── MonitorWidgetConfig.cs        # WP6: Widget config

backend/src/Maestro.Infrastructure/
└── Repositories/
    └── FileSystemPendingApprovalRepository.cs  # WP5

backend/src/Maestro.Application/
└── Services/
    └── BlockApprovalService.cs       # WP5

backend/src/Maestro.Api/
└── Controllers/
    └── BlockApprovalController.cs    # WP5
```

### New Files (Sample Session - Optional)

```
templates/generate-tool-foundry/      # WP7/WP8
├── template.json
├── variables.json
├── entry-points.json
├── widgets.json
└── blocks/
    └── (session-specific workflows)
```

### Modified Files

```
backend/.../ContainerSession.cs       # WP1: Add Variables
backend/.../Session.cs                # WP4: Add EntryPoints, WP6: Add MonitorWidgets
backend/.../*SessionDto.cs            # WP1, WP4, WP6: Add new properties
backend/.../Program.cs                # WP5: Register services
tools/maestro-cli/index.js            # WP1-6: Add new commands
```

---

## Success Criteria

### Generic Infrastructure Complete When:
- [ ] `maestro` launches interactive shell
- [ ] Any session can have variables
- [ ] Any session can define entry points
- [ ] Any session can register monitor widgets
- [ ] Monitor works for ANY session (shows generic + custom widgets)
- [ ] Any session can publish blocks for approval

### Sample Session Complete When:
- [ ] Template can be imported
- [ ] Session runs through all 3 phases
- [ ] Block is submitted for approval
- [ ] (Optional) Published tool works correctly

---

*This plan correctly separates generic infrastructure from session-specific content.*
