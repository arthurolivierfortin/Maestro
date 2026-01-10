<#
.SYNOPSIS
Automated script to update a feature branch with commits unique to it, based on development branch.

.DESCRIPTION
This script:
1. Creates a backup of the current feature branch
2. Fetches latest changes from origin/development
3. Rebases your feature branch onto origin/development
4. Keeps only commits unique to your feature branch
5. You can then push the updated feature branch and create a PR

Workflow:
- Backup branch created with timestamp: backup/<branch>-before-update-YYYYMMDD-HHMMSS
- Rebases your feature branch onto origin/development (linear history)
- Prompts for testing and next steps (push to origin, create PR)

.PARAMETER TargetBranch
The feature branch to update. If not provided, uses the current checked-out branch.
Type: [string]
Default: Current branch

.PARAMETER BaseBranch
The base branch to synchronize against (typically 'development' or 'main').
Type: [string]
Default: 'development'

.EXAMPLES

# Example 1: Update current branch from development (most common)
.\scripts\update-feature-from-development.ps1

# Example 2: Update specific feature branch from development
.\scripts\update-feature-from-development.ps1 -TargetBranch feat/PAFS-255-feat-addition-of-other-text-translation-use-case

# Example 3: Update from a different base branch (e.g., main instead of development)
.\scripts\update-feature-from-development.ps1 -BaseBranch main

# Example 4: Update specific feature branch from a different base branch
.\scripts\update-feature-from-development.ps1 -TargetBranch feat/PAFS-255-... -BaseBranch staging

# Example 5: Undo rebase if something went wrong
# If you need to undo the rebase and go back to the backup:
git reset --hard backup/<feature>-before-update-YYYYMMDD-HHMMSS

.NOTES
- Your original branch is always preserved as a backup (backup/...)
- The script rebases your feature branch onto origin/development (linear history)
- After the rebase, you can push your feature branch and create a PR to development
- Use `git push --force-with-lease` if you've already pushed this branch before
- If rebase conflicts occur, resolve them manually and continue

.LINK
https://git-scm.com/docs/git-cherry
#>

param(
    [string]$TargetBranch = "",
    [string]$BaseBranch = "development"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Initialize variables
$backupBranch = ""
$stashed = $false

function Write-Info($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Success($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }

# Ensure we're at repo root
Set-Location (Resolve-Path "$PSScriptRoot\..") | Out-Null

Write-Info "Update Feature Branch from Development Script"
Write-Info "=============================================="

# Step 1: Determine current branch if not provided
if (-not $TargetBranch) {
    $TargetBranch = & git rev-parse --abbrev-ref HEAD
    Write-Info "No target branch specified; using current branch: $TargetBranch"
}

# Validate target branch exists
$branchExists = & git show-ref --quiet refs/heads/$TargetBranch
if ($LASTEXITCODE -ne 0) {
    Write-Err "Branch '$TargetBranch' does not exist locally."
    exit 1
}

Write-Info "Target branch: $TargetBranch"
Write-Info "Base branch: origin/$BaseBranch"

# Step 2: Create backup
$backupBranch = "backup/$TargetBranch-before-update-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Info "Creating backup branch: $backupBranch"
& git branch $backupBranch
Write-Success "Backup created: $backupBranch"

# Step 3: Fetch latest changes
Write-Info "Fetching latest changes from origin..."
& git fetch origin --prune
Write-Success "Fetch completed"

# Safety check: ensure local feature branch is in sync with origin/feature to avoid surprises
Write-Info "Verifying local branch $TargetBranch is in sync with origin/$TargetBranch..."
$localSha = & git rev-parse $TargetBranch 2>$null
$originSha = & git rev-parse origin/$TargetBranch 2>$null
if (($localSha -and $originSha) -and ($localSha -ne $originSha)) {
    Write-Err "Local branch '$TargetBranch' differs from origin/$TargetBranch."
    Write-Host "Local SHA:  $localSha"
    Write-Host "Origin SHA: $originSha"
    Write-Err "Please sync your branch with origin (for example: 'git fetch origin; git reset --hard origin/$TargetBranch') before running this script."
    exit 1
}

# Step 4.5: Detect uncommitted local changes and offer to stash/commit/abort
Write-Info "Checking for uncommitted local changes..."
$statusShort = & git status --porcelain
if ($statusShort) {
    Write-Warn "You have local uncommitted changes that may be overwritten by branch operations."
    Write-Host $statusShort
    $choiceLocal = Read-Host "Options: (s)tash, (c)ommit, (a)bort. Choose one"
    if ($choiceLocal -match '^[Ss]') {
        Write-Info "Stashing local changes..."
        & git stash push -u -m "update-feature-from-development auto-stash: $(Get-Date -Format o)"
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to stash changes. Aborting."
            exit 1
        }
        $stashed = $true
        Write-Success "Local changes stashed."
    } elseif ($choiceLocal -match '^[Cc]') {
        $commitMsg = Read-Host "Enter commit message for local changes (or press Enter to auto-msg)"
        if (-not $commitMsg) { $commitMsg = "wip: save local changes before update-feature-from-development" }
        & git add -A
        & git commit -m "$commitMsg"
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to commit changes. Aborting."
            exit 1
        }
        Write-Success "Local changes committed."
    } else {
        Write-Err "Aborting as requested. No changes made."
        exit 1
    }
} else {
    Write-Info "No local uncommitted changes found."
}

