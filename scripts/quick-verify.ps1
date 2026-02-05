<#
.SYNOPSIS
    Quick verification script for Claude to check frontend state

.DESCRIPTION
    Minimal verification that can be run quickly:
    1. Checks JSON files
    2. Checks API endpoints
    3. Reports synchronization status

.EXAMPLE
    .\quick-verify.ps1
#>

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== QUICK VERIFICATION ===" -ForegroundColor Cyan

# Layer 1: Count files
$agentFiles = Get-ChildItem -Path "$ProjectRoot\blocks\agents" -Filter "*.json" -File -ErrorAction SilentlyContinue
$toolFiles = Get-ChildItem -Path "$ProjectRoot\blocks\tools" -Filter "*.json" -File -ErrorAction SilentlyContinue

Write-Host "Files: $($agentFiles.Count) agents, $($toolFiles.Count) tools"

# Layer 2: Check API
try {
    $agents = Invoke-RestMethod -Uri "http://localhost:5000/api/agents" -TimeoutSec 3 -ErrorAction Stop
    $apiAgentCount = if ($agents -is [array]) { $agents.Count } else { 0 }
    Write-Host "API: $apiAgentCount agents returned" -ForegroundColor Green

    # List agents
    foreach ($a in $agents) {
        Write-Host "  - $($a.id)" -ForegroundColor Gray
    }
} catch {
    Write-Host "API: Backend not running" -ForegroundColor Red
    $apiAgentCount = 0
}

# Layer 3: Check Frontend
try {
    $null = Invoke-WebRequest -Uri "http://localhost:5173/debug" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "Frontend: Accessible at /debug" -ForegroundColor Green
} catch {
    Write-Host "Frontend: Not running" -ForegroundColor Red
}

# Sync check
Write-Host ""
if ($apiAgentCount -gt 0 -and $agentFiles.Count -gt 0) {
    if ($apiAgentCount -eq $agentFiles.Count) {
        Write-Host "SYNC: OK ($apiAgentCount/$($agentFiles.Count))" -ForegroundColor Green
    } else {
        Write-Host "SYNC: MISMATCH - API=$apiAgentCount, Files=$($agentFiles.Count)" -ForegroundColor Yellow
    }
}

Write-Host "=========================" -ForegroundColor Cyan
