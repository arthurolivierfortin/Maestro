$handle = Get-Process | Where-Object { $_.Modules -and ($_.Modules.FileName -match 'Meastro\\backend') }
$handle | Select-Object ProcessName, Id | Format-Table -AutoSize

# Also check for any dotnet still running
Get-Process -Name dotnet -ErrorAction SilentlyContinue | Select-Object ProcessName, Id | Format-Table -AutoSize

# Check for handle.exe style - look at who has files open in backend
Write-Host "Trying to test rename..."
try {
    Rename-Item C:\Meastro\backend C:\Meastro\backend_test -ErrorAction Stop
    Rename-Item C:\Meastro\backend_test C:\Meastro\backend
    Write-Host "Rename succeeded - directory is NOT locked"
} catch {
    Write-Host "Rename FAILED: $($_.Exception.Message)"
}
