$sessionId = '5719f8d1-8d11-4daf-b58f-a0fdccca18f3'
$sessionsDir = 'C:\Meastro\content\user\sessions'

Write-Host "=== Listing sessions in $sessionsDir ==="
if (Test-Path $sessionsDir) {
    Get-ChildItem $sessionsDir -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $($_.FullName)"
    }
} else {
    Write-Host "Sessions dir does not exist"
}

# Also check templates for session storage config
Write-Host "`n=== Checking templates dir ==="
$templatesDir = 'C:\Meastro\content\system\templates\sessions'
if (Test-Path $templatesDir) {
    Get-ChildItem $templatesDir -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $($_.Name)"
    }
}

# Check the backend for session storage configuration
Write-Host "`n=== Checking backend appsettings for session storage path ==="
$appsettings = 'C:\Meastro\apps\backend\src\Maestro.Api\appsettings.json'
if (Test-Path $appsettings) {
    $content = Get-Content $appsettings -Raw
    Write-Host $content
}

# Search broadly for the session ID across the entire Meastro directory (skip node_modules, .git, bin, obj)
Write-Host "`n=== Broad search for session ID (may take a moment) ==="
Get-ChildItem 'C:\Meastro' -Recurse -Filter '*.json' -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notmatch '(node_modules|\.git|bin|obj|\.next)' -and $_.Length -lt 5MB } |
    ForEach-Object {
        $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        if ($c -match '5719f8d1') {
            Write-Host "  FOUND in: $($_.FullName)"
        }
    }
Write-Host "Search complete."
