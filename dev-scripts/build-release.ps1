# build-release.ps1 — Build all Maestro components for release
# Usage: powershell -File dev-scripts/build-release.ps1 [-Configuration Release] [-OutputDir ./dist]

param(
    [string]$Configuration = "Release",
    [string]$OutputDir = "$PSScriptRoot/../dist",
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$SkipCli
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path "$PSScriptRoot/.."

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Maestro Build Release" -ForegroundColor Cyan
Write-Host "  Configuration: $Configuration" -ForegroundColor Cyan
Write-Host "  Output: $OutputDir" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Create output directory
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# ── Backend ──
if (-not $SkipBackend) {
    Write-Host "`n[1/3] Building Backend..." -ForegroundColor Yellow
    $backendProject = "$RepoRoot/backend/src/Maestro.Api/Maestro.Api.csproj"
    $backendOutput = "$OutputDir/backend"

    dotnet publish $backendProject `
        --configuration $Configuration `
        --output $backendOutput `
        --self-contained false

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Backend built to: $backendOutput" -ForegroundColor Green
}

# ── Frontend ──
if (-not $SkipFrontend) {
    Write-Host "`n[2/3] Building Frontend..." -ForegroundColor Yellow
    Push-Location "$RepoRoot/frontend"

    npm run build
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "Frontend build failed!" -ForegroundColor Red
        exit 1
    }

    # Copy web build output
    $frontendOutput = "$OutputDir/frontend"
    New-Item -ItemType Directory -Force -Path $frontendOutput | Out-Null
    Copy-Item -Path "dist/*" -Destination $frontendOutput -Recurse -Force

    Pop-Location
    Write-Host "Frontend built to: $frontendOutput" -ForegroundColor Green
}

# ── CLI ──
if (-not $SkipCli) {
    Write-Host "`n[3/3] Packaging CLI..." -ForegroundColor Yellow
    $cliOutput = "$OutputDir/cli"
    New-Item -ItemType Directory -Force -Path $cliOutput | Out-Null

    # Copy CLI files
    $cliSource = "$RepoRoot/maestro-cli"
    Copy-Item -Path "$cliSource/package.json" -Destination $cliOutput -Force
    Copy-Item -Path "$cliSource/index.js" -Destination $cliOutput -Force
    Copy-Item -Path "$cliSource/*.ts" -Destination $cliOutput -Force

    # Copy shared
    $sharedOutput = "$OutputDir/shared"
    New-Item -ItemType Directory -Force -Path $sharedOutput | Out-Null
    Copy-Item -Path "$RepoRoot/shared/*" -Destination $sharedOutput -Recurse -Force

    # Copy system content
    $contentOutput = "$OutputDir/content/system"
    New-Item -ItemType Directory -Force -Path $contentOutput | Out-Null
    Copy-Item -Path "$RepoRoot/content/system/*" -Destination $contentOutput -Recurse -Force

    Write-Host "CLI packaged to: $cliOutput" -ForegroundColor Green
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "  Output: $OutputDir" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
