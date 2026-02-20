cd C:\Meastro\packages\maestro-cli

$task = 'Create a formatDate(date: Date): string function that returns YYYY-MM-DD format'
$workingDir = 'C:\Meastro\test-repos\crud-claude'

node index.js run dev-orchestrator --input "task=$task" --input "workingDir=$workingDir"
