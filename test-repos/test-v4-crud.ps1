cd C:\Meastro\packages\maestro-cli

# Create session
Write-Host "=== Creating session ==="
$output = node index.js session create --type project --name "CRUD-v4-final" --repo "C:\Meastro\test-repos\crud" --template project-v4 --start 2>&1
$output | ForEach-Object { Write-Host $_ }

# Extract session ID from output
$match = $output | Select-String -Pattern 'ID:\s+([a-f0-9-]+)'
if ($match) {
    $sessionId = $match.Matches[0].Groups[1].Value
    Write-Host "`n=== Session ID: $sessionId ==="

    # Invoke dev entry point
    Write-Host "`n=== Invoking dev entry point ==="
    $task = "Add a user management module: REST API with CRUD endpoints for users (name, email, avatar URL), React components (UserForm, UserList, UserCard), TypeScript types, error handling, loading states, Tailwind CSS styling."
    node index.js session invoke $sessionId dev --input "task=$task" "repoPath=C:\Meastro\test-repos\crud" 2>&1
    Write-Host "`nInvoke exit code: $LASTEXITCODE"
} else {
    Write-Host "ERROR: Could not extract session ID"
}
