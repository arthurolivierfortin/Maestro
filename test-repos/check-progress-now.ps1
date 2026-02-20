$sessionId = '5719f8d1-8d11-4daf-b58f-a0fdccca18f3'

Write-Host "=== Session Status ==="
try {
    $session = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId" -TimeoutSec 5
    Write-Host "  status: $($session.status)"
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== Execution Tree (depth 10) ==="
try {
    $tree = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionTree" -TimeoutSec 5
    $tree | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== Execution Log (last 20) ==="
try {
    $log = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionLog" -TimeoutSec 5
    if ($log -is [array] -and $log.Count -gt 0) {
        $log | Select-Object -Last 20 | ForEach-Object {
            Write-Host "  [$($_.level)] $($_.msg)"
        }
    } else {
        Write-Host "  (empty or not array)"
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}
