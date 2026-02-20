$sessionId = '93816d32-568a-40e7-a7c2-0755099c7c1c'

# Check execution tree
try {
    $tree = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionTree" -TimeoutSec 5
    Write-Host "Execution Tree:"
    $tree | ConvertTo-Json -Depth 5 -Compress | ForEach-Object {
        # Truncate long strings
        if ($_.Length -gt 2000) { $_.Substring(0, 2000) + "..." } else { $_ }
    }
} catch {
    Write-Host "Tree error: $($_.Exception.Message)"
}

# Check execution log (last 10 entries)
try {
    $log = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionLog" -TimeoutSec 5
    Write-Host "`nExecution Log (last 10):"
    if ($log -is [array]) {
        $log | Select-Object -Last 10 | ForEach-Object {
            Write-Host "  [$($_.level)] $($_.msg)"
        }
    } else {
        Write-Host "  (not an array: $log)"
    }
} catch {
    Write-Host "Log error: $($_.Exception.Message)"
}

# Check session status
try {
    $session = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId" -TimeoutSec 5
    Write-Host "`nSession Status: $($session.status)"
} catch {
    Write-Host "Session error: $($_.Exception.Message)"
}
