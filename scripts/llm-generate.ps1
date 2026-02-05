param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [int]$MaxTokens = 500,

    [double]$Temperature = 0.1,

    [string]$Endpoint = "http://localhost:8000/v1/generate"
)

$ErrorActionPreference = "Stop"

# Build the full prompt with instruction format
$fullPrompt = "### Instruction:`n$Prompt`n### Response:`n"

# Create the request body
$body = @{
    prompt = $fullPrompt
    max_new_tokens = $MaxTokens
    temperature = $Temperature
} | ConvertTo-Json -Compress

try {
    $response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120

    # Output just the generated text
    Write-Output $response.generated_text
}
catch {
    Write-Error "LLM request failed: $_"
    exit 1
}
