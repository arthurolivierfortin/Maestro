$sessionId = '5719f8d1-8d11-4daf-b58f-a0fdccca18f3'

Write-Host "=== Full Session ==="
try {
    $session = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId" -TimeoutSec 5
    Write-Host "  status: $($session.status)"
    Write-Host "  name: $($session.name)"
    Write-Host "  entryPoints count: $($session.entryPoints.Count)"

    # Check if workflow is active
    $activeWf = $session.variables | Where-Object { $_.key -eq '_activeWorkflow' }
    if ($activeWf) { Write-Host "  _activeWorkflow: $($activeWf.value)" }

    # Check execution tree raw
    Write-Host ""
    Write-Host "=== _executionTree raw ==="
    $tree = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionTree" -TimeoutSec 5
    $treeJson = $tree | ConvertTo-Json -Depth 3 -Compress
    if ($treeJson.Length -gt 500) {
        Write-Host $treeJson.Substring(0, 500)
    } else {
        Write-Host $treeJson
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}
