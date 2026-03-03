# Test the ensureBackend auto-start path
# Backend is stopped, so ensureBackend should try sidecar
Set-Location C:\Meastro\packages\maestro-cli
$env:MAESTRO_DEBUG = "true"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath "node" -ArgumentList "-e","
const { ensureBackend } = { ensureBackend: null };
require('tsx/cjs');
// Quick test: import cli.ts and call ensureBackend
const path = require('path');
process.chdir(path.join(__dirname));
" -NoNewWindow -PassThru -Wait -RedirectStandardOutput "C:\Meastro\autostart2-stdout.log" -RedirectStandardError "C:\Meastro\autostart2-stderr.log"
$sw.Stop()
Write-Host "Duration: $($sw.Elapsed.TotalSeconds)s"
Write-Host "Exit: $($proc.ExitCode)"
Write-Host "=== STDOUT ==="
Get-Content "C:\Meastro\autostart2-stdout.log" -ErrorAction SilentlyContinue | Select-Object -First 20
Write-Host "=== STDERR ==="
Get-Content "C:\Meastro\autostart2-stderr.log" -ErrorAction SilentlyContinue | Select-Object -First 20
