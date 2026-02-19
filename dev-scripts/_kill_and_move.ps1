# Kill C# language servers that lock backend/ directory
Get-Process -Name 'Microsoft.CodeAnalysis.LanguageServer' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Try the git mv now
cd C:\Meastro
git mv backend apps/backend 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "backend -> apps/backend: OK"
} else {
    Write-Host "backend -> apps/backend: FAILED, trying robocopy fallback..."
    # Fallback: use robocopy + git add/rm
    robocopy backend apps\backend /MIR /MT:4 /NFL /NDL /NJH /NJS /NC /NS /NP
    git add apps/backend/
    git rm -r --cached backend/
    Remove-Item -Recurse -Force backend
    Write-Host "backend -> apps/backend: OK (via robocopy)"
}

git mv frontend apps/desktop 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "frontend -> apps/desktop: OK"
} else {
    Write-Host "frontend -> apps/desktop: FAILED"
}

git mv maestro-mcp apps/mcp 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "maestro-mcp -> apps/mcp: OK"
} else {
    Write-Host "maestro-mcp -> apps/mcp: FAILED"
}

# Verify
Write-Host ""
Write-Host "Verification:"
Write-Host "apps/backend exists: $(Test-Path C:\Meastro\apps\backend)"
Write-Host "apps/desktop exists: $(Test-Path C:\Meastro\apps\desktop)"
Write-Host "apps/mcp exists: $(Test-Path C:\Meastro\apps\mcp)"
Write-Host "old backend exists: $(Test-Path C:\Meastro\backend)"
Write-Host "old frontend exists: $(Test-Path C:\Meastro\frontend)"
Write-Host "old maestro-mcp exists: $(Test-Path C:\Meastro\maestro-mcp)"
