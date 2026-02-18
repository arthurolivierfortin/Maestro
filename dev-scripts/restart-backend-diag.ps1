# Kill and restart backend with diagnostic logging
Stop-Process -Name "Maestro.Api" -Force -ErrorAction SilentlyContinue
taskkill /F /IM dotnet.exe 2>&1 | Out-Null
Start-Sleep -Seconds 3

# Verify port free
$listening = netstat -ano | Select-String "LISTENING" | Select-String ":5000 "
if ($listening) {
    Write-Host "Port 5000 still in use, force killing..."
    foreach ($line in $listening) {
        $pid = ($line.ToString().Trim() -split '\s+')[-1]
        if ($pid -match '^\d+$') {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
}

# Clear old log
Remove-Item C:\temp\backend-diag.log -ErrorAction SilentlyContinue
Remove-Item C:\temp\backend-diag-err.log -ErrorAction SilentlyContinue

# Start backend with logging
Write-Host "Starting backend with diagnostic logging..."
$proc = Start-Process -FilePath "dotnet" -ArgumentList "run","--project","C:\Meastro\backend\src\Maestro.Api\Maestro.Api.csproj","--urls","http://localhost:5000" -RedirectStandardOutput "C:\temp\backend-diag.log" -RedirectStandardError "C:\temp\backend-diag-err.log" -PassThru
Write-Host "Backend PID: $($proc.Id)"

# Wait for healthy
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "Backend healthy: $($health.status)"
        exit 0
    } catch {
        Write-Host "Waiting... ($i)"
    }
}
Write-Host "Backend failed to start in time"
Get-Content C:\temp\backend-diag-err.log -Tail 10
exit 1
