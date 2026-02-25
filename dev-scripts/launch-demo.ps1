Set-Location "C:\Meastro\packages\maestro-cli"
$env:NODE_NO_WARNINGS = 1
try {
    node index.js code --demo --no-splash
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
Write-Host "`nPress any key..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
