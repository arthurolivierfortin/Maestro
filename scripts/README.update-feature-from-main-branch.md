Update Feature From Main Branch - README

Overview
--------
`update-feature-from-main-branch.ps1` is an interactive PowerShell helper that rebases a feature branch onto the latest `origin/development` (or another base branch) while preserving only the commits that belong to the feature branch. It is intended to produce a clean, linear branch ready for a pull request.

Goals
- Keep feature branch history linear (no merge commits)
- Only move commits that are unique to the feature branch
- Avoid accidental updates to `development` or other branches
- Provide safe recovery steps if something goes wrong

Prerequisites
-------------
- You must have `git` available on your PATH and be running the script from the repository root or `scripts/` (the script resolves repo root).
- Your local feature branch should normally track a remote branch (e.g. `origin/feat/...`). The script enforces that local and remote feature branch SHAs match before running to reduce surprises.
- You should have a working network connection to fetch `origin`.

High-level behavior (step-by-step)
----------------------------------
1. Backup: the script creates a safety branch named `backup/<feature>-before-update-YYYYMMDD-HHMMSS` pointing at the current local HEAD for recovery.
2. Fetch: the script runs `git fetch origin --prune` to update remote refs.
3. Sanity check: the script verifies your local `TargetBranch` SHA equals `origin/TargetBranch` SHA. If they differ, the script aborts and asks you to sync manually first.
4. Local changes: if you have uncommitted changes the script offers three choices:
   - `(s)tash` — stash local changes and continue, applying the stash back at the end if you choose.
   - `(c)ommit` — stage & commit local changes with an interactive message.
   - `(a)bort` — stop the script.
5. Rebase: the script performs `git rebase origin/development` (or `origin/$BaseBranch` when specified). The rebase is run with its output captured so the script can present helpful guidance without failing abruptly.
6. Success flow: if the rebase completes cleanly, the script optionally runs tests, shows a summary, and prints next steps (usually `git push --force-with-lease origin <feature>` and create a PR).
7. Failure flow (conflicts): if the rebase fails, the script:
   - prints the `git rebase` output captured for debugging,
   - prints helpful next commands: `git status --porcelain`, edit + `git add`, then `git rebase --continue`, or to abort: `git rebase --abort` followed by `git reset --hard backup/...` to restore the pre-script state,
   - lists the contents of `.git/rebase-apply` or `.git/rebase-merge` if present to help diagnostics,
   - offers to recover automatically by fetching origin and resetting the local feature branch to `origin/<feature>` (requires explicit confirmation). If accepted, it runs `git fetch` and `git reset --hard origin/<feature>` and exits.

Why the script refuses to run when local != origin
--------------------------------------------------
Rebasing a branch that is already diverged from its remote is risky: it may overwrite commits that teammates rely on or lead to push conflicts. To avoid accidental data loss, the script stops and asks you to explicitly sync the branch first. You can sync with:

```powershell
git fetch origin --prune
git reset --hard origin/<feature>
```

This ensures the feature branch you are rebasing is the one that the team currently has on `origin`.

Conflict resolution guidance (manual)
-----------------------------------
When a rebase interrupts with conflicts do the following:

1. Inspect status and conflicted files:

```powershell
git status --porcelain
```

2. For each conflicted file: open it, resolve conflicts, then stage it:

```powershell
git add path/to/resolved-file
```

3. Continue the rebase:

```powershell
git rebase --continue
```

4. If you change your mind and want to restore the pre-script state (using the backup created by the script):

```powershell
git rebase --abort
git reset --hard backup/<feature>-before-update-YYYYMMDD-HHMMSS
```

Automatic recovery option
-------------------------
If the rebase fails and you prefer to abandon the local rebase and match the remote, the script offers a recovery option to `git fetch origin` and `git reset --hard origin/<feature>`. This discards local divergent commits and makes your branch match the remote. Use with caution.

Examples
--------
Update the current branch (uses current checkout as `TargetBranch`):

```powershell
.\update-feature-from-main-branch.ps1
```

Update a specific target branch:

```powershell
.\update-feature-from-main-branch.ps1 -TargetBranch feat/PAFS-255-feat-addition-of-other-text-translation-use-case
```

Use a different base branch (e.g. `main`):

```powershell
.\update-feature-from-main-branch.ps1 -BaseBranch main
```

Post-rebase push (if you previously pushed this branch):

```powershell
git push --force-with-lease origin feat/PAFS-255-feat-addition-of-other-text-translation-use-case
```

Troubleshooting
---------------
- If the script aborts before starting (local != origin), run the sync commands shown earlier and re-run the script.
- If you have an active rebase in the repository from a previous manual attempt, inspect `.git/rebase-apply` or `.git/rebase-merge` and finish or abort the rebase manually.
- If you accidentally reset or forced a push elsewhere and need to recover old history, use `git reflog` to find the lost commits and restore with `git checkout -b recovery <sha>`.

Exit codes
----------
- `0` — success (rebase completed or recovery succeeded)
- `1` — failure (user aborted, rebase failed and user declined automatic recovery, or other fatal error)

Notes and safety reminders
-------------------------
- The script is intentionally conservative: it refuses to start if your local feature branch doesn’t match the remote. This prevents accidental rewrite of history that teammates may depend on.
- The only time the script performs a destructive reset is when you explicitly accept the recovery option after a failed rebase, or when you manually run the reset commands shown in the recover steps.

Want the doc embedded in the script header?
-----------------------------------------
If you prefer, I can copy a concise version of this README into the top comment block of `update-feature-from-main-branch.ps1` so `Get-Help` and quick viewing show the same guidance.

Contact / Support
-----------------
If in doubt, stop and ask a teammate. Provide the rebase output and the output of `git status --porcelain` and `git reflog` when asking for help.

