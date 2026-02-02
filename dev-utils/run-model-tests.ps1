param(
    [Parameter(Mandatory=$true)]
    [string]$ModelId,

    [string]$OutputFile = ""
)

$results = @{
    model = $ModelId
    date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    tests = @{}
    scores = @{}
}

function Test-Model {
    param(
        [string]$Prompt,
        [string]$SystemPrompt = "",
        [int]$MaxTokens = 256,
        [float]$Temperature = 0.1
    )

    $body = @{
        prompt = $Prompt
        model_id = $ModelId
        max_new_tokens = $MaxTokens
        temperature = $Temperature
        do_sample = $true
    }

    if ($SystemPrompt -ne "") {
        $body.system_prompt = $SystemPrompt
    }

    $json = $body | ConvertTo-Json -Depth 5

    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-RestMethod -Uri "http://localhost:8000/v1/generate" -Method Post -Body $json -ContentType "application/json" -TimeoutSec 120
        $sw.Stop()

        return @{
            success = $true
            content = $response.generated_text
            tokens = $response.total_tokens
            time_ms = $sw.ElapsedMilliseconds
        }
    }
    catch {
        return @{
            success = $false
            error = $_.Exception.Message
            content = ""
            tokens = 0
            time_ms = 0
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Model: $ModelId" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1.1: JSON Simple
Write-Host "Test 1.1: JSON Simple..." -ForegroundColor Yellow
$test1_1 = Test-Model -Prompt 'Output a JSON object with two keys: "name" (string) and "age" (number). Example: {"name": "John", "age": 30}. Output ONLY the JSON.'
$results.tests["1.1_json_simple"] = $test1_1.content
Write-Host "Response: $($test1_1.content.Substring(0, [Math]::Min(200, $test1_1.content.Length)))" -ForegroundColor Gray
$score1_1 = 0
if ($test1_1.content -match '^\s*\{.*"name".*"age".*\}\s*$') { $score1_1 = 10 }
elseif ($test1_1.content -match '\{.*"name".*"age".*\}') { $score1_1 = 7 }
elseif ($test1_1.content -match '\{.*\}') { $score1_1 = 3 }
$results.scores["1.1"] = $score1_1
Write-Host "Score: $score1_1/10" -ForegroundColor $(if ($score1_1 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 1.3: Tool Call Format
Write-Host "Test 1.3: Tool Call Format..." -ForegroundColor Yellow
$test1_3 = Test-Model -Prompt 'You must output ONLY a JSON object to call a tool. Format: {"tool": "tool_name", "args": {"key": "value"}}. Call the tool "list_files" with argument "path" set to "/home/user". Output ONLY the JSON, nothing else.'
$results.tests["1.3_tool_call"] = $test1_3.content
Write-Host "Response: $($test1_3.content.Substring(0, [Math]::Min(200, $test1_3.content.Length)))" -ForegroundColor Gray
$score1_3 = 0
if ($test1_3.content -match '"tool"\s*:\s*"list_files".*"args".*"path"') { $score1_3 = 10 }
elseif ($test1_3.content -match '"tool"\s*:\s*"list_files"') { $score1_3 = 7 }
elseif ($test1_3.content -match '\{.*"tool".*\}') { $score1_3 = 3 }
$results.scores["1.3"] = $score1_3
Write-Host "Score: $score1_3/10" -ForegroundColor $(if ($score1_3 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 2.1: Simple Instructions
Write-Host "Test 2.1: Simple Instructions..." -ForegroundColor Yellow
$test2_1 = Test-Model -Prompt 'Count from 1 to 5, each number on a new line. Nothing else.'
$results.tests["2.1_instructions"] = $test2_1.content
Write-Host "Response: $($test2_1.content.Substring(0, [Math]::Min(100, $test2_1.content.Length)))" -ForegroundColor Gray
$score2_1 = 0
if ($test2_1.content -match "1.*2.*3.*4.*5") { $score2_1 = 10 }
elseif ($test2_1.content -match "1.*2.*3") { $score2_1 = 5 }
$results.scores["2.1"] = $score2_1
Write-Host "Score: $score2_1/10" -ForegroundColor $(if ($score2_1 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 2.4: Information Extraction
Write-Host "Test 2.4: Information Extraction..." -ForegroundColor Yellow
$test2_4 = Test-Model -Prompt 'Extract the email from this text and output ONLY the email, nothing else: "Contact John at john.doe@example.com for more information."'
$results.tests["2.4_extraction"] = $test2_4.content
Write-Host "Response: $($test2_4.content.Substring(0, [Math]::Min(100, $test2_4.content.Length)))" -ForegroundColor Gray
$score2_4 = 0
if ($test2_4.content.Trim() -eq "john.doe@example.com") { $score2_4 = 10 }
elseif ($test2_4.content -match "john\.doe@example\.com") { $score2_4 = 7 }
$results.scores["2.4"] = $score2_4
Write-Host "Score: $score2_4/10" -ForegroundColor $(if ($score2_4 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 3.1: Context Reference
Write-Host "Test 3.1: Context Reference..." -ForegroundColor Yellow
$test3_1 = Test-Model -SystemPrompt "The user's name is Alice and she lives in Paris." -Prompt "What is my name and where do I live? Answer in one sentence."
$results.tests["3.1_context"] = $test3_1.content
Write-Host "Response: $($test3_1.content.Substring(0, [Math]::Min(100, $test3_1.content.Length)))" -ForegroundColor Gray
$score3_1 = 0
if ($test3_1.content -match "Alice" -and $test3_1.content -match "Paris") { $score3_1 = 10 }
elseif ($test3_1.content -match "Alice" -or $test3_1.content -match "Paris") { $score3_1 = 5 }
$results.scores["3.1"] = $score3_1
Write-Host "Score: $score3_1/10" -ForegroundColor $(if ($score3_1 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 3.2: Information in Prompt
Write-Host "Test 3.2: Information in Prompt..." -ForegroundColor Yellow
$test3_2 = Test-Model -Prompt 'The project is located at C:/Projects/MyApp. The main file is called "app.py". What is the full path to the main file? Output ONLY the path.'
$results.tests["3.2_prompt_info"] = $test3_2.content
Write-Host "Response: $($test3_2.content.Substring(0, [Math]::Min(100, $test3_2.content.Length)))" -ForegroundColor Gray
$score3_2 = 0
if ($test3_2.content -match "C:/Projects/MyApp/app\.py" -or $test3_2.content -match "C:\\Projects\\MyApp\\app\.py") { $score3_2 = 10 }
elseif ($test3_2.content -match "MyApp.*app\.py") { $score3_2 = 5 }
$results.scores["3.2"] = $score3_2
Write-Host "Score: $score3_2/10" -ForegroundColor $(if ($score3_2 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 4.1: Simple Logic
Write-Host "Test 4.1: Simple Logic..." -ForegroundColor Yellow
$test4_1 = Test-Model -Prompt 'If A > B and B > C, is A > C? Answer with just "Yes" or "No".'
$results.tests["4.1_logic"] = $test4_1.content
Write-Host "Response: $($test4_1.content.Substring(0, [Math]::Min(50, $test4_1.content.Length)))" -ForegroundColor Gray
$score4_1 = 0
if ($test4_1.content.Trim() -match "^Yes\.?$") { $score4_1 = 10 }
elseif ($test4_1.content -match "Yes") { $score4_1 = 7 }
$results.scores["4.1"] = $score4_1
Write-Host "Score: $score4_1/10" -ForegroundColor $(if ($score4_1 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 4.2: Simple Math
Write-Host "Test 4.2: Simple Math..." -ForegroundColor Yellow
$test4_2 = Test-Model -Prompt 'Calculate: 15 + 27 = ? Output only the number.'
$results.tests["4.2_math"] = $test4_2.content
Write-Host "Response: $($test4_2.content.Substring(0, [Math]::Min(50, $test4_2.content.Length)))" -ForegroundColor Gray
$score4_2 = 0
if ($test4_2.content.Trim() -match "^42\.?$") { $score4_2 = 10 }
elseif ($test4_2.content -match "42") { $score4_2 = 7 }
$results.scores["4.2"] = $score4_2
Write-Host "Score: $score4_2/10" -ForegroundColor $(if ($score4_2 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 5.1: Agent Flow (Tool Call)
Write-Host "Test 5.1: Agent Tool Call..." -ForegroundColor Yellow
$sysPrompt = @"
You are a task executor. Output ONLY JSON.
Available tools:
- list_files: {"tool":"list_files","args":{"path":"..."}}
- done: {"tool":"done","args":{"summary":"..."}}
Output ONLY the JSON object for the tool call.
"@
$test5_1 = Test-Model -SystemPrompt $sysPrompt -Prompt 'List the files in /project'
$results.tests["5.1_agent_flow"] = $test5_1.content
Write-Host "Response: $($test5_1.content.Substring(0, [Math]::Min(200, $test5_1.content.Length)))" -ForegroundColor Gray
$score5_1 = 0
if ($test5_1.content -match '"tool"\s*:\s*"list_files".*"path"\s*:\s*"/project"') { $score5_1 = 10 }
elseif ($test5_1.content -match '"tool"\s*:\s*"list_files"') { $score5_1 = 7 }
elseif ($test5_1.content -match 'list_files') { $score5_1 = 3 }
$results.scores["5.1"] = $score5_1
Write-Host "Score: $score5_1/10" -ForegroundColor $(if ($score5_1 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Test 6.2: Concise Response
Write-Host "Test 6.2: Concise Response..." -ForegroundColor Yellow
$test6_2 = Test-Model -Prompt 'What is 2+2? One word answer only.'
$results.tests["6.2_concise"] = $test6_2.content
Write-Host "Response: $($test6_2.content.Substring(0, [Math]::Min(50, $test6_2.content.Length)))" -ForegroundColor Gray
$score6_2 = 0
if ($test6_2.content.Trim() -match "^(4|Four|four)\.?$") { $score6_2 = 10 }
elseif ($test6_2.content -match "(^|\s)(4|Four|four)(\s|$|\.)") { $score6_2 = 5 }
$results.scores["6.2"] = $score6_2
Write-Host "Score: $score6_2/10" -ForegroundColor $(if ($score6_2 -ge 7) { "Green" } else { "Red" })
Write-Host ""

# Calculate total score
$totalScore = 0
foreach ($key in $results.scores.Keys) {
    $totalScore += $results.scores[$key]
}
$maxScore = $results.scores.Count * 10
$percentage = [math]::Round(($totalScore / $maxScore) * 100, 1)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUMMARY for $ModelId" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Score: $totalScore / $maxScore ($percentage%)" -ForegroundColor $(if ($percentage -ge 70) { "Green" } elseif ($percentage -ge 50) { "Yellow" } else { "Red" })
Write-Host ""

# Classification
$classification = ""
if ($percentage -ge 90) { $classification = "Excellent" }
elseif ($percentage -ge 70) { $classification = "Good" }
elseif ($percentage -ge 50) { $classification = "Medium" }
elseif ($percentage -ge 30) { $classification = "Weak" }
else { $classification = "Insufficient" }

Write-Host "Classification: $classification" -ForegroundColor $(if ($percentage -ge 70) { "Green" } elseif ($percentage -ge 50) { "Yellow" } else { "Red" })

$results.total_score = $totalScore
$results.max_score = $maxScore
$results.percentage = $percentage
$results.classification = $classification

# Output to file if specified
if ($OutputFile -ne "") {
    $results | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host ""
    Write-Host "Results saved to: $OutputFile" -ForegroundColor Green
}

return $results
