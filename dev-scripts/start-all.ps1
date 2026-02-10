# Maestro - Full Stack Startup Script
# Starts LLM-Provider, Maestro Backend, and Maestro Frontend

param(
    [string]$Model = "deepseek-ai/deepseek-coder-1.3b-instruct",
    [switch]$SkipLLM = $false,
    [switch]$BackendOnly = $false
)

$ErrorActionPreference = "Stop"
$MaestroRoot = Split-Path -Parent $PSScriptRoot
$LLMProviderRoot = "C:\LLM-Provider"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Maestro - Full Stack Startup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Step 1: Start LLM-Provider (if not skipped)
if (-not $SkipLLM) {
    Write-Host "[1/3] Starting LLM-Provider..." -ForegroundColor Yellow

    if (Test-Path $LLMProviderRoot) {
        # Check if already running
        if (Test-Port 8000) {
            Write-Host "  LLM-Provider already running on port 8000" -ForegroundColor Green
        } else {
            Write-Host "  Starting Python server with model: $Model" -ForegroundColor Cyan

            # Start Python server in a new window
            $pythonScript = @"
Set-Location '$LLMProviderRoot'
`$env:LLM_PRELOAD_MODEL = '$Model'
Write-Host 'LLM-Provider starting...' -ForegroundColor Cyan
Write-Host 'Model: $Model' -ForegroundColor White
Write-Host 'Port: 8000' -ForegroundColor White
python -m uvicorn api.server:app --host 0.0.0.0 --port 8000
"@
            Start-Process powershell -ArgumentList "-NoExit", "-Command", $pythonScript

            Write-Host "  Waiting for LLM-Provider to start (30s timeout)..." -ForegroundColor Gray
            $timeout = 30
            $elapsed = 0
            while (-not (Test-Port 8000) -and $elapsed -lt $timeout) {
                Start-Sleep -Seconds 2
                $elapsed += 2
                Write-Host "." -NoNewline
            }
            Write-Host ""

            if (Test-Port 8000) {
                Write-Host "  LLM-Provider started successfully!" -ForegroundColor Green
            } else {
                Write-Host "  Warning: LLM-Provider may not have started. Continuing anyway..." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  Warning: LLM-Provider not found at $LLMProviderRoot" -ForegroundColor Yellow
        Write-Host "  Skipping LLM-Provider startup..." -ForegroundColor Yellow
    }
    Write-Host ""
}

# Step 2: Start Maestro Backend
Write-Host "[2/3] Starting Maestro Backend..." -ForegroundColor Yellow

if (Test-Port 5000) {
    Write-Host "  Backend already running on port 5000" -ForegroundColor Green
} else {
    # Set environment variables
    $env:MAESTRO_GLOBAL_BLOCKS_PATH = "$MaestroRoot\blocks"
    $env:MAESTRO_REPO_ROOT = $MaestroRoot

    # Start backend in a new window
    $backendScript = @"
Set-Location '$MaestroRoot\backend\src\Maestro.Api'
`$env:MAESTRO_GLOBAL_BLOCKS_PATH = '$MaestroRoot\blocks'
`$env:MAESTRO_REPO_ROOT = '$MaestroRoot'
Write-Host 'Maestro Backend starting...' -ForegroundColor Cyan
Write-Host 'Port: 5000' -ForegroundColor White
dotnet run --urls=http://localhost:5000
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

    Write-Host "  Waiting for Backend to start (20s timeout)..." -ForegroundColor Gray
    $timeout = 20
    $elapsed = 0
    while (-not (Test-Port 5000) -and $elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $elapsed += 2
        Write-Host "." -NoNewline
    }
    Write-Host ""

    if (Test-Port 5000) {
        Write-Host "  Backend started successfully!" -ForegroundColor Green
    } else {
        Write-Host "  Warning: Backend may not have started." -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 3: Start Maestro Frontend (if not backend only)
if (-not $BackendOnly) {
    Write-Host "[3/3] Starting Maestro Frontend..." -ForegroundColor Yellow

    if (Test-Port 5173) {
        Write-Host "  Frontend already running on port 5173" -ForegroundColor Green
    } else {
        # Start frontend in a new window
        $frontendScript = @"
Set-Location '$MaestroRoot\frontend'
`$env:VITE_API_BASE_URL = 'http://localhost:5000'
`$env:VITE_USE_MOCK_BACKEND = 'false'
Write-Host 'Maestro Frontend starting...' -ForegroundColor Cyan
Write-Host 'Port: 5173' -ForegroundColor White
npm run dev
"@
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

        Write-Host "  Waiting for Frontend to start..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
        Write-Host "  Frontend should be starting..." -ForegroundColor Green
    }
    Write-Host ""
}

# Summary
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Startup Complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor White
if (-not $SkipLLM) {
    Write-Host "  LLM-Provider:    http://localhost:8000" -ForegroundColor Cyan
}
Write-Host "  Maestro Backend: http://localhost:5000" -ForegroundColor Cyan
if (-not $BackendOnly) {
    Write-Host "  Maestro Frontend: http://localhost:5173" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop the services." -ForegroundColor Gray
