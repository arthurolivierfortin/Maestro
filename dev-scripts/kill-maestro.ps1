$procs = Get-Process | Where-Object { $_.Path -and $_.Path -like '*Maestro*' }
foreach ($p in $procs) {
    Write-Host "Killing $($p.ProcessName) (PID $($p.Id))"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
if (-not $procs) { Write-Host "No Maestro processes found" }

# Also check for backend on port 5000
$conns = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Killing $($proc.ProcessName) on port 5000 (PID $($proc.Id))"
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Done"
