param(
    [Parameter(Mandatory=$true)]
    [string]$ModelId,

    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [string]$SystemPrompt = "",

    [int]$MaxTokens = 256,

    [float]$Temperature = 0.1
)

$body = @{
    model = $ModelId
    messages = @(
        @{ role = "user"; content = $Prompt }
    )
    max_tokens = $MaxTokens
    temperature = $Temperature
}

if ($SystemPrompt -ne "") {
    $body.messages = @(
        @{ role = "system"; content = $SystemPrompt },
        @{ role = "user"; content = $Prompt }
    )
}

$json = $body | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/v1/chat/completions" -Method Post -Body $json -ContentType "application/json" -TimeoutSec 120

    $content = $response.choices[0].message.content
    $usage = $response.usage

    Write-Host "=== RESPONSE ===" -ForegroundColor Green
    Write-Host $content
    Write-Host ""
    Write-Host "=== METRICS ===" -ForegroundColor Cyan
    Write-Host "Tokens: prompt=$($usage.prompt_tokens), completion=$($usage.completion_tokens), total=$($usage.total_tokens)"
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
