$procs = Get-Process -Name "Maestro.Api" -ErrorAction SilentlyContinue
if ($procs) {
    $procs | Stop-Process -Force
    Write-Host "Killed $($procs.Count) Maestro.Api process(es)"
} else {
    Write-Host "No Maestro.Api processes found"
}

# Also check for dotnet processes running Maestro
$dotnetProcs = Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.CommandLine -like "*Maestro.Api*" } catch { $false }
}
if ($dotnetProcs) {
    $dotnetProcs | Stop-Process -Force
    Write-Host "Killed $($dotnetProcs.Count) dotnet Maestro process(es)"
}

Start-Sleep -Seconds 2

# Verify port is free
$portCheck = netstat -ano | Select-String "LISTENING" | Select-String ":5000 "
if ($portCheck) {
    Write-Host "WARNING: Port 5000 still in use:"
    Write-Host $portCheck
    # Extract PID and kill
    foreach ($line in $portCheck) {
        $pid = ($line.ToString().Trim() -split '\s+')[-1]
        if ($pid -match '^\d+$') {
            Write-Host "Killing PID $pid"
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "Port 5000 is free"
}
