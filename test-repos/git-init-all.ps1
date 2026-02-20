$repos = @('crud', 'auth', 'dashboard', 'explorer', 'notifications')

foreach ($repo in $repos) {
    $repoPath = "C:\Meastro\test-repos\$repo"
    Write-Host "=== $repo ==="

    # Remove existing .git if any
    $gitDir = Join-Path $repoPath ".git"
    if (Test-Path $gitDir) {
        Remove-Item -Recurse -Force $gitDir
        Write-Host "  Removed old .git"
    }

    # Remove dist if any
    $distDir = Join-Path $repoPath "dist"
    if (Test-Path $distDir) {
        Remove-Item -Recurse -Force $distDir
        Write-Host "  Removed dist"
    }

    Push-Location $repoPath
    git init
    git add -A
    git commit -m "Initial project setup"
    $lastCommit = git log --oneline -1
    Write-Host "  Last commit: $lastCommit"
    Pop-Location
}

Write-Host "`nAll repos initialized!"
