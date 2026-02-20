cd C:\Meastro\packages\maestro-cli
$sessionId = '93816d32-568a-40e7-a7c2-0755099c7c1c'

# Launch monitor in a new window
Start-Process powershell -ArgumentList '-NoExit',"-Command","cd C:\Meastro\packages\maestro-cli; node index.js monitor $sessionId"

Start-Sleep -Seconds 3

# Invoke the dev entry point
$task = 'Add a user management module with: 1) A REST API server (Express) with CRUD endpoints for users (name, email, avatar). 2) A React frontend with UserForm (create/edit), UserList (display all), UserCard (individual user display) components. 3) Full TypeScript types. 4) Error handling and loading states. 5) Tailwind CSS styling.'

node index.js session invoke $sessionId dev --input "task=$task" "repoPath=C:\Meastro\test-repos\crud" 2>&1
Write-Host "Exit code: $LASTEXITCODE"
