cd C:\Meastro\packages\maestro-cli
node index.js session create --type project --name "CRUD-Maestro-v4" --repo "C:\Meastro\test-repos\crud" --template project-v4 --start 2>&1
Write-Host "Exit code: $LASTEXITCODE"
