cd C:\Meastro\packages\maestro-cli

$step = '{"id":"step-1","action":"create","target":"src/utils/helpers.ts","description":"Create helpers"}'
$implResult = '{"stepId":"step-1","action":"create","target":"src/utils/helpers.ts","success":true,"filesModified":["src/utils/helpers.ts"],"notes":"Created"}'
$workingDir = 'C:\Meastro\test-repos\crud-claude'

node index.js run step-validator --input "step=$step" --input "implementationResult=$implResult" --input "workingDir=$workingDir"
