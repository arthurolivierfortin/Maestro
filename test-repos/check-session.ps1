$sessionId = 'eee8f93f-0672-4a4f-9e3f-189f423837d2'
$session = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId"

Write-Host "Status: $($session.status)"
Write-Host "Variables:"

# Check execution tree
$execTree = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionTree"
Write-Host "  _executionTree: $($execTree | ConvertTo-Json -Depth 3 -Compress)"

# Check execution log
$execLog = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_executionLog"
Write-Host "  _executionLog entries: $($execLog.Count)"
if ($execLog.Count -gt 0) {
    $execLog | Select-Object -Last 5 | ForEach-Object {
        Write-Host "    [$($_.level)] $($_.msg)"
    }
}

# Check current step
$step = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/currentStep"
Write-Host "  currentStep: $step"

# Check phases
$phases = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_phases"
$phases | ForEach-Object {
    Write-Host "  Phase: $($_.name) - $($_.status)"
}
