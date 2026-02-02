# Fetch raw JSON first
$jsonRaw = Invoke-WebRequest -Uri 'http://localhost:8000/v1/models' -TimeoutSec 10 | Select-Object -ExpandProperty Content
Write-Host "Raw JSON (first 500 chars):"
Write-Host $jsonRaw.Substring(0, [Math]::Min(500, $jsonRaw.Length))

# Parse JSON
$data = $jsonRaw | ConvertFrom-Json

Write-Host "`nModels keys:"
$data.models.PSObject.Properties | ForEach-Object { Write-Host "  - $($_.Name)" }
