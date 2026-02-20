cd C:\Meastro\apps\backend
$logFile = "C:\Meastro\dev-scripts\backend-output.log"
Write-Host "Starting backend, logging to $logFile..."
dotnet run --project src/Maestro.Api 2>&1 | Tee-Object -FilePath $logFile
