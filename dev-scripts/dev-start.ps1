# Maestro Development Environment Startup Script
# This script manages the full development stack including LLM-Provider
#
# Usage:
#   .\dev-start.ps1                    # Start all services (Docker mode)
#   .\dev-start.ps1 -Mode local        # Start all services locally (no Docker)
#   .\dev-start.ps1 -SkipLLM           # Start without LLM-Provider
#   .\dev-start.ps1 -BackendOnly       # Start backend only
#   .\dev-start.ps1 -Stop              # Stop all services

param(
    [ValidateSet("docker", "local")]
    [string]$Mode = "local",
    [switch]$SkipLLM = $false,
    [switch]$BackendOnly = $false,
    [switch]$Stop = $false,
    [switch]$Rebuild = $false,
    [string]$Model = "deepseek-ai/deepseek-coder-1.3b-instruct"
)

$ErrorActionPreference = "Continue"
$MaestroRoot = Split-Path -Parent $PSScriptRoot
$LLMProviderRoot = "$MaestroRoot\llm-provider"

# .env loading is handled by the C# apps themselves (DotEnvLoader).
# No env var propagation needed from this script.

# Port configuration
$Ports = @{
    LLMProvider = 5010
    Backend = 5000
    Frontend = 5173
}

# Color output helper
function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
}

# Window title prefix for all Maestro service windows (used for cleanup)
$WindowTitlePrefix = "Maestro-Dev"

# Close previous Maestro service windows and kill processes on our ports
function Stop-PreviousServices {
    Write-Status "Cleaning up previous services..." "Gray"

    # Kill processes on our ports
    foreach ($port in @($Ports.LLMProvider, $Ports.Backend, $Ports.Frontend)) {
        if (Test-Port $port) {
            Stop-ProcessOnPort $port
        }
    }

    # Kill PowerShell windows we previously launched (matched by title prefix)
    Get-Process -Name powershell, pwsh -ErrorAction SilentlyContinue | Where-Object {
        try { $_.MainWindowTitle -like "Maestro-Dev*" } catch { $false }
    } | ForEach-Object {
        Write-Status "  Closing window: $($_.MainWindowTitle) (PID $($_.Id))" "Gray"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds 2
}

# Check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = $null
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        return $true
    } catch {
        return $false
    } finally {
        if ($connection) { $connection.Dispose() }
    }
}

# Kill process on port
function Stop-ProcessOnPort {
    param([int]$Port)
    $processes = netstat -ano | Select-String ":$Port\s" | ForEach-Object {
        $parts = $_ -split '\s+'
        $parts[-1]
    } | Select-Object -Unique

    foreach ($processId in $processes) {
        if ($processId -and $processId -ne "0") {
            try {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                Write-Status "  Killed process $processId on port $Port" "Yellow"
            } catch {}
        }
    }
}

# Wait for service health
function Wait-ForHealth {
    param(
        [string]$Url,
        [string]$ServiceName,
        [int]$TimeoutSeconds = 120,
        [int]$IntervalSeconds = 3
    )

    Write-Status "  Waiting for $ServiceName to be healthy..." "Gray"
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Status "  $ServiceName is healthy!" "Green"
                return $true
            }
        } catch {}
        Start-Sleep -Seconds $IntervalSeconds
        $elapsed += $IntervalSeconds
        Write-Host "." -NoNewline
    }
    Write-Host ""
    Write-Status "  Warning: $ServiceName health check timed out" "Yellow"
    return $false
}

# Stop all services
function Stop-AllServices {
    Write-Header "Stopping Maestro Services"

    if ($Mode -eq "docker") {
        Write-Status "Stopping Docker containers..." "Yellow"
        Push-Location $MaestroRoot
        docker-compose -f docker-compose.full.yml down 2>$null
        docker-compose -f docker-compose.backend.yml down 2>$null
        Pop-Location
    }

    # Kill any processes on our ports
    foreach ($service in $Ports.Keys) {
        $port = $Ports[$service]
        if (Test-Port $port) {
            Write-Status "Stopping service on port $port ($service)..." "Yellow"
            Stop-ProcessOnPort $port
        }
    }

    # Kill specific processes
    Stop-Process -Name "Maestro.Api" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "dotnet" -Force -ErrorAction SilentlyContinue 2>$null

    Write-Status "All services stopped." "Green"
}

