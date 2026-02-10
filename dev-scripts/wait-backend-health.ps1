for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 2
    try {
        $r = Invoke-RestMethod -Uri http://localhost:5000/api/health -TimeoutSec 2 -ErrorAction Stop
        Write-Host "Backend ready!"
        exit 0
    } catch {
        Write-Host "Waiting... ($i)"
    }
}
Write-Host "Timeout waiting for backend"
exit 1
