# ADR — Conversation Management: Workflow-Driven Persistent Conversations

> **Date**: 2026-02-27
> **Status**: Accepted
> **Context**: Dogfooding session revealed that maestro-code TUI has zero conversation continuity between messages, and creates a new backend session on every TUI launch.

---

## Problem Statement

Three related problems:

1. **No conversation memory**: Each user message triggers a new `AgentBlockExecutor.ExecuteAsync()` which creates a fresh `IConversationManager` conversation, executes, then destroys it. The agent has no memory of previous messages.

2. **Session pollution**: Every TUI launch creates a new backend session. After N uses, the Spaces > Sessions tab is full of `"Cantante — Assistant"` duplicates.

3. **No conversation lifecycle**: No way to start a new conversation, switch between conversations, or clear context — because the concept of a persistent conversation doesn't exist.

---

## Decision: Option B — Workflow-Driven Conversation

The conversation lifecycle is managed by **workflow nodes** (conversation block operations), not by the agent executor internally.

### Architecture

```
Session (1 per repo, persistent across TUI restarts)
└── Entry point "message" → Workflow:
    ┌─────────────────────────────────────────────────────┐
    │ 1. [conversation block] operation: "get-messages"   │
    │    input: conversationId = {{_activeConversation}}   │
    │    output: → {{_conversationHistory}}                │
    │                                                     │
    │ 2. [agent block] maestro-assistant                  │
    │    input: message, repoPath, conversationHistory    │
    │    output: → {{_agentResponse}}                     │
    │                                                     │
    │ 3. [conversation block] operation: "add-message"    │
    │    input: conversationId, role="user", content=msg  │
    │                                                     │
    │ 4. [conversation block] operation: "add-message"    │
    │    input: conversationId, role="assistant",          │
    │           content={{_agentResponse}}                 │
    └─────────────────────────────────────────────────────┘
```

### Why Option B Over Option A

Option A (session variables only, conversation managed by TUI) was considered but rejected:

| Criterion | Option A (TUI-managed) | Option B (Workflow-managed) |
|-----------|----------------------|---------------------------|
| **Maestro philosophy** | TUI owns conversation logic — violates "infrastructure is generic" | Workflow owns it — conversation is content, not infrastructure |
| **Block reuse** | Conversation block unused | Conversation block is a first-class workflow participant |
| **Composability** | Hardcoded in SessionManager.ts | Any workflow can use conversation nodes — not just the assistant |
| **Testability** | Must test TUI to verify | Workflow is testable via CLI `session invoke` |
| **Visibility** | Conversation operations are invisible | Each step appears in `_executionTree` — observable in monitor |
| **Extensibility** | Adding summarization requires TUI changes | Add a `summarize` node between get-messages and agent — zero TUI changes |

**Key principle**: The TUI is a thin client. It sends messages and renders results. All intelligence is in the workflow.

---

## Design Details

### 1. Session Persistence (One Session Per Repo)

The TUI persists the active session ID locally:

```
<repo>/.maestro/session.json
{
  "sessionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "createdAt": "2026-02-27T...",
  "template": "maestro-assistant"
}
```

**On TUI launch**:
1. Read `.maestro/session.json`
2. If exists → verify session still exists on backend (`GET /api/sessions/{id}`)
   - Exists → reuse
   - Gone → create new, update file
3. If not exists → create new session, write file

**Benefit**: No session pollution. One session per repo. Conversation history preserved across TUI restarts.

### 2. Conversation Lifecycle Within a Session

A session variable `_activeConversation` holds the current conversation ID. A session variable `_conversations` holds the full list.

```json
{
  "_activeConversation": "conv-abc123",
  "_conversations": [
    { "id": "conv-abc123", "name": "General", "createdAt": "...", "messageCount": 12 },
    { "id": "conv-def456", "name": "Refactoring auth", "createdAt": "...", "messageCount": 5 }
  ]
}
```

#### `/new` — New Conversation

