# Maestro TUI Monitor

**Overview**: Real-time terminal UI for monitoring session execution.

---

## Display Modes

The TUI Monitor adapts its display based on session state and configuration:

| Mode | When Active | Purpose |
|------|-------------|---------|
| **idle** | No workflow running | Show variables, files, command history |
| **execution** | Workflow running, no descriptor | Show workflow tree, files, widgets |
| **descriptor** | `_monitorDescriptor` variable present | Custom layout defined by session |

---

## Display Descriptors

Sessions control their TUI appearance by writing a `_monitorDescriptor` variable. This descriptor specifies:
- Layout zones (left, right, bottom)
- Components to display in each zone
- Data bindings for each component

### Example Descriptor

```json
{
  "layout": {
    "mode": "phased",
    "zones": {
      "left":   { "width": "40%", "components": ["phases", "workflow-tree"] },
      "right":  { "width": "60%", "components": ["block-detail", "metrics"] },
      "bottom": { "height": "30%", "components": ["execution-log", "artifacts"] }
    }
  },
  "components": [
    { "id": "phases",        "type": "phase-list",     "data": "$.variables._phases" },
    { "id": "workflow-tree", "type": "workflow-tree",  "data": "$.variables._executionTree" },
    { "id": "block-detail",  "type": "block-detail",   "data": "$.variables._activeBlock" }
  ]
}
```

---

## Layout Zones

Zones define screen regions:

| Zone | Typical Width/Height | Position |
|------|----------------------|----------|
| `left` | 30-50% width | Left side of screen |
| `right` | 50-70% width | Right side of screen |
| `bottom` | 20-40% height | Bottom of screen (full width) |

Components in a zone are stacked vertically.

---

## Available Components

### phase-list
Displays session phases with status indicators.

**Data**: Array of `{ id, name, status, progress, description }`

### workflow-tree
Shows execution tree with node statuses.

**Data**: Array of execution tree nodes

### block-detail
Details of currently executing block (output, logs, metadata).

**Data**: Object `{ id, name, type, status, output, logs, metadata }`

### metrics-panel
Displays session metrics (fitness, iteration, score history).

**Data**: Object with multiple variable paths

### execution-log
Scrollable log of execution events.

**Data**: Array of `{ time, level, msg }`

### artifacts
Files produced by the session.

**Data**: Array of `{ name, type, size, status }`

---

## Custom Widgets

Sessions can also define custom widgets in the template's `monitorWidgets` array:

```json
{
  "monitorWidgets": [
    {
      "id": "fitness-progress",
      "type": "progress-bar",
      "zone": "custom",
      "config": {
        "label": "Fitness Score",
        "current": "$.variables.currentFitness",
        "max": 1.0
      }
    }
  ]
}
```

---

## Widget Data Binding

Components bind to session data via JSONPath-like expressions:

```json
"data": "$.variables._phases"               // Single path
"data": {                                   // Multiple paths
  "fitness": "$.variables.currentFitness",
  "iteration": "$.variables.currentIteration"
}
```

The monitor resolves these paths every refresh (default: 2 seconds).

---

## Opening the Monitor

```bash
# Default layout
maestro monitor <session-id>

# Specific layout
maestro monitor <session-id> --layout workflow
maestro monitor <session-id> --layout idle

# Multi-session split view
maestro monitor --sessions <id1>,<id2> --split horizontal
```

---

*"Sessions describe what to show. TUI shows it."*
