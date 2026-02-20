try {
    $r = Invoke-RestMethod 'http://localhost:5000/api/health' -TimeoutSec 10
    Write-Host "Health: $r"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}

try {
    $r2 = Invoke-RestMethod 'http://localhost:5010/api/v1/health/' -TimeoutSec 10
    Write-Host "LLM-Provider: OK"
} catch {
    Write-Host "LLM-Provider: $($_.Exception.Message)"
}
