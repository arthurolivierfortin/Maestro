<#
.SYNOPSIS
    Runs capability tests for all available models via LLM Provider.

.DESCRIPTION
    This script queries the LLM Provider for available models and runs
    capability tests on each one, storing results in the Knowledge Base.

.PARAMETER LLMProviderUrl
    URL of the LLM Provider API (default: http://localhost:8000)

.PARAMETER BackendUrl
    URL of the Maestro Backend API (default: http://localhost:5000)

.PARAMETER Categories
    Comma-separated list of categories to test (default: all)

.EXAMPLE
    .\run-all-models.ps1
    .\run-all-models.ps1 -Categories "outputFormat,reasoning"
#>

param(
    [string]$LLMProviderUrl = "http://localhost:8000",
    [string]$BackendUrl = "http://localhost:5000",
    [string]$Categories = "all"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TestScript = Join-Path $ScriptDir "test-model-capabilities.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Maestro Model Testing - All Models" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check LLM Provider
Write-Host "Checking LLM Provider at $LLMProviderUrl..." -ForegroundColor Gray
try {
    $Health = Invoke-RestMethod -Uri "$LLMProviderUrl/health" -Method Get -TimeoutSec 5
    Write-Host "LLM Provider: Online" -ForegroundColor Green
} catch {
    Write-Host "LLM Provider: Offline" -ForegroundColor Red
    Write-Host "Please start the LLM Provider first." -ForegroundColor Yellow
    exit 1
}

# Get available models
Write-Host "Fetching available models..." -ForegroundColor Gray
try {
    $ModelsResponse = Invoke-RestMethod -Uri "$LLMProviderUrl/v1/models" -Method Get -TimeoutSec 10
    $AvailableModels = @()

    # Parse models from response - handle different response formats
    if ($ModelsResponse.data) {
        # OpenAI-style format
        $AvailableModels = $ModelsResponse.data | ForEach-Object { $_.id }
    } elseif ($ModelsResponse.models -is [System.Collections.IDictionary] -or $ModelsResponse.models.PSObject.Properties) {
        # LLM Provider format - models is an object with model IDs as keys
        $AvailableModels = $ModelsResponse.models.PSObject.Properties.Name
    } elseif ($ModelsResponse.models -is [array]) {
        $AvailableModels = $ModelsResponse.models
    } elseif ($ModelsResponse.available_models) {
        $AvailableModels = $ModelsResponse.available_models
    }

    if ($AvailableModels.Count -eq 0) {
        Write-Host "No models available from LLM Provider." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "Found $($AvailableModels.Count) model(s):" -ForegroundColor Green
    $AvailableModels | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
} catch {
    Write-Host "Failed to fetch models: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Run tests for each model
$Results = @()
$TotalModels = $AvailableModels.Count
$Current = 0

foreach ($ModelId in $AvailableModels) {
    $Current++
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "[$Current/$TotalModels] Testing: $ModelId" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    try {
        # Run the test script
        $Output = & $TestScript -ModelId $ModelId -LLMProviderUrl $LLMProviderUrl -Categories $Categories

        # Parse the JSON output (last line)
        $JsonOutput = $Output | Select-Object -Last 1
        $TestResult = $JsonOutput | ConvertFrom-Json

        $Results += @{
            modelId = $ModelId
            success = $true
            score = $TestResult.summary.totalScore
            maxScore = $TestResult.summary.maxScore
            percentage = $TestResult.summary.percentage
            classification = $TestResult.summary.classification
        }

        Write-Host "Completed: $($TestResult.summary.classification) ($($TestResult.summary.percentage)%)" -ForegroundColor Green
    } catch {
        Write-Host "Failed to test $ModelId : $_" -ForegroundColor Red
        $Results += @{
            modelId = $ModelId
            success = $false
            error = $_.Exception.Message
        }
    }

    Write-Host ""
}

# Print summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FINAL SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$SuccessCount = ($Results | Where-Object { $_.success }).Count
$FailCount = ($Results | Where-Object { -not $_.success }).Count

Write-Host "Tested: $TotalModels models"
Write-Host "Success: $SuccessCount | Failed: $FailCount"
Write-Host ""

Write-Host "Results:" -ForegroundColor White
foreach ($R in $Results) {
    if ($R.success) {
        $Color = switch ($R.classification) {
            "Excellent" { "Green" }
            "Good" { "Cyan" }
            "Medium" { "Yellow" }
            "Weak" { "Red" }
            default { "Gray" }
        }
        Write-Host "  $($R.modelId): $($R.classification) ($($R.percentage)%)" -ForegroundColor $Color
    } else {
        Write-Host "  $($R.modelId): FAILED - $($R.error)" -ForegroundColor Red
    }
}

# Output JSON
$Results | ConvertTo-Json -Depth 5 -Compress