1. TUI sends: `invoke "new-conversation"` (new entry point)
2. Workflow:
   - `[conversation block]` operation: `create` → returns new `conversationId`
   - `[set-variable]` `_activeConversation` = new ID
   - `[set-variable]` append to `_conversations` list

#### `/switch` — Switch Conversation

1. TUI reads `_conversations` from session variables
2. Displays a picker (inline widget or slash command output)
3. TUI sends: `invoke "switch-conversation"` with input `conversationId`
4. Workflow:
   - `[set-variable]` `_activeConversation` = chosen ID

#### `/clear` — Clear Current Conversation

1. TUI sends: `invoke "clear-conversation"`
2. Workflow:
   - `[conversation block]` operation: `cleanup` (destroy old)
   - `[conversation block]` operation: `create` (new empty one)
   - `[set-variable]` `_activeConversation` = new ID
   - `[set-variable]` update entry in `_conversations`

### 3. Updated Entry Point "message" Workflow

The `maestro-assistant` template changes from a **direct agent block** to a **workflow block** with conversation management nodes:

```json
{
  "id": "maestro-assistant-workflow",
  "name": "Maestro Assistant Workflow",
  "blockType": "workflow",
  "config": {
    "nodes": [
      {
        "id": "ensure-conversation",
        "type": "conditional",
        "condition": "{{_activeConversation}} != null",
        "else": {
          "nodes": [
            {
              "id": "create-initial-conversation",
              "blockRef": "conversation",
              "inputs": { "operation": "create" }
            },
            {
              "id": "set-active-conversation",
              "type": "set-variable",
              "variable": "_activeConversation",
              "value": "{{_nodeResult_create-initial-conversation.conversationId}}"
            }
          ]
        }
      },
      {
        "id": "save-user-message",
        "blockRef": "conversation",
        "inputs": {
          "operation": "add-message",
          "conversationId": "{{_activeConversation}}",
          "role": "user",
          "content": "{{message}}"
        }
      },
      {
        "id": "load-history",
        "blockRef": "conversation",
        "inputs": {
          "operation": "get-messages",
          "conversationId": "{{_activeConversation}}"
        }
      },
      {
        "id": "execute-agent",
        "blockRef": "system:maestro-assistant",
        "inputs": {
          "message": "{{message}}",
          "repoPath": "{{repoPath}}",
          "conversationHistory": "{{_nodeResult_load-history.messages}}"
        }
      },
      {
        "id": "save-assistant-response",
        "blockRef": "conversation",
        "inputs": {
          "operation": "add-message",
          "conversationId": "{{_activeConversation}}",
          "role": "assistant",
          "content": "{{_nodeResult_execute-agent}}"
        }
      }
    ]
  }
}
```

### 4. Agent Block Changes

The `AgentBlockExecutor` needs one change: when `conversationHistory` input is provided, **seed the conversation with those messages** instead of starting empty.

In `AgentBlockExecutor.ExecuteAsync()`:
```csharp
var conversationId = _conversationManager.CreateConversation(systemPrompt);

// Restore history if provided
var historyJson = context.Inputs.GetValueOrDefault("conversationHistory");
if (!string.IsNullOrEmpty(historyJson?.ToString()))
{
    var messages = JsonSerializer.Deserialize<List<ChatMessage>>(historyJson.ToString());
    foreach (var msg in messages)
        _conversationManager.AddMessage(conversationId, msg.Role, msg.Content);
}

// Then add the current user message
_conversationManager.AddMessage(conversationId, "user", userContent);
```

The agent executor still creates and destroys its working conversation per invocation — that's fine. The **persistent** conversation is managed by the workflow nodes (conversation block), not by the executor.

### 5. Conversation Persistence: FileSystem vs In-Memory

`InMemoryConversationManager` loses all data when the backend restarts. This must evolve:

**Phase 1 (immediate)**: Keep in-memory, but the workflow serializes conversation messages into session variables (`_conversationMessages_{id}`). The `get-messages` operation checks session variables first, memory second. Pragmatic, works today.

