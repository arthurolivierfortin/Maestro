<#
.SYNOPSIS
    Automated agent training script for Maestro

.DESCRIPTION
    This script automates the process of training Maestro agents by:
    1. Creating a training configuration
    2. Running multiple iterations
    3. Monitoring progress
    4. Generating a metrics report

.PARAMETER AgentId
    The ID of the agent to train

.PARAMETER Iterations
    Number of training iterations (default: 50)

.PARAMETER Goal
    Optimization goal: quality, cost, or speed (default: quality)

.PARAMETER Parallel
    Number of parallel iterations (default: 2)

.PARAMETER TestInputs
    JSON string of test inputs for training

.EXAMPLE
    .\train-agent.ps1 -AgentId "ui-feature-developer" -Iterations 30 -Goal quality

.EXAMPLE
    .\train-agent.ps1 -AgentId "code-developer" -TestInputs '{"task": "Add login", "projectPath": "C:/test"}'
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AgentId,

    [int]$Iterations = 50,

    [ValidateSet("quality", "cost", "speed")]
    [string]$Goal = "quality",

    [int]$Parallel = 2,

    [int]$DelayMs = 1000,

    [string]$TestInputs = "",

    [string]$OutputDir = ".\training-reports"
)

$ErrorActionPreference = "Stop"

# Configuration
$MaestroCli = "node C:\Meastro\tools\maestro-cli\index.js"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$ReportFile = "$OutputDir\training-$AgentId-$Timestamp.json"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $time = Get-Date -Format "HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$time] [$Level] $Message" -ForegroundColor $color
}

function Invoke-Maestro {
    param([string]$Command)
    $result = Invoke-Expression "$MaestroCli $Command" 2>&1
    return $result
}

# ==============================================================================
# MAIN SCRIPT
# ==============================================================================

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  MAESTRO AGENT TRAINING SCRIPT" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# Step 1: Verify agent exists
Write-Log "Verifying agent: $AgentId"
$agentInfo = Invoke-Maestro "agents info $AgentId"
if ($agentInfo -like "*not found*" -or $agentInfo -like "*error*") {
    Write-Log "Agent '$AgentId' not found!" "ERROR"
    exit 1
}
Write-Log "Agent found" "SUCCESS"

# Step 2: Get current metrics (baseline)
Write-Log "Getting baseline metrics..."
$baselineMetrics = Invoke-Maestro "agents metrics $AgentId"
Write-Host $baselineMetrics

# Step 3: Create training configuration
$configId = "train-$AgentId-$Timestamp"
Write-Log "Creating training configuration: $configId"

$createCmd = "training create --name `"$configId`" --workflow $AgentId --iterations $Iterations --parallel $Parallel --goal $Goal --delay $DelayMs"
$createResult = Invoke-Maestro $createCmd

if ($createResult -like "*error*") {
    Write-Log "Failed to create training config: $createResult" "ERROR"
    exit 1
}
Write-Log "Training config created" "SUCCESS"

# Step 4: Start training
Write-Log "Starting training run..."

$startCmd = "training start $configId"
if ($TestInputs) {
    $startCmd += " --inputs '$TestInputs'"
}

$startResult = Invoke-Maestro $startCmd
Write-Host $startResult

# Extract run ID (assuming format contains "Run ID: xxx" or similar)
$runId = ($startResult | Select-String -Pattern "run-\w+").Matches.Value
if (-not $runId) {
    $runId = $configId  # Fallback
}

Write-Log "Training started with run ID: $runId"

# Step 5: Monitor progress
Write-Log "Monitoring progress (press Ctrl+C to stop monitoring)..."

$completed = $false
$lastProgress = ""

while (-not $completed) {
    Start-Sleep -Seconds 10

    $runInfo = Invoke-Maestro "training run $runId"

    # Check status
    if ($runInfo -like "*completed*") {
        $completed = $true
        Write-Log "Training completed!" "SUCCESS"
    }
    elseif ($runInfo -like "*failed*") {
        $completed = $true
        Write-Log "Training failed!" "ERROR"
    }
    elseif ($runInfo -like "*cancelled*") {
        $completed = $true
        Write-Log "Training cancelled" "WARN"
    }
    else {
        # Extract progress
        $progress = ($runInfo | Select-String -Pattern "\d+/\d+").Matches.Value
        if ($progress -and $progress -ne $lastProgress) {
            Write-Log "Progress: $progress iterations"
            $lastProgress = $progress
        }
    }
}

# Step 6: Get final metrics
Write-Log "Getting final metrics..."
$finalMetrics = Invoke-Maestro "agents metrics $AgentId"
Write-Host $finalMetrics

# Step 7: Generate report
Write-Log "Generating report..."

$report = @{
    agentId = $AgentId
    configId = $configId
    runId = $runId
    parameters = @{
        iterations = $Iterations
        goal = $Goal
        parallel = $Parallel
        delayMs = $DelayMs
    }
    timestamp = $Timestamp
    baselineMetrics = $baselineMetrics
    finalMetrics = $finalMetrics
}

$report | ConvertTo-Json -Depth 10 | Out-File $ReportFile -Encoding UTF8

Write-Log "Report saved to: $ReportFile" "SUCCESS"

# Step 8: Summary
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  TRAINING SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Agent:        $AgentId"
Write-Host "Iterations:   $Iterations"
Write-Host "Goal:         $Goal"
Write-Host "Report:       $ReportFile"
Write-Host ""

# Show leaderboard position
Write-Log "Current leaderboard position:"
$leaderboard = Invoke-Maestro "foundry leaderboard --limit 10"
Write-Host $leaderboard

Write-Host ""
Write-Log "Training complete!" "SUCCESS"
