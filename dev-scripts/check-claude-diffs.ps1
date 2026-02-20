$repos = @('crud-claude','auth-claude','dashboard-claude','explorer-claude','notifications-claude')
foreach ($d in $repos) {
    Write-Host "`n=== $d ==="
    Push-Location "C:\Meastro\test-repos\$d"
    Write-Host "--- Files changed ---"
    git diff --stat HEAD~1..HEAD
    Write-Host "--- Commit message ---"
    git log -1 --format="%s"
    Pop-Location
}
