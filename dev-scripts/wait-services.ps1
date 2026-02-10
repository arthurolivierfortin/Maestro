$count = 0
Write-Host "Waiting for LLM Provider..." -ForegroundColor Yellow
while ($count -lt 60) {
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 3 -ErrorAction Stop
        Write-Host "LLM Provider is UP" -ForegroundColor Green
        break
    } catch {
        $count++
        Write-Host "  Attempt $count..."
    }
}

$count = 0
Write-Host "Waiting for Backend..." -ForegroundColor Yellow
while ($count -lt 30) {
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 3 -ErrorAction Stop
        Write-Host "Backend is UP" -ForegroundColor Green
        break
    } catch {
        $count++
        Write-Host "  Attempt $count..."
    }
}

# Check LLM Provider models
Write-Host "`nQuerying available models..." -ForegroundColor Yellow
try {
    $models = Invoke-RestMethod -Uri "http://localhost:8000/v1/models" -TimeoutSec 10 -ErrorAction Stop
    $models | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Could not query models endpoint" -ForegroundColor Red
}

# Also check health details
Write-Host "`nLLM Provider health:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 5 -ErrorAction Stop
    $health | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Health check failed" -ForegroundColor Red
}
