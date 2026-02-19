# Check all processes that might lock files in backend
$procs = Get-Process | Where-Object { $_.ProcessName -match 'dotnet|code|node|Maestro' }
$procs | Select-Object ProcessName, Id | Format-Table -AutoSize

# Try handle.exe if available
$handlePath = "C:\Sysinternals\handle.exe"
if (Test-Path $handlePath) {
    & $handlePath C:\Meastro\backend 2>$null | Select-Object -First 20
} else {
    Write-Host "handle.exe not found at $handlePath"
    Write-Host "Trying alternative: checking for open file handles via PowerShell..."
}

# Check if it's a git index.lock issue
if (Test-Path C:\Meastro\.git\index.lock) {
    Write-Host "Found .git/index.lock - this could be the issue"
} else {
    Write-Host "No .git/index.lock found"
}