# Start LLM-Provider .NET API locally
function Start-LLMProviderLocal {
    if ($SkipLLM) { return }

    Write-Status "[1/3] Starting LLM-Provider .NET API..." "Yellow"

    if (Test-Port $Ports.LLMProvider) {
        Write-Status "  Stopping existing LLM-Provider on port $($Ports.LLMProvider)..." "Yellow"
        Stop-ProcessOnPort $Ports.LLMProvider
        Start-Sleep -Seconds 2
    }

    $LLMProviderDotnet = "$LLMProviderRoot\dotnet"
    if (-not (Test-Path "$LLMProviderDotnet\src\LLMProvider.Web")) {
        Write-Status "  Warning: LLM-Provider .NET not found at $LLMProviderDotnet" "Yellow"
        return
    }

    # Start the .NET API in a new window (.env is loaded by DotEnvLoader in C#)
    $script = @"
`$Host.UI.RawUI.WindowTitle = 'Maestro-Dev LLM-Provider'
Set-Location '$LLMProviderDotnet\src\LLMProvider.Web'
`$env:MAESTRO_ROOT = '$MaestroRoot'
Write-Host 'LLM-Provider .NET API starting on port 5010' -ForegroundColor Cyan
dotnet run --urls=http://localhost:5010
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $script

    Wait-ForHealth -Url "http://localhost:5010/api/v1/health/" -ServiceName "LLM-Provider" -TimeoutSeconds 60
}

# Start Backend locally
function Start-BackendLocal {
    Write-Status "[2/3] Starting Maestro Backend..." "Yellow"

    if (Test-Port $Ports.Backend) {
        Write-Status "  Stopping existing Backend on port $($Ports.Backend)..." "Yellow"
        Stop-ProcessOnPort $Ports.Backend
        Start-Sleep -Seconds 2
    }

    # Kill any zombie processes
    Stop-ProcessOnPort $Ports.Backend
    Start-Sleep -Seconds 2

    # Start backend in a new window (.env is loaded by DotEnvLoader in C#)
    $script = @"
`$Host.UI.RawUI.WindowTitle = 'Maestro-Dev Backend'
Set-Location '$MaestroRoot\apps\backend\src\Maestro.Api'
`$env:MAESTRO_ROOT = '$MaestroRoot'
`$env:MAESTRO_GLOBAL_BLOCKS_PATH = '$MaestroRoot\content\system\blocks'
`$env:MAESTRO_REPO_ROOT = '$MaestroRoot'
`$env:LLMProvider__BaseUrl = 'http://localhost:5010'
`$env:LLMProvider__DefaultModel = '$Model'
Write-Host 'Maestro Backend starting on port 5000' -ForegroundColor Cyan
dotnet run --urls=http://localhost:5000
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $script

    Wait-ForHealth -Url "http://localhost:5000/api/health" -ServiceName "Backend" -TimeoutSeconds 60
}

