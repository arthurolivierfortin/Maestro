Write-Host "Stopping backend..."
taskkill /F /IM Maestro.Api.exe 2>$null
Start-Sleep -Seconds 2

Write-Host "Starting backend..."
Start-Process -FilePath "dotnet" -ArgumentList "run","--project","C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj" -WindowStyle Hidden
Write-Host "Backend restarting... waiting for health..."

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri 'http://localhost:5000/api/health' -ErrorAction Stop
        if ($health.status -eq 'healthy') {
            Write-Host "Backend is healthy!" -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host "." -NoNewline
    }
}
Write-Host "`nTimeout waiting for backend" -ForegroundColor Red
exit 1