# Step 5: Switch to the target branch and rebase onto origin/BaseBranch
$currentBranch = & git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne $TargetBranch) {
    Write-Info "Switching to $TargetBranch..."
    & git checkout $TargetBranch 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to checkout $TargetBranch."
        exit 1
    }
} else {
    Write-Info "Already on $TargetBranch"
}

Write-Info "Rebasing $TargetBranch onto origin/$BaseBranch..."
# Run rebase while capturing output and preventing PowerShell from throwing on non-zero exit
$oldEA = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$rebaseOutput = & git rebase origin/$BaseBranch 2>&1 | Out-String
$rebaseExit = $LASTEXITCODE
$ErrorActionPreference = $oldEA
Write-Host $rebaseOutput
if ($rebaseExit -ne 0) {
    Write-Err "Rebase conflict detected or rebase failed. Please resolve conflicts manually, then:"
    Write-Host "  git status --porcelain"
    Write-Host "  git add ."
    Write-Host "  git rebase --continue"
    Write-Host "Or abort the rebase with:"
    Write-Host "  git rebase --abort"
    Write-Host "  git reset --hard $backupBranch"
    Write-Info "Current rebase state (if any):"
    if (Test-Path ".git/rebase-apply") {
        Write-Host "Found .git/rebase-apply — rebase in progress (apply mode)."
        Get-ChildItem -Path .git/rebase-apply -Force | Select-Object -First 20 | ForEach-Object { Write-Host $_.Name }
    } elseif (Test-Path ".git/rebase-merge") {
        Write-Host "Found .git/rebase-merge — rebase in progress (merge mode)."
        Get-ChildItem -Path .git/rebase-merge -Force | Select-Object -First 20 | ForEach-Object { Write-Host $_.Name }
    } else {
        Write-Host "No .git/rebase-* directory found."
    }
    # Offer automatic recovery: fetch origin and reset to origin/TargetBranch
    $recoverChoice = Read-Host "Rebase failed. Fetch origin and reset $TargetBranch to origin/$TargetBranch? (y/n)"
    if ($recoverChoice -match '^[Yy]') {
        Write-Info "Fetching origin and resetting $TargetBranch to origin/$TargetBranch..."
        & git fetch origin --prune
        & git checkout $TargetBranch 2>$null
        & git reset --hard origin/$TargetBranch
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to reset to origin/$TargetBranch. Please inspect repository state manually."
            exit 1
        }
        Write-Success "Branch reset to origin/$TargetBranch. Exiting script."
        exit 0
    }
    exit 1
}
Write-Success "Rebased $TargetBranch onto origin/$BaseBranch successfully!"

# Step 7: Offer to run tests
Write-Info ""
Write-Info "Rebase completed. Would you like to run tests?"
$runTests = Read-Host "Run tests? (y/n)"
if ($runTests -match '^[Yy]') {
    Write-Info "Running dotnet test..."
    & dotnet test --configuration Debug --verbosity minimal
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Some tests failed. Review the output above."
    } else {
        Write-Success "All tests passed!"
    }
}

# Step 8: Summary and next steps
Write-Info ""
Write-Info "Update Summary"
Write-Info "=============="
Write-Host "[OK]   Backup created: $backupBranch"
Write-Host "[OK]   Rebased $TargetBranch onto origin/$BaseBranch"
Write-Host ""
Write-Info "Next steps:"
Write-Host "1. Review changes: git log --oneline -n 10"
Write-Host "2. Run tests to validate: dotnet test"
Write-Host "3. Push your updated feature branch (force required if previously pushed):"
Write-Host "   git push --force-with-lease origin $TargetBranch"
Write-Host "4. Create a PR from $TargetBranch to $BaseBranch on GitHub/Azure DevOps"
Write-Host ""
Write-Host "If you want to undo the rebase and restore from backup:"
Write-Host "   git reset --hard $backupBranch"
Write-Host ""

# Step 9: Offer to show diff
$showDiff = Read-Host "Show changes introduced by the rebase? (y/n)"
if ($showDiff -match '^[Yy]') {
    Write-Info "Showing diff (first 100 lines)..."
    & git diff $backupBranch..HEAD | Select-Object -First 100
}

Write-Success "Script completed. You are now on branch: $TargetBranch with commits rebased onto $BaseBranch."

# If we stashed earlier, offer to re-apply the stash now
if ($stashed) {
    $applyStash = Read-Host "A stash was created earlier. Re-apply it to the current branch? (y/n)"
    if ($applyStash -match '^[Yy]') {
        Write-Info "Re-applying stash..."
        & git stash pop
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Failed to pop stash cleanly. You'll need to re-apply manually: git stash list"
        } else {
            Write-Success "Stash re-applied."
        }
    } else {
        Write-Info "Leaving stash (you can re-apply later with 'git stash pop')."
    }
}
