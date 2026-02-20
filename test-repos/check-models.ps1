$models = (Invoke-RestMethod 'http://localhost:5010/api/v1/models').models
$targetIds = @('claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001')

foreach ($id in $targetIds) {
    $m = $models | Where-Object { $_.id -eq $id }
    if ($m) {
        Write-Host "OK: $id (provider=$($m.provider))" -ForegroundColor Green
    } else {
        Write-Host "MISSING: $id" -ForegroundColor Red
    }
}

Write-Host "`nTotal models: $($models.Count)"
