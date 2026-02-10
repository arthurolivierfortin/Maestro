# Create projects for the two test repos
$headers = @{ "Content-Type" = "application/json" }

# Project 1: Gen-Commit Foundry
$body1 = @{
    rootPath = "C:\Meastro\test-repos\gen-commit-foundry"
    name = "Gen-Commit Foundry"
} | ConvertTo-Json

Write-Host "Creating project: Gen-Commit Foundry..." -ForegroundColor Yellow
try {
    $p1 = Invoke-RestMethod -Uri "http://localhost:5000/api/projects/bind" -Method Post -ContentType "application/json" -Body $body1 -TimeoutSec 10
    Write-Host "  ID: $($p1.id)" -ForegroundColor Green
    Write-Host "  Path: $($p1.rootPath)" -ForegroundColor Green
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

# Project 2: LLM Compliance Testing
$body2 = @{
    rootPath = "C:\Meastro\test-repos\llm-compliance-testing"
    name = "LLM Compliance Testing"
} | ConvertTo-Json

Write-Host "Creating project: LLM Compliance Testing..." -ForegroundColor Yellow
try {
    $p2 = Invoke-RestMethod -Uri "http://localhost:5000/api/projects/bind" -Method Post -ContentType "application/json" -Body $body2 -TimeoutSec 10
    Write-Host "  ID: $($p2.id)" -ForegroundColor Green
    Write-Host "  Path: $($p2.rootPath)" -ForegroundColor Green
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

# List all projects
Write-Host "`nAll projects:" -ForegroundColor Cyan
$projects = Invoke-RestMethod -Uri "http://localhost:5000/api/projects" -TimeoutSec 5
foreach ($p in $projects) {
    Write-Host "  $($p.id) - $($p.name) ($($p.rootPath))" -ForegroundColor White
}
