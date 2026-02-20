$sessionId = '5719f8d1-8d11-4daf-b58f-a0fdccca18f3'

Write-Host "=== _llmActivity ==="
try {
    $llm = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_llmActivity" -TimeoutSec 5
    if ($llm -is [array]) {
        Write-Host "  Count: $($llm.Count)"
        $llm | Select-Object -Last 5 | ForEach-Object {
            Write-Host "  ---"
            Write-Host "  nodeId: $($_.nodeId)"
            Write-Host "  time: $($_.time)"
            Write-Host "  duration: $($_.duration)"
            Write-Host "  status: $($_.status)"
            if ($_.promptPreview) {
                $preview = if ($_.promptPreview.Length -gt 100) { $_.promptPreview.Substring(0, 100) + "..." } else { $_.promptPreview }
                Write-Host "  prompt: $preview"
            }
            if ($_.responsePreview) {
                $rpreview = if ($_.responsePreview.Length -gt 200) { $_.responsePreview.Substring(0, 200) + "..." } else { $_.responsePreview }
                Write-Host "  response: $rpreview"
            }
        }
    } else {
        Write-Host "  (not array or empty)"
        Write-Host $llm
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== _activeBlock ==="
try {
    $active = Invoke-RestMethod "http://localhost:5000/api/sessions/$sessionId/variables/_activeBlock" -TimeoutSec 5
    $active | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}
