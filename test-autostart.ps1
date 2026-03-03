Set-Location C:\Meastro\packages\maestro-cli
$env:MAESTRO_DEBUG = "true"
# Run maestro code with the auto-start — just test health check and sidecar init
# We'll use --help on code to NOT actually launch the TUI, but first let's test ensureBackend
# Actually let's just invoke it and timeout after 60s
$proc = Start-Process -FilePath "node" -ArgumentList "index.js","code","--demo" -NoNewWindow -PassThru -RedirectStandardOutput "C:\Meastro\autostart-stdout.log" -RedirectStandardError "C:\Meastro\autostart-stderr.log"
Start-Sleep -Seconds 5
$proc.Kill()
Write-Host "=== STDOUT ==="
Get-Content "C:\Meastro\autostart-stdout.log" -ErrorAction SilentlyContinue
Write-Host "=== STDERR ==="
Get-Content "C:\Meastro\autostart-stderr.log" -ErrorAction SilentlyContinue
