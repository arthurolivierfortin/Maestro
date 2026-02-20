$blocks = @(
    'state-manager','memory-read','project-analyzer','task-architect',
    'research-agent','task-planner','plan-validator','implement-single-step',
    'step-validator','test-writer','test-runner','e2e-tester',
    'ui-reviewer','accessibility-checker','code-reviewer','security-reviewer',
    'architecture-reviewer','git-committer','changelog-writer','summary-reporter',
    'memory-write','interaction-handler'
)

Set-Location C:\Meastro\packages\maestro-cli
$found = 0
$missing = 0

foreach ($block in $blocks) {
    $result = node index.js block info $block 2>&1 | Out-String
    if ($result -match "ID:") {
        Write-Host "OK  $block" -ForegroundColor Green
        $found++
    } else {
        Write-Host "MISSING  $block" -ForegroundColor Red
        $missing++
    }
}

Write-Host ""
Write-Host "Found: $found / $($blocks.Count)"
Write-Host "Missing: $missing"
