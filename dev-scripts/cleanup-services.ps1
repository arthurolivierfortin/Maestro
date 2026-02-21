# Kill all services on ports 5000 and 5010
$pids = @()
netstat -ano 2>&1 | Select-String ':5010.*LISTENING|:5000.*LISTENING' | ForEach-Object {
    $procId = ($_ -split '\s+')[-1]
    if ($procId -match '^\d+$') { $pids += [int]$procId }
}
$pids | Sort-Object -Unique | ForEach-Object { taskkill /F /PID $_ 2>&1 | Out-Null }
taskkill /F /IM Maestro.Api.exe 2>&1 | Out-Null
Start-Sleep 3

# Verify
$check5000 = netstat -ano 2>&1 | Select-String ':5000.*LISTENING'
$check5010 = netstat -ano 2>&1 | Select-String ':5010.*LISTENING'
Write-Host "Port 5000: $(if ($check5000) { 'STILL IN USE' } else { 'free' })"
Write-Host "Port 5010: $(if ($check5010) { 'STILL IN USE' } else { 'free' })"
