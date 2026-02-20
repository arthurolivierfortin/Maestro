$sessionId = '5719f8d1-8d11-4daf-b58f-a0fdccca18f3'

# Search common session storage locations
$searchPaths = @(
    'C:\Meastro\content\sessions',
    'C:\Meastro\content\system\sessions',
    'C:\Meastro\data',
    'C:\Meastro\apps\backend\data'
)

Write-Host "=== Searching for session $sessionId ==="

# Search by session ID in filenames
foreach ($path in $searchPaths) {
    if (Test-Path $path) {
        Write-Host "`nSearching in: $path"
        $found = Get-ChildItem $path -Recurse -Filter '*.json' -ErrorAction SilentlyContinue
        foreach ($f in $found) {
            Write-Host "  Found: $($f.FullName)"
        }
    } else {
        Write-Host "`nNot found: $path"
    }
}

# Search for session ID in file contents under content/
Write-Host "`n=== Searching file contents for session ID ==="
$contentDirs = @('C:\Meastro\content', 'C:\Meastro\data', 'C:\Meastro\apps\backend\data')
foreach ($dir in $contentDirs) {
    if (Test-Path $dir) {
        Write-Host "Scanning: $dir"
        $files = Get-ChildItem $dir -Recurse -Filter '*.json' -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 10MB }
        foreach ($f in $files) {
            $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
            if ($content -match $sessionId) {
                Write-Host "  Match in: $($f.FullName)"
            }
        }
    }
}

# Check for session-related directories at root
Write-Host "`n=== Session-related directories at Meastro root ==="
Get-ChildItem 'C:\Meastro' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'session|data|store|state' } | ForEach-Object {
    Write-Host "  Dir: $($_.FullName)"
    Get-ChildItem $_.FullName -ErrorAction SilentlyContinue | Select-Object -First 10 | ForEach-Object {
        Write-Host "    $($_.Name)"
    }
}

# Show content directory structure
Write-Host "`n=== Content directory structure ==="
if (Test-Path 'C:\Meastro\content') {
    Get-ChildItem 'C:\Meastro\content' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $($_.Name)/"
        Get-ChildItem $_.FullName -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "    $($_.Name)/"
        }
    }
}
