param([string]$SessionId)
$base = "http://localhost:5000/api/sessions/$SessionId/variables"

Write-Host "=== PHASES ===" -ForegroundColor Cyan
try {
    $phases = Invoke-RestMethod -Uri "$base/_phases" -TimeoutSec 5
    $phases.value | ForEach-Object { Write-Host "  $($_.id): $($_.status)" }
} catch { Write-Host "  (error fetching phases)" -ForegroundColor Red }

Write-Host ""
Write-Host "=== EXECUTION TREE ===" -ForegroundColor Cyan
try {
    $tree = Invoke-RestMethod -Uri "$base/_executionTree" -TimeoutSec 5
    function Show-Tree($nodes, $indent) {
        foreach ($n in $nodes) {
            $c = switch ($n.status) { "done" { "Green" } "error" { "Red" } "running" { "Yellow" } default { "Gray" } }
            $out = if ($n.output -and $n.output.Length -gt 80) { $n.output.Substring(0,80) + "..." } elseif ($n.output) { $n.output } else { "" }
            Write-Host "$indent$($n.id) [$($n.status)]" -ForegroundColor $c -NoNewline
            if ($out) { Write-Host " -> $out" -ForegroundColor DarkGray } else { Write-Host "" }
            if ($n.children -and $indent.Length -lt 8) { Show-Tree $n.children "$indent  " }
        }
    }
    Show-Tree $tree.value ""
} catch { Write-Host "  (error fetching tree)" -ForegroundColor Red }

Write-Host ""
Write-Host "=== LOG (last 15) ===" -ForegroundColor Cyan
try {
    $log = Invoke-RestMethod -Uri "$base/_executionLog" -TimeoutSec 5
    Write-Host "  Total: $($log.value.Count) entries"
    $log.value | Select-Object -Last 15 | ForEach-Object {
        $c = switch ($_.level) { "error" { "Red" } "success" { "Green" } "warning" { "Yellow" } default { "White" } }
        Write-Host "  [$($_.level)] $($_.time) $($_.msg)" -ForegroundColor $c
    }
} catch { Write-Host "  (error fetching log)" -ForegroundColor Red }

Write-Host ""
Write-Host "=== CRUD REPO GIT STATUS ===" -ForegroundColor Cyan
Set-Location C:\Meastro\test-repos\crud
git diff --stat HEAD
git status --short
