param(
    [switch]$NoProfile
)

# Prepends the user's LocalAppData dotnet to PATH for this session and launches an interactive PowerShell
$dotnetPath = Join-Path $env:LOCALAPPDATA "Microsoft\dotnet"
if (-Not (Test-Path $dotnetPath)) {
    Write-Error "Local dotnet not found at $dotnetPath. Run dotnet-install.ps1 first."
    exit 1
}

$currentPath = $env:PATH
$newPath = $dotnetPath + ";" + $currentPath

if ($NoProfile) {
    powershell -NoLogo -NoExit -Command "$env:PATH='$newPath'"
}
else {
    powershell -NoLogo -NoExit -Command "$env:PATH='$newPath'; Import-Module Microsoft.PowerShell.Profile; Write-Host 'Dotnet 10 path prepended for this session: $dotnetPath'"
}
