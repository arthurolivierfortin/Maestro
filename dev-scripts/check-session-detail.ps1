param([string]$SessionId)
$r = Invoke-RestMethod -Uri "http://localhost:5000/api/sessions/$SessionId" -Method GET

Write-Host "=== _phases ==="
$r.variables._phases | ForEach-Object { Write-Host "  $($_.id): $($_.status)" }

Write-Host ""
Write-Host "=== _improvementPhases ==="
$r.variables._improvementPhases | ForEach-Object { Write-Host "  $($_.id): $($_.status)" }

Write-Host ""
Write-Host "=== _phaseMetrics keys ==="
$metrics = $r.variables._phaseMetrics
if ($metrics) {
    $metrics.PSObject.Properties | ForEach-Object { Write-Host "  $($_.Name)" }
}

Write-Host ""
Write-Host "=== Execution Log (all) ==="
$log = $r.variables._executionLog
if ($log) {
    foreach ($entry in $log) {
        Write-Host "  [$($entry.level)] $($entry.message)"
    }
}

Write-Host ""
Write-Host "=== Session Status ==="
Write-Host "Status: $($r.status)"
Write-Host "Error: $($r.errorMessage)"