**Phase 2 (later)**: `FileSystemConversationManager` persists to `data/conversations/{id}.json`. Registered alongside or replacing the in-memory version. Clean separation.

Phase 1 is sufficient for V1 because session variables are already persisted to disk by the session repository.

### 6. Updated Session Template

```json
{
  "id": "maestro-assistant",
  "entryPoints": {
    "message": "maestro-assistant-workflow",
    "new-conversation": "maestro-new-conversation-workflow",
    "switch-conversation": "maestro-switch-conversation-workflow",
    "clear-conversation": "maestro-clear-conversation-workflow"
  },
  "variables": {
    "_activeConversation": null,
    "_conversations": [],
    "_phases": [
      { "id": "receive", "name": "Receive", "status": "pending" },
      { "id": "context", "name": "Load Context", "status": "pending" },
      { "id": "execute", "name": "Execute", "status": "pending" },
      { "id": "respond", "name": "Respond", "status": "pending" }
    ]
  }
}
```

---

## Impact on Existing Code

| Component | Change Required |
|-----------|----------------|
| `SessionManager.ts` (TUI) | Read/write `.maestro/session.json`. Add `/new`, `/switch`, `/clear` as invoke calls. |
| `App.ts` (TUI) | Parse slash commands, dispatch to SessionManager methods |
| `maestro-assistant.session.json` | Add entry points, variables, phases |
| `maestro-assistant-workflow.block.json` | **New file** — workflow wrapping the agent |
| `maestro-assistant.agent.block.json` | No change (already has `conversationHistory` input) |
| `AgentBlockExecutor.cs` | Seed conversation from `conversationHistory` input |
| `ConversationBlockExecutor.cs` | Possibly add `get-messages` output formatting for workflow consumption |
| `InMemoryConversationManager.cs` | No change (Phase 1 uses session variables for persistence) |
| `EntryPointExecutor.cs` | No change (already supports workflow dispatch with `config.nodes`) |

**Zero infrastructure changes** — everything is content (workflow JSON, template JSON, block inputs). This validates the architecture.

---

## Litmus Tests

1. **Can a new conversation command be added without C# changes?** → Yes. Add a new workflow block JSON + entry point in template. ✓
2. **Can the conversation strategy be changed without C# changes?** → Yes. Modify workflow nodes (add summarization, RAG, etc.). ✓
3. **Is the conversation visible in the monitor?** → Yes. Each workflow node appears in `_executionTree`. ✓
4. **Can the agent be swapped without affecting conversation management?** → Yes. Change `blockRef` in the workflow. ✓
5. **Does this work for non-assistant sessions?** → Yes. Any session can use conversation blocks in its workflow. ✓

---

## Rejected Alternatives

### Option A: TUI-Managed Conversation (Session Variables Only)

The TUI would store conversation messages directly as session variables and pass them to the agent. Rejected because:
- Puts logic in the TUI (thin client violation)
- Conversation operations are invisible to the execution tree
- Cannot compose with other blocks (summarization, RAG)
- Untestable without the TUI

### Direct Agent Memory (Agent Executor Persistence)

The `AgentBlockExecutor` would maintain persistent conversations across invocations. Rejected because:
- Violates "executor is mechanical plumbing" — executor would own state
- Ties conversation lifecycle to executor implementation
- Not composable — only agents get conversations, not other block types
- Cross-session sharing impossible

---

## References

- `docs/phases/PHASE-26/REFACTORING-AGENT-INFERENCE-MERGE.md` — Agent as composite block
- `docs/phases/PHASE-18/ADR-BLOCKS-ARE-THE-UNIVERSAL-UNIT.md` — Everything is a block
- `content/system/blocks/infrastructure/conversation.block.json` — Existing conversation block
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ConversationBlockExecutor.cs` — Existing executor
- `docs/phases/dogfood-notes-2026-02-27-v1-gaps.md` — Dogfooding findings
