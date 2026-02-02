<#
.SYNOPSIS
    Tests model capabilities and generates detailed results for Maestro Knowledge Base.

.DESCRIPTION
    This script runs a comprehensive suite of tests against a language model
    to evaluate its capabilities in various areas:
    - Output format (JSON, structured data)
    - Instruction following
    - Context and memory
    - Reasoning and logic
    - Tool calling
    - Code generation

.PARAMETER ModelId
    The model ID to test (e.g., "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B")

.PARAMETER LLMProviderUrl
    URL of the LLM Provider API (default: http://localhost:8000)

.PARAMETER Categories
    Comma-separated list of categories to test (default: all)

.PARAMETER OutputPath
    Path to save the results JSON file

.PARAMETER SkipAnalysis
    Skip the LLM-based qualitative analysis at the end

.EXAMPLE
    .\test-model-capabilities.ps1 -ModelId "HuggingFaceTB/SmolLM2-1.7B-Instruct"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ModelId,

    [string]$LLMProviderUrl = "http://localhost:8000",

    [string]$Categories = "all",

    [string]$OutputPath = "",

    [switch]$SkipAnalysis
)

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TestDefinitionsPath = Join-Path $ScriptDir "test-definitions.json"

# Load test definitions
if (-not (Test-Path $TestDefinitionsPath)) {
    Write-Error "Test definitions not found at: $TestDefinitionsPath"
    exit 1
}

$TestDefinitions = Get-Content $TestDefinitionsPath -Raw | ConvertFrom-Json

# Initialize results structure
$Results = @{
    meta = @{
        testId = "test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        duration = @{
            totalMs = 0
            perTestAvgMs = 0
        }
        tester = "Maestro Model Tester"
        environment = @{
            llmProviderUrl = $LLMProviderUrl
            gpu = ""
            vramAvailable = ""
            platform = [System.Environment]::OSVersion.Platform.ToString()
        }
        templateVersion = $TestDefinitions.version
    }
    model = @{
        id = $ModelId
        displayName = ($ModelId -split "/")[-1]
        provider = ($ModelId -split "/")[0]
    }
    summary = @{
        totalScore = 0
        maxScore = 0
        percentage = 0
        classification = ""
        passedTests = 0
        failedTests = 0
        categoryScores = @{}
    }
    categories = @{}
    performance = @{
        tokensPerSecond = 0
        avgResponseTimeMs = 0
        totalTokensGenerated = 0
    }
    capabilities = @{}
}

# Start timing
$StartTime = Get-Date

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Model: $ModelId" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check LLM Provider
Write-Host "Checking LLM Provider at $LLMProviderUrl..." -ForegroundColor Gray
try {
    $HealthCheck = Invoke-RestMethod -Uri "$LLMProviderUrl/health" -Method Get -TimeoutSec 5
    Write-Host "LLM Provider is healthy" -ForegroundColor Green

    # Try to get GPU info
    try {
        $ModelsInfo = Invoke-RestMethod -Uri "$LLMProviderUrl/v1/models" -Method Get -TimeoutSec 5
        if ($ModelsInfo.gpu_info) {
            $Results.meta.environment.gpu = $ModelsInfo.gpu_info.name
            $Results.meta.environment.vramAvailable = "$([math]::Round($ModelsInfo.gpu_info.total_memory / 1GB, 1)) GB"
        }
    } catch {}
} catch {
    Write-Error "LLM Provider not available at $LLMProviderUrl"
    exit 1
}

# Switch to target model
Write-Host "Switching to model: $ModelId..." -ForegroundColor Gray
try {
    $SwitchBody = @{ model_id = $ModelId } | ConvertTo-Json
    $SwitchResult = Invoke-RestMethod -Uri "$LLMProviderUrl/v1/switch-model" -Method Post -Body $SwitchBody -ContentType "application/json" -TimeoutSec 120
    Write-Host "Model loaded successfully" -ForegroundColor Green

    if ($SwitchResult.model_info) {
        $Results.model.parameters = $SwitchResult.model_info.parameters
        $Results.model.contextWindow = $SwitchResult.model_info.context_length
    }
} catch {
    Write-Error "Failed to switch to model: $_"
    exit 1
}

Write-Host ""

