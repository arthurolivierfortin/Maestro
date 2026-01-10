<#
Prep PR formatting script

Runs Prettier on all JavaScript files, then runs ESLint --fix when available.
Usage: from repository root in PowerShell
    .\scripts\prep-pr.ps1

This script will:
- verify node/npm is available
- run `npx prettier --write "**/*.js"`
- run `npx eslint --fix "**/*.js"` if eslint is installable
- show `git status` and optionally stage all changes
#>

Set-StrictMode -Version Latest

function Write-Info($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Info "Preparing repository for PR: running formatters and linters"

# Ensure we're at repo root (assumes script run from repo root or anywhere inside)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location (Resolve-Path "$PSScriptRoot\..") | Out-Null

# Check for npm/npx
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "npm is not installed or not on PATH. Install Node.js and npm to continue.";
    exit 2
}

# Run Prettier
Write-Info "Running Prettier on all .js files..."
try {
    npx prettier --version > $null 2>&1
} catch {
    Write-Warn "Prettier not found with npx. Attempting to install locally..."
}

try {
    npx prettier --write "**/*.js"
    Write-Info "Prettier finished."
} catch {
    Write-Err "Prettier failed. Please ensure Prettier is installed (npm i -D prettier) or available via npx.";
}


