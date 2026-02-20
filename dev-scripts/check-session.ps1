param([string]$SessionId)

$base = "http://localhost:5000/api/sessions/$SessionId/variables"

Write-Host "=== PHASES ===" -ForegroundColor Cyan
$phases = Invoke-RestMethod -Uri "$base/_phases" -TimeoutSec 5
$phases.value | ForEach-Object { Write-Host "  $($_.id): $($_.status)" }

Write-Host ""
Write-Host "=== EXECUTION LOG (last 40) ===" -ForegroundColor Cyan
$log = Invoke-RestMethod -Uri "$base/_executionLog" -TimeoutSec 5
$entries = $log.value
Write-Host "  Total entries: $($entries.Count)"
Write-Host ""
$entries | Select-Object -Last 40 | ForEach-Object {
    $color = switch ($_.level) {
        "error" { "Red" }
        "success" { "Green" }
        "warning" { "Yellow" }
        default { "White" }
    }
    Write-Host "  [$($_.level)] $($_.time) $($_.msg)" -ForegroundColor $color
}

Write-Host ""
Write-Host "=== EXECUTION TREE (depth 2) ===" -ForegroundColor Cyan
$tree = Invoke-RestMethod -Uri "$base/_executionTree" -TimeoutSec 5
function Show-Tree($nodes, $indent) {
    foreach ($n in $nodes) {
        $statusColor = switch ($n.status) {
            "done" { "Green" }
            "error" { "Red" }
            "running" { "Yellow" }
            default { "Gray" }
        }
        Write-Host "$indent$($n.id): $($n.status)" -ForegroundColor $statusColor
        if ($n.children -and $indent.Length -lt 6) {
            Show-Tree $n.children "$indent  "
        }
    }
}
Show-Tree $tree.value ""

Write-Host ""
Write-Host "=== FILES MODIFIED IN CRUD ===" -ForegroundColor Cyan
Set-Location C:\Meastro\test-repos\crud
git status --short
