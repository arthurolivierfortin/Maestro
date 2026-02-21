try {
    $r = Invoke-RestMethod -Uri http://localhost:5010/api/v1/health/ -TimeoutSec 5
    Write-Output "LLM: UP"
} catch {
    Write-Output ("LLM: DOWN - " + $_.Exception.Message)
}

try {
    $r = Invoke-WebRequest -Uri http://localhost:5000/api/health -TimeoutSec 5 -UseBasicParsing
    Write-Output ("BACKEND: UP - " + $r.StatusCode)
} catch {
    Write-Output ("BACKEND: DOWN - " + $_.Exception.Message)
}
