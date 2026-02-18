$logFile = "C:\temp\backend-diag.log"
"Starting backend with log at $logFile" | Out-Host
$proc = Start-Process -FilePath "dotnet" -ArgumentList "run","--project","C:\Meastro\backend\src\Maestro.Api\Maestro.Api.csproj","--urls","http://localhost:5000" -RedirectStandardOutput $logFile -RedirectStandardError "C:\temp\backend-diag-err.log" -PassThru -NoNewWindow
"PID: $($proc.Id)" | Out-Host