# Function to call LLM
function Invoke-LLMGenerate {
    param(
        [string]$SystemPrompt,
        [string]$UserPrompt,
        [int]$MaxTokens = 256
    )

    $Body = @{
        prompt = $UserPrompt
        system_prompt = $SystemPrompt
        max_tokens = $MaxTokens
        temperature = 0.1
    } | ConvertTo-Json -Depth 10

    $StartCall = Get-Date

    try {
        $Response = Invoke-RestMethod -Uri "$LLMProviderUrl/v1/generate" -Method Post -Body $Body -ContentType "application/json" -TimeoutSec 60
        $Duration = ((Get-Date) - $StartCall).TotalMilliseconds

        return @{
            success = $true
            text = $Response.text
            tokens = if ($Response.tokens_generated) { $Response.tokens_generated } else { ($Response.text -split " ").Count }
            durationMs = [int]$Duration
        }
    } catch {
        return @{
            success = $false
            text = ""
            error = $_.Exception.Message
            durationMs = 0
        }
    }
}

# Evaluation functions
function Test-JsonContains {
    param($Response, $Expected)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    try {
        # Try to extract JSON from response
        $JsonMatch = [regex]::Match($Response, '\{[^{}]*\}|\[[^\[\]]*\]')
        if (-not $JsonMatch.Success) {
            $JsonMatch = [regex]::Match($Response, '(?s)\{.*\}|\[.*\]')
        }

        if ($JsonMatch.Success) {
            $Parsed = $JsonMatch.Value | ConvertFrom-Json -AsHashtable

            foreach ($Key in $Expected.PSObject.Properties.Name) {
                $ExpectedValue = $Expected.$Key
                if ($null -eq $Parsed[$Key]) { return 0 }

                if ($ExpectedValue -is [PSCustomObject]) {
                    # Nested object
                    foreach ($SubKey in $ExpectedValue.PSObject.Properties.Name) {
                        if ($Parsed[$Key][$SubKey] -ne $ExpectedValue.$SubKey) { return 0.5 }
                    }
                } else {
                    if ($Parsed[$Key] -ne $ExpectedValue) { return 0.7 }
                }
            }
            return 1.0
        }
        return 0
    } catch {
        return 0
    }
}

function Test-JsonEquals {
    param($Response, $Expected)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    try {
        $JsonMatch = [regex]::Match($Response, '\[[^\[\]]*\]|\{[^{}]*\}')
        if ($JsonMatch.Success) {
            $Parsed = $JsonMatch.Value | ConvertFrom-Json
            $ExpectedStr = $Expected | ConvertTo-Json -Compress
            $ParsedStr = $Parsed | ConvertTo-Json -Compress
            if ($ExpectedStr -eq $ParsedStr) { return 1.0 }
            return 0.5
        }
        return 0
    } catch {
        return 0
    }
}

function Test-ToolCall {
    param($Response, $ExpectedTool, $ExpectedArgs, $ArgContains)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    try {
        # Extract JSON from response
        $JsonMatch = [regex]::Match($Response, '\{[^{}]*"tool"[^{}]*\}')
        if (-not $JsonMatch.Success) {
            $JsonMatch = [regex]::Match($Response, '(?s)\{.*"tool".*\}')
        }

        if ($JsonMatch.Success) {
            $Parsed = $JsonMatch.Value | ConvertFrom-Json -AsHashtable

            # Check tool name (accept 'tool' or 'command' key)
            $ToolName = if ($Parsed["tool"]) { $Parsed["tool"] } elseif ($Parsed["command"]) { $Parsed["command"] } else { $null }

            if ($null -eq $ToolName) { return 0.3 }
            if ($ToolName -ne $ExpectedTool) { return 0.3 }

            # Check args if specified
            if ($ExpectedArgs -or $ArgContains) {
                $Args = $Parsed["args"]
                if ($null -eq $Args) { return 0.5 }

                $ArgsToCheck = if ($ExpectedArgs) { $ExpectedArgs } else { $ArgContains }
                foreach ($Key in $ArgsToCheck.PSObject.Properties.Name) {
                    $ExpectedValue = $ArgsToCheck.$Key
                    $ActualValue = $Args[$Key]

                    if ($null -eq $ActualValue) { return 0.7 }
                    if ($ArgContains) {
                        if (-not ($ActualValue -match [regex]::Escape($ExpectedValue))) { return 0.7 }
                    } else {
                        if ($ActualValue -ne $ExpectedValue) { return 0.7 }
                    }
                }
            }

            return 1.0
        }
        return 0
    } catch {
        return 0
    }
}

