cd C:\Meastro\packages\maestro-cli

$data = '[{"id":"step-1","action":"create","target":"src/utils/helpers.ts","description":"Create helpers"}]'
$schema = '{"type":"array","minItems":1,"items":{"requiredFields":["id","action","target","description"]}}'

node index.js run json-validator --input "data=$data" --input "schema=$schema"
