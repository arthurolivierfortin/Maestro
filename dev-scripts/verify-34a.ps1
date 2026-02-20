# Phase 34-A Final Verification Script
# Checks all 34 blocks (32 specialist + 2 workflows) and session template

Set-Location C:\Meastro\packages\maestro-cli

Write-Host "=== Phase 34-A Final Verification ===" -ForegroundColor Cyan
Write-Host ""

# All v4 blocks that should exist
$agents = @(
    'project-analyzer', 'task-architect', 'research-agent', 'task-planner',
    'backend-developer', 'frontend-developer', 'styling-developer',
    'compilation-checker', 'test-writer', 'test-runner', 'e2e-tester', 'git-committer'
)

$inference = @(
    'plan-validator', 'step-validator', 'ui-reviewer', 'accessibility-checker',
    'code-reviewer', 'security-reviewer', 'architecture-reviewer',
    'changelog-writer', 'summary-reporter',
    'classify-intent', 'decide-action', 'send-widget-response'
)

$tools = @(
    'playwright-screenshot', 'playwright-accessibility', 'playwright-interact',
    'web-search', 'compilation-check', 'memory-read', 'memory-write', 'state-manager'
)

$workflows = @(
    'maestro-agent-v4', 'interaction-handler'
)

$totalOk = 0
$totalMissing = 0

function Check-Blocks($blocks, $label) {
    Write-Host "--- $label ---" -ForegroundColor Yellow
    $ok = 0
    $miss = 0
    foreach ($b in $blocks) {
        $result = node index.js block info $b 2>&1 | Out-String
        if ($result -match "Version:\s+4\.0\.0") {
            Write-Host "  OK  $b (v4.0.0)" -ForegroundColor Green
            $ok++
        } elseif ($result -match "ID:") {
            Write-Host "  WARN  $b (found but not v4)" -ForegroundColor Yellow
            $ok++
        } else {
            Write-Host "  MISSING  $b" -ForegroundColor Red
            $miss++
        }
    }
    Write-Host "  $ok/$($blocks.Count) found, $miss missing" -ForegroundColor White
    Write-Host ""
    return @($ok, $miss)
}

$r1 = Check-Blocks $agents "AGENTS (12)"
$r2 = Check-Blocks $inference "INFERENCE (12)"
$r3 = Check-Blocks $tools "TOOLS (8)"
$r4 = Check-Blocks $workflows "WORKFLOWS (2)"

$totalOk = $r1[0] + $r2[0] + $r3[0] + $r4[0]
$totalMissing = $r1[1] + $r2[1] + $r3[1] + $r4[1]

Write-Host "--- SESSION TEMPLATE ---" -ForegroundColor Yellow
$templatePath = "C:\Meastro\content\system\templates\sessions\project-v4.session.json"
if (Test-Path $templatePath) {
    $template = Get-Content $templatePath | ConvertFrom-Json
    Write-Host "  OK  project-v4.session.json (id=$($template.id), type=$($template.type))" -ForegroundColor Green

    # Check phases
    $phases = $template.variables._phases
    if ($phases -and $phases.Count -eq 7) {
        Write-Host "  OK  7 phases defined" -ForegroundColor Green
    } else {
        Write-Host "  WARN  Expected 7 phases, got $($phases.Count)" -ForegroundColor Yellow
    }

    # Check entry points
    $eps = $template.entryPoints
    Write-Host "  OK  Entry points: dev=$($eps.dev), plan=$($eps.plan), review=$($eps.review), analyze=$($eps.analyze)" -ForegroundColor Green
} else {
    Write-Host "  MISSING  project-v4.session.json" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Blocks: $totalOk / $($agents.Count + $inference.Count + $tools.Count + $workflows.Count) found" -ForegroundColor White
Write-Host "Missing: $totalMissing" -ForegroundColor $(if ($totalMissing -gt 0) { "Red" } else { "Green" })
Write-Host "Session template: $(if (Test-Path $templatePath) { 'OK' } else { 'MISSING' })" -ForegroundColor White
