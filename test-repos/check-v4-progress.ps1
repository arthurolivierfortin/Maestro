$sessionId = '5719f8d1-8d11-4daf-b58f-a0fdccca18f3'

Write-Host "=== Execution Log (last 15) ==="
try {
    $log = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionLog" -TimeoutSec 5
    if ($log -is [array] -and $log.Count -gt 0) {
        $log | Select-Object -Last 15 | ForEach-Object {
            Write-Host "  [$($_.level)] $($_.msg)"
        }
    } else {
        Write-Host "  (empty)"
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== Phases ==="
try {
    $phases = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_phases" -TimeoutSec 5
    if ($phases -is [array]) {
        $phases | ForEach-Object {
            Write-Host "  $($_.name): $($_.status)"
        }
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}
