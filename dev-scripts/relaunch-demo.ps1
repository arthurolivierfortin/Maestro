# Kill old demo windows (node processes with window titles)
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    try { $_.Kill() } catch {}
}
Start-Sleep -Milliseconds 500

# Launch fresh demo
Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\packages\maestro-cli; node index.js code --demo --no-splash'
