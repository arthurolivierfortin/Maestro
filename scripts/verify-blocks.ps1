# Verify blocks
$blocks = Invoke-RestMethod -Uri 'http://localhost:5000/api/blocks' -Method GET

Write-Host "Total blocks: $($blocks.Count)"
Write-Host ""

# Group by type
$byType = $blocks | Group-Object -Property blockType
foreach ($group in $byType) {
    Write-Host "$($group.Name): $($group.Count)" -ForegroundColor Cyan
    foreach ($block in $group.Group) {
        Write-Host "  - $($block.id): $($block.name)" -ForegroundColor Gray
    }
}
