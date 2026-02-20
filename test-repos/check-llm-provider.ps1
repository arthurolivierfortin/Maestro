Write-Host "=== LLM-Provider Health ==="
try {
    $health = Invoke-RestMethod "http://localhost:5010/api/v1/health/" -TimeoutSec 5
    Write-Host "  Status: $($health.status)"
    Write-Host "  ActiveRequests: $($health.activeRequests)"
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== LLM-Provider Active Requests ==="
try {
    $stats = Invoke-RestMethod "http://localhost:5010/api/v1/statistics/" -TimeoutSec 5
    $stats | ConvertTo-Json -Depth 3 -Compress | Write-Host
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== Recent Metrics ==="
try {
    $metrics = Get-Content "C:\LLM-Provider\dotnet\src\LLMProvider.Web\data\statistics\metrics-2026-02-20.json" -Raw | ConvertFrom-Json
    Write-Host "  Total entries: $($metrics.Count)"
    if ($metrics.Count -gt 0) {
        $metrics | Select-Object -Last 3 | ForEach-Object {
            Write-Host "  ---"
            Write-Host "  time: $($_.timestamp)"
            Write-Host "  model: $($_.modelId)"
            Write-Host "  status: $($_.status)"
            Write-Host "  duration: $($_.durationMs)ms"
        }
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}
