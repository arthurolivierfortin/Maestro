Write-Host "=== TEST REPOS (base) ==="
foreach ($name in @('crud','auth','dashboard','explorer','notifications')) {
    $path = "C:\Meastro\test-repos\$name"
    $hasGit = Test-Path "$path\.git"
    $hasDist = Test-Path "$path\dist"
    $hasNodeMod = Test-Path "$path\node_modules"
    Write-Host "  $name : git=$hasGit dist=$hasDist node_modules=$hasNodeMod"
}

Write-Host ""
Write-Host "=== CLAUDE COPIES ==="
foreach ($name in @('crud-claude','auth-claude','dashboard-claude','explorer-claude','notifications-claude')) {
    $path = "C:\Meastro\test-repos\$name"
    if (Test-Path $path) {
        $hasGit = Test-Path "$path\.git"
        $srcFiles = (Get-ChildItem -Path "$path\src" -Recurse -File -ErrorAction SilentlyContinue).Count
        $commitCount = 0
        try { $commitCount = (git -C $path log --oneline 2>&1 | Measure-Object -Line).Lines } catch {}
        $lastMsg = ""
        try { $lastMsg = (git -C $path log --oneline -1 2>&1) } catch {}
        Write-Host "  $name : git=$hasGit src_files=$srcFiles commits=$commitCount last='$lastMsg'"
    } else {
        Write-Host "  $name : NOT FOUND"
    }
}

Write-Host ""
Write-Host "=== INFRASTRUCTURE FIXES ==="
Write-Host "  EntryPointExecutor container node guard: $(Select-String -Path 'C:\Meastro\apps\backend\src\Maestro.Infrastructure\Sessions\EntryPointExecutor.cs' -Pattern 'no .type. property' -Quiet)"
Write-Host "  Workflow JSON sequence types: $(Select-String -Path 'C:\Meastro\content\system\blocks\workflows\maestro-agent-v4\maestro-agent-v4.workflow.block.json' -Pattern '"type": "sequence"' | Measure-Object -Line | Select-Object -ExpandProperty Lines) occurrences"

Write-Host ""
Write-Host "=== SERVICES ==="
try {
    $h = Invoke-RestMethod 'http://localhost:5000/api/health' -TimeoutSec 3
    Write-Host "  Backend: $($h.status)"
} catch {
    Write-Host "  Backend: DOWN"
}
try {
    $h2 = Invoke-RestMethod 'http://localhost:5010/api/v1/health/' -TimeoutSec 3
    Write-Host "  LLM-Provider: UP"
} catch {
    Write-Host "  LLM-Provider: DOWN"
}

Write-Host ""
Write-Host "=== SESSIONS (last 5) ==="
try {
    $sessions = Invoke-RestMethod 'http://localhost:5000/api/sessions' -TimeoutSec 5
    $sessions | Select-Object -Last 5 | ForEach-Object {
        Write-Host "  $($_.id.Substring(0,8))... name='$($_.name)' status=$($_.status)"
    }
} catch {
    Write-Host "  (backend down - cannot list)"
}