function Test-NoToolCall {
    param($Response, $ExpectedContent)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    $HasToolCall = $Response -match '"tool"\s*:' -or $Response -match '"command"\s*:'
    $HasContent = $Response -match [regex]::Escape($ExpectedContent)

    if (-not $HasToolCall -and $HasContent) { return 1.0 }
    if (-not $HasToolCall) { return 0.5 }
    return 0
}

function Test-ContainsAll {
    param($Response, $Expected)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    $Found = 0
    foreach ($Item in $Expected) {
        if ($Response -match [regex]::Escape($Item)) { $Found++ }
    }
    return $Found / $Expected.Count
}

function Test-ContainsAny {
    param($Response, $Expected)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    foreach ($Item in $Expected) {
        if ($Response -match [regex]::Escape($Item)) { return 1.0 }
    }
    return 0
}

function Test-Contains {
    param($Response, $Expected)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    if ($Response -match [regex]::Escape($Expected)) { return 1.0 }
    return 0
}

function Test-SingleWord {
    param($Response, $AcceptedAnswers)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    $Trimmed = $Response.Trim()
    foreach ($Answer in $AcceptedAnswers) {
        if ($Trimmed -eq $Answer -or $Trimmed -match "^$Answer[.!]?$") { return 1.0 }
    }
    # Check if it contains the answer but has extra text
    foreach ($Answer in $AcceptedAnswers) {
        if ($Response -match $Answer) { return 0.5 }
    }
    return 0
}

function Test-Regex {
    param($Response, $Pattern)

    if ([string]::IsNullOrWhiteSpace($Response)) { return 0 }

    $Trimmed = $Response.Trim()
    if ($Trimmed -match $Pattern) { return 1.0 }
    return 0
}

# Run tests
$CategoriesToTest = if ($Categories -eq "all") {
    $TestDefinitions.categories.PSObject.Properties.Name
} else {
    $Categories -split "," | ForEach-Object { $_.Trim() }
}

$TotalTests = 0
$TotalDuration = 0
$TotalTokens = 0

