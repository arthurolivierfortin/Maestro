$body = @{
    inputs = @{
        data = '[{"id":"step-1","action":"create","target":"src/utils/helpers.ts","description":"Create helpers"}]'
        schema = '{"type":"array","minItems":1,"items":{"requiredFields":["id","action","target","description"]}}'
    }
} | ConvertTo-Json -Depth 5

Write-Host "Sending request to backend..."
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/blocks/json-validator/execute" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
Write-Host "Status: $($response.StatusCode)"
Write-Host $response.Content
