$file = 'C:\Meastro\test-repos\crud\.maestro\sessions\5719f8d1-8d11-4daf-b58f-a0fdccca18f3.json'
$json = Get-Content $file -Raw | ConvertFrom-Json

Write-Host "=== EXECUTION TREE (full depth) ==="
function Show-Node($node, $indent) {
    $prefix = "  " * $indent
    $childCount = if ($node.children) { $node.children.Count } else { 0 }
    $outputPreview = ""
    if ($node.output) {
        $outputPreview = " | Output: " + $node.output.ToString().Substring(0, [Math]::Min(80, $node.output.ToString().Length))
    }
    Write-Host "$prefix[$($node.status)] $($node.name) (children: $childCount)$outputPreview"
    if ($node.children) {
        foreach ($child in $node.children) {
            Show-Node $child ($indent + 1)
        }
    }
}

$tree = $json.variables._executionTree
foreach ($node in $tree) {
    Show-Node $node 0
}

Write-Host "`n=== PLAN STEPS ==="
$steps = $json.variables._planSteps
if ($steps -is [array]) {
    foreach ($s in $steps) {
        Write-Host "  Step $($s.id): [$($s.domain)] $($s.action) -> $($s.target)"
        Write-Host "    Developer: $($s.developer)"
        Write-Host "    Description: $($s.description)"
    }
}

Write-Host "`n=== CURRENT ITEM (last foreach item) ==="
Write-Host $json.variables._currentItemJson

Write-Host "`n=== ITERATION STATE ==="
Write-Host "  iteration: $($json.variables.iteration)"
Write-Host "  currentIteration: $($json.variables.currentIteration)"
Write-Host "  currentStep: $($json.variables.currentStep)"

Write-Host "`n=== REVIEW SCORES ==="
Write-Host "  reviewScore: $($json.variables.reviewScore)"
Write-Host "  reviewApproved preview:"
$ra = $json.variables.reviewApproved
if ($ra) { Write-Host ($ra.ToString().Substring(0, [Math]::Min(500, $ra.ToString().Length))) }

Write-Host "`n=== IMPLEMENT-STEP RESULT ==="
$impl = $json.variables.'_nodeResult_implement-step'
if ($impl) { Write-Host ($impl.ToString().Substring(0, [Math]::Min(800, $impl.ToString().Length))) }

Write-Host "`n=== VALIDATE-STEP-IMPL RESULT ==="
$val = $json.variables.'_nodeResult_validate-step-impl'
if ($val) { Write-Host ($val.ToString().Substring(0, [Math]::Min(800, $val.ToString().Length))) }

Write-Host "`n=== RUN-E2E RESULT ==="
Write-Host $json.variables.'_nodeResult_run-e2e'

Write-Host "`n=== GENERATE-REPORT RESULT ==="
$report = $json.variables.'_nodeResult_generate-report'
if ($report) { Write-Host ($report.ToString().Substring(0, [Math]::Min(1500, $report.ToString().Length))) }