foreach ($CategoryName in $CategoriesToTest) {
    $Category = $TestDefinitions.categories.$CategoryName
    if (-not $Category) { continue }

    Write-Host "Category: $($Category.name)" -ForegroundColor Yellow

    $CategoryResult = @{
        score = 0
        maxScore = 0
        percentage = 0
        tests = @()
    }

    foreach ($Test in $Category.tests) {
        Write-Host "  Test $($Test.id): $($Test.name)..." -ForegroundColor Gray -NoNewline

        $TotalTests++

        # Call LLM
        $LLMResult = Invoke-LLMGenerate -SystemPrompt $Test.systemPrompt -UserPrompt $Test.userPrompt

        if (-not $LLMResult.success) {
            Write-Host " ERROR" -ForegroundColor Red
            $CategoryResult.tests += @{
                testId = $Test.id
                name = $Test.name
                score = 0
                maxScore = $Test.maxScore
                passed = $false
                error = $LLMResult.error
            }
            $CategoryResult.maxScore += $Test.maxScore
            continue
        }

        $TotalDuration += $LLMResult.durationMs
        $TotalTokens += $LLMResult.tokens

        # Evaluate response
        $Eval = $Test.evaluation
        $Score = 0

        switch ($Eval.method) {
            "json_contains" { $Score = Test-JsonContains -Response $LLMResult.text -Expected $Eval.expected }
            "json_equals" { $Score = Test-JsonEquals -Response $LLMResult.text -Expected $Eval.expected }
            "tool_call" { $Score = Test-ToolCall -Response $LLMResult.text -ExpectedTool $Eval.expectedTool -ExpectedArgs $Eval.expectedArgs -ArgContains $Eval.argContains }
            "no_tool_call" { $Score = Test-NoToolCall -Response $LLMResult.text -ExpectedContent $Eval.expectedContent }
            "contains_all" { $Score = Test-ContainsAll -Response $LLMResult.text -Expected $Eval.expected }
            "contains_any" { $Score = Test-ContainsAny -Response $LLMResult.text -Expected $Eval.expected }
            "contains" { $Score = Test-Contains -Response $LLMResult.text -Expected $Eval.expected }
            "single_word" { $Score = Test-SingleWord -Response $LLMResult.text -AcceptedAnswers $Eval.acceptedAnswers }
            "regex" { $Score = Test-Regex -Response $LLMResult.text -Pattern $Eval.pattern }
            default { $Score = 0 }
        }

        $TestScore = [int]($Score * $Test.maxScore)
        $Passed = $Score -ge 0.7

        if ($Passed) {
            Write-Host " PASS ($TestScore/$($Test.maxScore))" -ForegroundColor Green
        } else {
            Write-Host " FAIL ($TestScore/$($Test.maxScore))" -ForegroundColor Red
        }

        $CategoryResult.score += $TestScore
        $CategoryResult.maxScore += $Test.maxScore

        if ($Passed) { $Results.summary.passedTests++ }
        else { $Results.summary.failedTests++ }

        # Handle null/empty response text safely
        $ResponseText = if ([string]::IsNullOrEmpty($LLMResult.text)) { "" } else { $LLMResult.text }
        $ResponseLength = $ResponseText.Length
        $TruncatedResponse = if ($ResponseLength -gt 500) { $ResponseText.Substring(0, 500) } else { $ResponseText }

        $CategoryResult.tests += @{
            testId = $Test.id
            name = $Test.name
            description = $Test.description
            score = $TestScore
            maxScore = $Test.maxScore
            passed = $Passed
            prompt = @{
                system = $Test.systemPrompt
                user = $Test.userPrompt
            }
            response = @{
                raw = $TruncatedResponse
                truncated = $ResponseLength -gt 500
                tokensGenerated = $LLMResult.tokens
                durationMs = $LLMResult.durationMs
            }
            evaluation = @{
                method = $Eval.method
                matched = $Passed
                partialCredit = $Score
            }
        }
    }

    # Calculate category percentage
    if ($CategoryResult.maxScore -gt 0) {
        $CategoryResult.percentage = [int](($CategoryResult.score / $CategoryResult.maxScore) * 100)
    }

    $Results.categories[$CategoryName] = $CategoryResult
    $Results.summary.totalScore += $CategoryResult.score
    $Results.summary.maxScore += $CategoryResult.maxScore
    $Results.summary.categoryScores[$CategoryName] = @{
        score = $CategoryResult.score
        maxScore = $CategoryResult.maxScore
        percentage = $CategoryResult.percentage
    }

    Write-Host "  Category Score: $($CategoryResult.score)/$($CategoryResult.maxScore) ($($CategoryResult.percentage)%)" -ForegroundColor Cyan
    Write-Host ""
}

# Calculate final scores
$EndTime = Get-Date
$Results.meta.duration.totalMs = [int](($EndTime - $StartTime).TotalMilliseconds)
$Results.meta.duration.perTestAvgMs = if ($TotalTests -gt 0) { [int]($TotalDuration / $TotalTests) } else { 0 }

if ($Results.summary.maxScore -gt 0) {
    $Results.summary.percentage = [int](($Results.summary.totalScore / $Results.summary.maxScore) * 100)
}

# Determine classification
$Pct = $Results.summary.percentage
$Results.summary.classification = switch ($true) {
    ($Pct -ge 80) { "Excellent" }
    ($Pct -ge 65) { "Good" }
    ($Pct -ge 45) { "Medium" }
    ($Pct -ge 25) { "Weak" }
    default { "Insufficient" }
}

# Performance metrics
if ($TotalDuration -gt 0 -and $TotalTokens -gt 0) {
    $Results.performance.tokensPerSecond = [math]::Round(($TotalTokens / ($TotalDuration / 1000)), 1)
    $Results.performance.avgResponseTimeMs = [int]($TotalDuration / $TotalTests)
    $Results.performance.totalTokensGenerated = $TotalTokens
}

