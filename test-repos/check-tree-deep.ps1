$sessionId = '5719f8d1-8d11-4daf-b58f-a0fdccca18f3'

Write-Host "=== Deep Execution Tree ==="
try {
    $tree = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionTree" -TimeoutSec 5
    $tree | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== _executionLog ==="
try {
    $log = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionLog" -TimeoutSec 5
    $log | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== _llmActivity ==="
try {
    $llm = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_llmActivity" -TimeoutSec 5
    $llm | ConvertTo-Json -Depth 3 -Compress | Write-Host
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}