# Start Frontend locally
function Start-FrontendLocal {
    if ($BackendOnly) { return }

    Write-Status "[3/3] Starting Maestro Frontend..." "Yellow"

    if (Test-Port $Ports.Frontend) {
        Write-Status "  Stopping existing Frontend on port $($Ports.Frontend)..." "Yellow"
        Stop-ProcessOnPort $Ports.Frontend
        Start-Sleep -Seconds 2
    }

    $script = @"
`$Host.UI.RawUI.WindowTitle = 'Maestro-Dev Frontend'
Set-Location '$MaestroRoot\apps\desktop'
`$env:VITE_API_BASE_URL = 'http://localhost:5000'
`$env:VITE_USE_MOCK_BACKEND = 'false'
Write-Host 'Maestro Frontend starting on port 5173' -ForegroundColor Cyan
npm run dev
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $script

    Start-Sleep -Seconds 5
    Write-Status "  Frontend should be starting..." "Green"
}

# Start with Docker
function Start-Docker {
    Write-Header "Starting Maestro (Docker Mode)"

    Push-Location $MaestroRoot

    $composeFile = "docker-compose.full.yml"
    if ($SkipLLM) {
        $composeFile = "docker-compose.backend.yml"
    }

    $buildFlag = ""
    if ($Rebuild) {
        $buildFlag = "--build"
    }

    Write-Status "Starting services with $composeFile..." "Yellow"

    $env:LLM_PROVIDER_PATH = $LLMProviderRoot
    $env:LLM_DEFAULT_MODEL = $Model

    if ($BackendOnly) {
        docker-compose -f $composeFile up -d $buildFlag backend llm-provider
    } else {
        docker-compose -f $composeFile up -d $buildFlag
    }

    Pop-Location

    # Wait for services
    if (-not $SkipLLM) {
        Wait-ForHealth -Url "http://localhost:8000/health" -ServiceName "LLM-Provider" -TimeoutSeconds 180
    }
    Wait-ForHealth -Url "http://localhost:5000/api/health" -ServiceName "Backend" -TimeoutSeconds 60
}

# Print summary
function Show-Summary {
    Write-Header "Maestro Development Environment"

    Write-Status "Services:" "White"

    if (-not $SkipLLM) {
        $llmStatus = if (Test-Port $Ports.LLMProvider) { "Running" } else { "Not Running" }
        $llmColor = if (Test-Port $Ports.LLMProvider) { "Green" } else { "Red" }
        Write-Host "  LLM-Provider:    " -NoNewline
        Write-Host "http://localhost:$($Ports.LLMProvider)" -ForegroundColor Cyan -NoNewline
        Write-Host " [$llmStatus]" -ForegroundColor $llmColor
    }

    $backendStatus = if (Test-Port $Ports.Backend) { "Running" } else { "Not Running" }
    $backendColor = if (Test-Port $Ports.Backend) { "Green" } else { "Red" }
    Write-Host "  Backend:         " -NoNewline
    Write-Host "http://localhost:$($Ports.Backend)" -ForegroundColor Cyan -NoNewline
    Write-Host " [$backendStatus]" -ForegroundColor $backendColor

    if (-not $BackendOnly) {
        $frontendStatus = if (Test-Port $Ports.Frontend) { "Running" } else { "Not Running" }
        $frontendColor = if (Test-Port $Ports.Frontend) { "Green" } else { "Red" }
        Write-Host "  Frontend:        " -NoNewline
        Write-Host "http://localhost:$($Ports.Frontend)" -ForegroundColor Cyan -NoNewline
        Write-Host " [$frontendStatus]" -ForegroundColor $frontendColor
    }

    Write-Host ""
    Write-Status "CLI Commands:" "White"
    Write-Status "  cd $MaestroRoot\packages\maestro-cli && node index.js health" "Gray"
    Write-Status "  cd $MaestroRoot\packages\maestro-cli && node index.js list-blocks" "Gray"
    Write-Host ""
}

# Get service info as JSON (for programmatic use)
function Get-ServiceInfo {
    $info = @{
        timestamp = (Get-Date -Format "o")
        mode = $Mode
        services = @{
            llmProvider = @{
                port = $Ports.LLMProvider
                running = (Test-Port $Ports.LLMProvider)
                url = "http://localhost:$($Ports.LLMProvider)"
            }
            backend = @{
                port = $Ports.Backend
                running = (Test-Port $Ports.Backend)
                url = "http://localhost:$($Ports.Backend)"
            }
            frontend = @{
                port = $Ports.Frontend
                running = (Test-Port $Ports.Frontend)
                url = "http://localhost:$($Ports.Frontend)"
            }
        }
    }
    return $info | ConvertTo-Json -Depth 3
}

# Main execution
if ($Stop) {
    Stop-AllServices
    exit 0
}

Write-Header "Maestro Development Startup ($Mode mode)"

# Always clean up previous services before starting fresh
Stop-PreviousServices

if ($Mode -eq "docker") {
    Start-Docker
} else {
    Start-LLMProviderLocal
    Start-BackendLocal
    Start-FrontendLocal
}

Show-Summary

# Output JSON info for scripts
$jsonInfo = Get-ServiceInfo
Write-Host ""
Write-Status "Service Info (JSON):" "Gray"
Write-Host $jsonInfo