# Capabilities assessment
$Results.capabilities = @{
    toolCalling = @{
        supported = ($Results.summary.categoryScores["toolCalling"].percentage -ge 50)
        confidence = [math]::Round($Results.summary.categoryScores["toolCalling"].percentage / 100, 2)
        quality = switch ($Results.summary.categoryScores["toolCalling"].percentage) {
            { $_ -ge 80 } { "excellent" }
            { $_ -ge 60 } { "good" }
            { $_ -ge 40 } { "partial" }
            { $_ -ge 20 } { "poor" }
            default { "none" }
        }
    }
    jsonOutput = @{
        supported = ($Results.summary.categoryScores["outputFormat"].percentage -ge 50)
        confidence = [math]::Round($Results.summary.categoryScores["outputFormat"].percentage / 100, 2)
        quality = switch ($Results.summary.categoryScores["outputFormat"].percentage) {
            { $_ -ge 80 } { "excellent" }
            { $_ -ge 60 } { "good" }
            { $_ -ge 40 } { "partial" }
            default { "poor" }
        }
    }
    instructionFollowing = @{
        supported = ($Results.summary.categoryScores["instructionFollowing"].percentage -ge 40)
        confidence = [math]::Round($Results.summary.categoryScores["instructionFollowing"].percentage / 100, 2)
        quality = switch ($Results.summary.categoryScores["instructionFollowing"].percentage) {
            { $_ -ge 80 } { "excellent" }
            { $_ -ge 60 } { "good" }
            { $_ -ge 40 } { "partial" }
            default { "poor" }
        }
    }
    reasoning = @{
        supported = ($Results.summary.categoryScores["reasoning"].percentage -ge 40)
        confidence = [math]::Round($Results.summary.categoryScores["reasoning"].percentage / 100, 2)
        quality = switch ($Results.summary.categoryScores["reasoning"].percentage) {
            { $_ -ge 80 } { "excellent" }
            { $_ -ge 60 } { "good" }
            { $_ -ge 40 } { "partial" }
            default { "poor" }
        }
    }
    contextMemory = @{
        supported = ($Results.summary.categoryScores["contextMemory"].percentage -ge 50)
        confidence = [math]::Round($Results.summary.categoryScores["contextMemory"].percentage / 100, 2)
        quality = switch ($Results.summary.categoryScores["contextMemory"].percentage) {
            { $_ -ge 80 } { "excellent" }
            { $_ -ge 60 } { "good" }
            { $_ -ge 40 } { "partial" }
            default { "poor" }
        }
    }
}

# Print summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Model: $ModelId"
Write-Host "Total Score: $($Results.summary.totalScore) / $($Results.summary.maxScore) ($($Results.summary.percentage)%)"
Write-Host "Classification: $($Results.summary.classification)"
Write-Host "Passed: $($Results.summary.passedTests) | Failed: $($Results.summary.failedTests)"
Write-Host "Duration: $($Results.meta.duration.totalMs) ms"
Write-Host ""

# Generate run ID (modelId-timestamp format)
$RunId = "$($ModelId -replace '/', '-')-$($Results.meta.testId -replace 'test-', '')"
$Results.meta.runId = $RunId

# Output file path for local storage (blocks/scripts/model-testing -> project root)
if (-not $OutputPath) {
    $ProjectRoot = Split-Path (Split-Path (Split-Path $ScriptDir -Parent) -Parent) -Parent
    $OutputPath = Join-Path $ProjectRoot "docs\knowledge-base\model-test-runs\$RunId.json"
}

# Ensure directory exists
$OutputDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

# Save results locally
$Results | ConvertTo-Json -Depth 20 | Set-Content -Path $OutputPath -Encoding UTF8
Write-Host "Results saved to: $OutputPath" -ForegroundColor Green

# Post to Maestro backend API if available
$BackendUrl = "http://localhost:5000"
try {
    $ApiUrl = "$BackendUrl/api/knowledge-base/collections/model-test-runs?documentId=$RunId"
    $JsonBody = $Results | ConvertTo-Json -Depth 20
    $Response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $JsonBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "Results posted to Knowledge Base: $($Response.documentId)" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not post to backend API (may not be running): $_" -ForegroundColor Yellow
}

# Output JSON for piping
$Results | ConvertTo-Json -Depth 20 -Compress
