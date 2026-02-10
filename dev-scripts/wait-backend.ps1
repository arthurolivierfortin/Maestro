$count = 0
Write-Host "Waiting for Backend..." -ForegroundColor Yellow
while ($count -lt 30) {
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 3 -ErrorAction Stop
        Write-Host "Backend is UP" -ForegroundColor Green
        exit 0
    } catch {
        $count++
        Write-Host "  Attempt $count..."
    }
}
Write-Host "Backend failed to start" -ForegroundColor Red
exit 1
