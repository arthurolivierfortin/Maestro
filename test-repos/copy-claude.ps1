$repos = @('crud', 'auth', 'dashboard', 'explorer', 'notifications')
foreach ($repo in $repos) {
    $src = Join-Path "C:\Meastro\test-repos" $repo
    $dst = Join-Path "C:\Meastro\test-repos" "$repo-claude"
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse -Force $src $dst
    Write-Host "Copied $repo -> $repo-claude"
}
Write-Host "Done!"
