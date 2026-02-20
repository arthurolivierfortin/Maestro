$blocks = Invoke-RestMethod 'http://localhost:5000/api/blocks'
$v4Ids = @(
    'project-analyzer', 'task-architect', 'research-agent',
    'task-planner', 'plan-validator',
    'backend-developer', 'frontend-developer', 'styling-developer', 'step-validator', 'compilation-check',
    'test-writer', 'test-runner', 'e2e-tester', 'ui-reviewer', 'accessibility-checker',
    'code-reviewer', 'security-reviewer', 'architecture-reviewer',
    'git-committer', 'changelog-writer', 'summary-reporter',
    'classify-intent', 'decide-action', 'send-widget-response',
    'maestro-agent-v4'
)

$found = 0
$missing = @()

foreach ($id in $v4Ids) {
    $block = $blocks | Where-Object { $_.id -eq $id }
    if ($block) {
        $found++
        Write-Host "  OK: $id (type=$($block.type))" -ForegroundColor Green
    } else {
        $missing += $id
        Write-Host "  MISSING: $id" -ForegroundColor Red
    }
}

Write-Host "`nFound: $found / $($v4Ids.Count)"
if ($missing.Count -gt 0) {
    Write-Host "Missing: $($missing -join ', ')" -ForegroundColor Red
}
