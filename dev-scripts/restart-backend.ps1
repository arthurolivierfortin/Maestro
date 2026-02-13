Set-Location 'C:\Meastro\backend\src\Maestro.Api'
$env:MAESTRO_GLOBAL_BLOCKS_PATH = 'C:\Meastro\content\system\blocks'
$env:MAESTRO_REPO_ROOT = 'C:\Meastro'
$env:LLMProvider__BaseUrl = 'http://localhost:8000'
Write-Host 'Maestro Backend starting on port 5000' -ForegroundColor Cyan
dotnet run --urls=http://localhost:5000
