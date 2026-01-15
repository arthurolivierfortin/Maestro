---
description: "Issue tracking and task completion guidelines for AI agents working on B-One Maestro"
applyTo: "**/*"
---

# Issue Tracking & Task Completion Guidelines

This document defines mandatory rules for AI agents working on B-One Maestro. All agents MUST follow these guidelines when implementing features, fixing bugs, or making any changes to the codebase.

## 🔴 MANDATORY: Issue File Verification

### Before Starting ANY Task

1. **Check for related issue file** in `docs/issues/`
2. **Read the complete issue file** before making changes
3. **Understand acceptance criteria** defined in the issue
4. **Verify dependencies** are complete before starting

### Issue File Locations

```
docs/issues/
├── phase-4*.md      # Frontend phases
├── phase-5*.md      # Backend execution phases  
├── phase-6*.md      # Unified architecture phases
└── ...
```

### Finding the Right Issue

When given a task, agents MUST:

1. Identify which phase the task belongs to
2. Read the corresponding issue file
3. Find the specific task section
4. Verify prerequisites are met

**Example:**
- Task: "Complete the BlocksController CRUD endpoints"
- Phase: 6A
- Issue File: `docs/issues/phase-6a-unified-block-source.md`
- Task Section: "6A.2 Complete BlocksController CRUD"

---

## 🔴 MANDATORY: Task Completion Updates

### After Completing ANY Task

1. **Mark task as complete** in the issue file
2. **Update ROADMAP.md** if completing a major milestone
3. **Update progress indicators** if applicable

### Marking Tasks Complete

In issue files, change checkbox from unchecked to checked:

**Before:**
```markdown
- [ ] Implement `GET /api/blocks` - List all blocks with filtering
```

**After:**
```markdown
- [x] Implement `GET /api/blocks` - List all blocks with filtering
```

### Updating ROADMAP.md

When completing a phase or major milestone:

1. Update phase status (e.g., `Not Started` → `In Progress` → `Complete`)
2. Update `Last Updated` date at bottom of file
3. Mark relevant task checkboxes as complete

---

## 📋 Issue File Structure Reference

All issue files follow this structure:

```markdown
# Phase XX: Title

**Phase**: XX
**Priority**: Critical/High/Medium/Low
**Duration**: X weeks
**Team**: Backend/Frontend/Tools
**Dependencies**: Phase Y complete
**Blocks**: Phase Z
**Status**: Not Started/In Progress/Complete

---

## Overview
[Description of what this phase accomplishes]

## Current Problem
[What's wrong with current state]

## Tasks

### XX.1 Task Group Name
- [ ] Specific task 1
- [ ] Specific task 2
- [ ] Specific task 3

### XX.2 Another Task Group
- [ ] Task A
- [ ] Task B

## Acceptance Criteria
1. [ ] Criterion 1
2. [ ] Criterion 2

## Files to Create/Modify
- `path/to/file.ts`
- `path/to/another.cs`
```

---

## 🔄 Workflow for Agents

### Standard Task Workflow

```
1. RECEIVE task from user
       ↓
2. IDENTIFY related phase/issue
       ↓
3. READ issue file completely
       ↓
4. CHECK dependencies are complete
       ↓
5. IMPLEMENT the solution
       ↓
6. TEST the implementation
       ↓
7. MARK task complete in issue file
       ↓
8. UPDATE ROADMAP if needed
       ↓
9. COMMIT with proper message
```

### Example Commit Messages

Following [git-workflow.instructions.md](./git-workflow.instructions.md):

```bash
# Feature completion
feat(api): implement BlocksController CRUD endpoints [6A.2]

# Bug fix
fix(api): correct null reference in block discovery [6A.3]

# Documentation
docs: update issue file with completed tasks [6A]
```

---

## ⚠️ Critical Rules

### DO

✅ Read the issue file before starting work  
✅ Mark tasks complete immediately after finishing  
✅ Update ROADMAP.md when completing milestones  
✅ Reference the task ID in commit messages (e.g., `[6A.2]`)  
✅ Verify acceptance criteria are met  
✅ Check for dependencies before starting  

### DO NOT

❌ Start work without reading the issue file  
❌ Complete tasks without updating the issue file  
❌ Skip acceptance criteria verification  
❌ Ignore dependency requirements  
❌ Make changes outside the scope of the task  
❌ Forget to update the `Last Updated` date  

---

## 🔍 Quick Reference: Phase 6 Tasks

### Phase 6A: Unified Block Source
- `docs/issues/phase-6a-unified-block-source.md`
- Tasks: 6A.1 → 6A.6
- Focus: Backend as single filesystem reader

### Phase 6B: Discovery API
- `docs/issues/phase-6b-discovery-api.md`
- Tasks: 6B.1 → 6B.10
- Focus: Complete `/api/discovery` endpoints

### Phase 6C: CLI/MCP Migration
- `docs/issues/phase-6c-cli-mcp-api-clients.md`
- Tasks: 6C.1 → 6C.9
- Focus: Migrate CLI/MCP to use API

### Phase 6D: Frontend Real Integration
- `docs/issues/phase-6d-frontend-real-integration.md`
- Tasks: 6D.1 → 6D.10
- Focus: Frontend uses real backend

### Phase 6E: Docker Preparation
- `docs/issues/phase-6e-docker-preparation.md`
- Tasks: 6E.1 → 6E.10
- Focus: Docker deployment support

---

## 📊 Progress Tracking

### Progress Bar Calculation

When updating ROADMAP.md progress bars:

| Completion | Bar |
|------------|-----|
| 0% | `[░░░░░░░░░░]  0%` |
| 20% | `[██░░░░░░░░] 20%` |
| 50% | `[█████░░░░░] 50%` |
| 80% | `[████████░░] 80%` |
| 100% | `[██████████] 100%` |

### Status Values

- `Not Started` - No work begun
- `In Progress` - Actively being worked on
- `Blocked` - Waiting on dependency
- `Complete` - All tasks done, acceptance criteria met

---

## 🧪 Verification Checklist

Before marking a task complete:

- [ ] Code compiles without errors
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] Code follows conventions in `code-conventions.instructions.md`
- [ ] Changes respect Clean Architecture rules
- [ ] Issue file task checkbox updated
- [ ] ROADMAP.md updated (if milestone)
- [ ] Commit message follows conventional format
- [ ] PR description ready (if applicable)

---

## 📚 Related Instructions

- [code-conventions.instructions.md](./code-conventions.instructions.md) - Naming and style
- [clean-architecture.instructions.md](./clean-architecture.instructions.md) - Layer rules
- [git-workflow.instructions.md](./git-workflow.instructions.md) - Commits and branches
- [testing.instructions.md](./testing.instructions.md) - Test requirements

---

**Remember**: The issue files are the source of truth for what needs to be done. Always consult them before starting work and update them when work is complete.
