# Complete Task Prompt

> Use this prompt when you have finished implementing a task from the ROADMAP.

## Instructions

After completing a task or set of tasks, you MUST update the project documentation:

### 1. Update ROADMAP.md

1. **Find the task** in `ROADMAP.md` using the phase/task ID (e.g., `4f.2`)
2. **Mark as complete**: Change `- [ ]` to `- [x]`
3. **Update progress bar**: Recalculate the phase percentage and update the bar
4. **Update timestamp**: Change `Last Updated` date at the top of the file

#### Progress Bar Reference

| % Complete | Bar |
|------------|-----|
| 0% | `[░░░░░░░░░░]  0%` |
| 10% | `[█░░░░░░░░░] 10%` |
| 20% | `[██░░░░░░░░] 20%` |
| 30% | `[███░░░░░░░] 30%` |
| 40% | `[████░░░░░░] 40%` |
| 50% | `[█████░░░░░] 50%` |
| 60% | `[██████░░░░] 60%` |
| 70% | `[███████░░░] 70%` |
| 80% | `[████████░░] 80%` |
| 90% | `[█████████░] 90%` |
| 100% | `[██████████] 100%` |

### 2. Commit Message Format

Use task reference in commit message:

```
feat(scope): description [PHASE.TASK]

Example:
feat(ui): implement Foundry page layout [4f.2]
fix(store): add missing block filter methods [4f.3]
```

### 3. Example Update

**Before:**
```markdown
## 🔷 Phase 4f: Frontend Refactor & Foundry Page
...
#### 4f.2 Foundry Page Foundation
- [ ] Create `FoundryPage.tsx` with layout structure
- [ ] Create `FoundrySidebar.tsx` with category filters
```

**After completing FoundryPage.tsx:**
```markdown
## 🔷 Phase 4f: Frontend Refactor & Foundry Page
...
#### 4f.2 Foundry Page Foundation
- [x] Create `FoundryPage.tsx` with layout structure
- [ ] Create `FoundrySidebar.tsx` with category filters
```

### 4. Verification Checklist

Before marking a task complete, verify:

- [ ] Implementation is complete and functional
- [ ] Unit tests are written and passing
- [ ] No TypeScript/ESLint errors
- [ ] Code follows conventions in `code-conventions.instructions.md`
- [ ] Component/feature works in the browser (if UI)
- [ ] Changes are committed with proper message format

---

## Task Completion Command

When asked to complete a task, execute these steps:

1. **Read current ROADMAP state**: Check which tasks are already done
2. **Identify completed work**: Match your work to specific task IDs
3. **Update ROADMAP.md**: Mark tasks as `[x]` and update progress bar
4. **Update Last Updated date**: Change to current date
5. **Confirm changes**: Show which tasks were marked complete

## Example Prompt

```
I have completed implementing the FoundryPage component with sidebar and search bar.
Please update the ROADMAP to mark tasks 4f.2 items 1-3 as complete.
```
