Start-Sleep -Seconds 5
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:5000/api/workspaces' -Method GET -TimeoutSec 10
    Write-Host "Backend is running!"
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Backend error: $($_.Exception.Message)"
    if (Test-Path 'C:\Meastro\backend.log') {
        Write-Host "--- Last 30 lines of backend.log ---"
        Get-Content 'C:\Meastro\backend.log' -Tail 30
    }
}
