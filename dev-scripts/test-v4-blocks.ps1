Write-Host "=== Checking v4 blocks via API ===" -ForegroundColor Cyan

$blocks = Invoke-RestMethod -Uri 'http://localhost:5000/api/blocks'
$v4blocks = $blocks | Where-Object { $_.version -eq '4.0.0' }

Write-Host "`nFound $($v4blocks.Count) v4 blocks:" -ForegroundColor Green
$v4blocks | Select-Object id, name, blockType, version | Format-Table -AutoSize

Write-Host "`n=== Expected v4 blocks ===" -ForegroundColor Cyan
$expected = @(
    'project-analyzer', 'task-architect', 'research-agent', 'task-planner',
    'backend-developer', 'frontend-developer', 'styling-developer',
    'test-writer', 'test-runner', 'e2e-tester', 'git-committer',
    'plan-validator', 'step-validator', 'code-reviewer', 'security-reviewer',
    'architecture-reviewer', 'ui-reviewer', 'accessibility-checker',
    'changelog-writer', 'summary-reporter',
    'classify-intent', 'decide-action', 'send-widget-response',
    'maestro-agent-v4', 'interaction-handler',
    'playwright-screenshot', 'playwright-accessibility', 'playwright-interact',
    'web-search', 'compilation-check', 'memory-read', 'memory-write', 'state-manager'
)

$v4ids = $v4blocks | ForEach-Object { $_.id }
$missing = @()
$found = @()

foreach ($e in $expected) {
    if ($v4ids -contains $e) {
        $found += $e
    } else {
        $missing += $e
    }
}

Write-Host "`nFound: $($found.Count) / $($expected.Count)" -ForegroundColor Green
if ($missing.Count -gt 0) {
    Write-Host "MISSING:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
} else {
    Write-Host "ALL EXPECTED V4 BLOCKS PRESENT!" -ForegroundColor Green
}
