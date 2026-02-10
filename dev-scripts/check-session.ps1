param([string]$SessionId)
$r = Invoke-RestMethod -Uri "http://localhost:5000/api/sessions/$SessionId" -Method GET
$phases = $r.variables._phases
$fitness = $r.variables.currentFitness
$iter = $r.variables.currentIteration
$bestFitness = $r.variables._bestFitness
$activeWf = $r.variables._activeWorkflow

Write-Host "=== Session Status ==="
Write-Host "Fitness: $fitness  |  Best: $bestFitness  |  Iteration: $iter"
Write-Host "Active Workflow: $activeWf"
Write-Host ""
Write-Host "=== Phases ==="
foreach ($p in $phases) {
    Write-Host "  $($p.id): $($p.status)"
}
Write-Host ""

# Show last 5 execution log entries
$log = $r.variables._executionLog
if ($log -and $log.Count -gt 0) {
    Write-Host "=== Recent Log (last 5) ==="
    $start = [Math]::Max(0, $log.Count - 5)
    for ($i = $start; $i -lt $log.Count; $i++) {
        $entry = $log[$i]
        Write-Host "  [$($entry.level)] $($entry.message)"
    }
}
