$base = "C:\Meastro\docs\phases\PHASE-34\34-A"
$specs = @(
    "01-architecture-overview",
    "02-interaction-handler",
    "03-specialists-comprendre",
    "04-specialists-planifier",
    "05-specialists-implementer",
    "06-specialists-verifier",
    "07-specialists-reviewer",
    "08-specialists-livrer",
    "09-tool-blocks",
    "10-workflow-orchestrator",
    "11-fitness-criteria",
    "12-memory-strategy",
    "13-technical-dependencies",
    "14-test-plan"
)

# Create folder structure
foreach ($s in $specs) {
    New-Item -ItemType Directory -Force -Path "$base\$s" | Out-Null
    Write-Output "Created: $s/"
}

# Move spec files into their folders
foreach ($s in $specs) {
    $src = "$base\spec\$s.md"
    $dst = "$base\$s\spec.md"
    if (Test-Path $src) {
        Move-Item -Path $src -Destination $dst -Force
        Write-Output "Moved: spec/$s.md -> $s/spec.md"
    } else {
        Write-Output "NOT FOUND: spec/$s.md"
    }
}

# Move plans from PHASE-34 root into the right 34-A subfolders
$planA_src = "C:\Meastro\docs\phases\PHASE-34\PLAN-A-INFRASTRUCTURE.md"
$planA_dst = "$base\13-technical-dependencies\plan.md"
if (Test-Path $planA_src) {
    Move-Item -Path $planA_src -Destination $planA_dst -Force
    Write-Output "Moved: PLAN-A-INFRASTRUCTURE.md -> 13-technical-dependencies/plan.md"
}

$planC_src = "C:\Meastro\docs\phases\PHASE-34\PLAN-C-SPECIALISTS-COMPRENDRE.md"
$planC_dst = "$base\03-specialists-comprendre\plan.md"
if (Test-Path $planC_src) {
    Move-Item -Path $planC_src -Destination $planC_dst -Force
    Write-Output "Moved: PLAN-C-SPECIALISTS-COMPRENDRE.md -> 03-specialists-comprendre/plan.md"
}

# Check if spec/ is now empty and remove
$remaining = Get-ChildItem "$base\spec" -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Output "WARNING: spec/ still has files: $($remaining.Name -join ', ')"
} else {
    Remove-Item "$base\spec" -Force -ErrorAction SilentlyContinue
    Write-Output "Removed empty spec/ directory"
}

# Show final structure
Write-Output ""
Write-Output "=== FINAL STRUCTURE ==="
Get-ChildItem $base -Recurse | ForEach-Object {
    $rel = $_.FullName.Replace($base, "").TrimStart("\")
    if ($_.PSIsContainer) {
        Write-Output "  $rel/"
    } else {
        Write-Output "  $rel"
    }
}
