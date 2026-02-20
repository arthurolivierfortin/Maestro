$repos = @('auth','auth-claude','dashboard','dashboard-claude','explorer','explorer-claude','notifications','notifications-claude')
foreach ($d in $repos) {
    $path = "C:\Meastro\test-repos\$d\.maestro"
    $exists = Test-Path $path
    Write-Host "=== $d === .maestro=$exists"
}

$allRepos = @('crud','crud-claude','auth','auth-claude','dashboard','dashboard-claude','explorer','explorer-claude','notifications','notifications-claude')
foreach ($d in $allRepos) {
    Write-Host "`n--- GIT LOG: $d ---"
    Push-Location "C:\Meastro\test-repos\$d"
    git log --oneline --all 2>&1
    Pop-Location
}
