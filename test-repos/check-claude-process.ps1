Write-Host "=== Claude Code CLI processes ==="
Get-Process -Name "claude*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  PID: $($_.Id), Name: $($_.ProcessName), CPU: $($_.CPU)s, StartTime: $($_.StartTime)"
}

Write-Host ""
Write-Host "=== Node.js processes (possible Claude Code) ==="
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  PID: $($_.Id), CPU: $($_.CPU)s, Memory: $([math]::Round($_.WorkingSet64/1MB, 1))MB"
}

Write-Host ""
Write-Host "=== Maestro.Api process ==="
Get-Process -Name "Maestro.Api" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  PID: $($_.Id), CPU: $($_.CPU)s, Memory: $([math]::Round($_.WorkingSet64/1MB, 1))MB"
}

Write-Host ""
Write-Host "=== dotnet processes ==="
Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  PID: $($_.Id), CPU: $($_.CPU)s, Memory: $([math]::Round($_.WorkingSet64/1MB, 1))MB, Start: $($_.StartTime)"
}
