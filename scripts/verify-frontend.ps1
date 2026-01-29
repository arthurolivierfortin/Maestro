<#
.SYNOPSIS
    Frontend Verification Script - 5 Layer Verification

.DESCRIPTION
    This script performs a comprehensive verification of frontend-backend synchronization:
    1. Layer 1: Verify JSON files exist in blocks/agents/ and blocks/tools/
    2. Layer 2: Verify Backend API returns correct data (via CLI Maestro)
    3. Layer 3: Verify Frontend debug endpoint
    4. Layer 4: Run E2E tests with Playwright
    5. Layer 5: Generate screenshots for visual verification

.PARAMETER SkipE2E
    Skip E2E tests (useful if Playwright is not installed)

.PARAMETER SkipScreenshots
    Skip screenshot generation

.PARAMETER ReportOnly
    Only generate a report without running tests

.EXAMPLE
    .\verify-frontend.ps1
    .\verify-frontend.ps1 -SkipE2E
    .\verify-frontend.ps1 -ReportOnly
#>

param(
    [switch]$SkipE2E,
    [switch]$SkipScreenshots,
    [switch]$ReportOnly
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Colors for output
function Write-Title($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Success($text) { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Failure($text) { Write-Host "  [FAIL] $text" -ForegroundColor Red }
function Write-Info($text) { Write-Host "  [INFO] $text" -ForegroundColor Yellow }

# Results storage
$results = @{
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    layers = @{}
}

Write-Host "`n"
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   MAESTRO FRONTEND VERIFICATION       " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# ========================================
# LAYER 1: Verify JSON Files
# ========================================
Write-Title "LAYER 1: JSON Files Verification"

$agentsPath = Join-Path $ProjectRoot "blocks\agents"
$toolsPath = Join-Path $ProjectRoot "blocks\tools"

$agentFiles = @()
$toolFiles = @()

if (Test-Path $agentsPath) {
    $agentFiles = Get-ChildItem -Path $agentsPath -Filter "*.json" -File
    Write-Success "Agents folder exists: $agentsPath"
    Write-Info "Found $($agentFiles.Count) agent JSON files:"
    foreach ($file in $agentFiles) {
        Write-Host "    - $($file.Name)" -ForegroundColor Gray
    }
} else {
    Write-Failure "Agents folder not found: $agentsPath"
}

if (Test-Path $toolsPath) {
    $toolFiles = Get-ChildItem -Path $toolsPath -Filter "*.json" -File
    Write-Success "Tools folder exists: $toolsPath"
    Write-Info "Found $($toolFiles.Count) tool JSON files:"
    foreach ($file in $toolFiles) {
        Write-Host "    - $($file.Name)" -ForegroundColor Gray
    }
} else {
    Write-Info "Tools folder not found: $toolsPath (may be empty)"
}

$results.layers["files"] = @{
    status = "completed"
    agentCount = $agentFiles.Count
    toolCount = $toolFiles.Count
    agentFiles = $agentFiles | ForEach-Object { $_.Name }
    toolFiles = $toolFiles | ForEach-Object { $_.Name }
}

# ========================================
# LAYER 2: Backend API Verification
# ========================================
Write-Title "LAYER 2: Backend API Verification (via curl)"

$apiBase = "http://localhost:5000"

function Test-ApiEndpoint($endpoint, $name) {
    try {
        $response = Invoke-RestMethod -Uri "$apiBase$endpoint" -Method Get -TimeoutSec 5 -ErrorAction Stop
        return @{
            status = "success"
            data = $response
        }
    } catch {
        return @{
            status = "error"
            error = $_.Exception.Message
        }
    }
}

# Test health
$healthResult = Test-ApiEndpoint "/api/health" "Health"
if ($healthResult.status -eq "success") {
    Write-Success "Backend health: OK"
    Write-Info "Version: $($healthResult.data.version)"
} else {
    Write-Failure "Backend not responding: $($healthResult.error)"
}

# Test agents
$agentsResult = Test-ApiEndpoint "/api/agents" "Agents"
if ($agentsResult.status -eq "success") {
    $apiAgentCount = if ($agentsResult.data -is [array]) { $agentsResult.data.Count } else { 0 }
    Write-Success "Agents API: $apiAgentCount agents returned"
    foreach ($agent in $agentsResult.data) {
        Write-Host "    - $($agent.id): $($agent.name)" -ForegroundColor Gray
    }
} else {
    Write-Failure "Agents API failed: $($agentsResult.error)"
    $apiAgentCount = 0
}

# Test tools
$toolsResult = Test-ApiEndpoint "/api/tools" "Tools"
if ($toolsResult.status -eq "success") {
    $apiToolCount = if ($toolsResult.data -is [array]) { $toolsResult.data.Count } else { 0 }
    Write-Success "Tools API: $apiToolCount tools returned"
} else {
    Write-Info "Tools API: $($toolsResult.error)"
    $apiToolCount = 0
}

# Test foundry overview
$foundryResult = Test-ApiEndpoint "/api/foundry/overview" "Foundry"
if ($foundryResult.status -eq "success") {
    Write-Success "Foundry API: agentCount=$($foundryResult.data.agentCount), toolCount=$($foundryResult.data.toolCount)"
} else {
    Write-Info "Foundry API: $($foundryResult.error)"
}

$results.layers["api"] = @{
    status = if ($healthResult.status -eq "success") { "completed" } else { "failed" }
    health = $healthResult.status
    agentCount = $apiAgentCount
    toolCount = $apiToolCount
}

# ========================================
# LAYER 3: Frontend Debug Endpoint
# ========================================
Write-Title "LAYER 3: Frontend Debug Page Verification"

$frontendBase = "http://localhost:5173"

try {
    $debugResponse = Invoke-WebRequest -Uri "$frontendBase/debug" -Method Get -TimeoutSec 5 -ErrorAction Stop
    if ($debugResponse.StatusCode -eq 200) {
        Write-Success "Frontend debug page accessible"
        $results.layers["frontend"] = @{
            status = "completed"
            accessible = $true
        }
    }
} catch {
    Write-Failure "Frontend not responding: $($_.Exception.Message)"
    Write-Info "Make sure frontend is running: cd frontend && npm run dev"
    $results.layers["frontend"] = @{
        status = "failed"
        accessible = $false
        error = $_.Exception.Message
    }
}

# ========================================
# LAYER 4: E2E Tests
# ========================================
if (-not $SkipE2E -and -not $ReportOnly) {
    Write-Title "LAYER 4: E2E Tests (Playwright)"

    $frontendPath = Join-Path $ProjectRoot "frontend"
    Push-Location $frontendPath

    # Check if Playwright is installed
    if (Test-Path "node_modules\@playwright") {
        Write-Info "Running Playwright tests..."
        $e2eResult = & npx playwright test sync-verification.spec.ts --project=chromium --reporter=list 2>&1
        Write-Host $e2eResult

        $results.layers["e2e"] = @{
            status = "completed"
            output = $e2eResult -join "`n"
        }
        Write-Success "E2E tests completed"
    } else {
        Write-Info "Playwright not installed. Run: cd frontend && npm install && npx playwright install"
        $results.layers["e2e"] = @{
            status = "skipped"
            reason = "Playwright not installed"
        }
    }

    Pop-Location
} else {
    Write-Info "E2E tests skipped"
    $results.layers["e2e"] = @{
        status = "skipped"
        reason = "Skipped by parameter"
    }
}

# ========================================
# LAYER 5: Screenshots
# ========================================
if (-not $SkipScreenshots -and -not $ReportOnly) {
    Write-Title "LAYER 5: Screenshot Generation"

    $frontendPath = Join-Path $ProjectRoot "frontend"
    $screenshotsPath = Join-Path $frontendPath "playwright-results\screenshots"

    if (Test-Path (Join-Path $frontendPath "node_modules\@playwright")) {
        Push-Location $frontendPath

        # Create screenshots directory
        New-Item -ItemType Directory -Force -Path $screenshotsPath | Out-Null

        Write-Info "Generating screenshots..."
        & npx playwright test "Screenshots for Visual" --project=chromium --reporter=list 2>&1 | Out-Null

        $screenshots = Get-ChildItem -Path $screenshotsPath -Filter "*.png" -File -ErrorAction SilentlyContinue
        if ($screenshots) {
            Write-Success "Generated $($screenshots.Count) screenshots:"
            foreach ($ss in $screenshots) {
                Write-Host "    - $($ss.Name)" -ForegroundColor Gray
            }
            $results.layers["screenshots"] = @{
                status = "completed"
                count = $screenshots.Count
                path = $screenshotsPath
                files = $screenshots | ForEach-Object { $_.Name }
            }
        } else {
            Write-Info "No screenshots generated"
            $results.layers["screenshots"] = @{
                status = "completed"
                count = 0
            }
        }

        Pop-Location
    } else {
        Write-Info "Screenshots skipped - Playwright not installed"
        $results.layers["screenshots"] = @{
            status = "skipped"
            reason = "Playwright not installed"
        }
    }
} else {
    Write-Info "Screenshots skipped"
    $results.layers["screenshots"] = @{
        status = "skipped"
        reason = "Skipped by parameter"
    }
}

# ========================================
# SUMMARY REPORT
# ========================================
Write-Host "`n"
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   VERIFICATION SUMMARY                " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

Write-Host "`nFiles (Layer 1):" -ForegroundColor Cyan
Write-Host "  Agent JSON files: $($results.layers.files.agentCount)"
Write-Host "  Tool JSON files: $($results.layers.files.toolCount)"

Write-Host "`nBackend API (Layer 2):" -ForegroundColor Cyan
Write-Host "  Status: $($results.layers.api.status)"
Write-Host "  Agents from API: $($results.layers.api.agentCount)"
Write-Host "  Tools from API: $($results.layers.api.toolCount)"

Write-Host "`nFrontend (Layer 3):" -ForegroundColor Cyan
Write-Host "  Accessible: $($results.layers.frontend.accessible)"

Write-Host "`nE2E Tests (Layer 4):" -ForegroundColor Cyan
Write-Host "  Status: $($results.layers.e2e.status)"

Write-Host "`nScreenshots (Layer 5):" -ForegroundColor Cyan
Write-Host "  Status: $($results.layers.screenshots.status)"
if ($results.layers.screenshots.path) {
    Write-Host "  Path: $($results.layers.screenshots.path)"
}

# Synchronization check
Write-Host "`n" -ForegroundColor Yellow
Write-Host "SYNCHRONIZATION CHECK:" -ForegroundColor Yellow
$fileAgentCount = $results.layers.files.agentCount
$apiAgentCount = $results.layers.api.agentCount

if ($apiAgentCount -gt 0) {
    if ($fileAgentCount -eq $apiAgentCount) {
        Write-Success "Files and API are synchronized ($fileAgentCount agents)"
    } else {
        Write-Failure "DESYNC DETECTED: Files=$fileAgentCount, API=$apiAgentCount"
    }
} else {
    Write-Info "Cannot verify sync - backend not running"
}

# Save report
$reportPath = Join-Path $ProjectRoot "verification-report.json"
$results | ConvertTo-Json -Depth 10 | Set-Content -Path $reportPath
Write-Host "`nReport saved to: $reportPath" -ForegroundColor Gray

Write-Host "`n========================================`n" -ForegroundColor Magenta
