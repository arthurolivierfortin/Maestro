cd C:\Meastro\packages\maestro-cli

$step = '{"id":1,"action":"create","target":"src/utils/formatDate.ts","description":"Create a formatDate(date: Date): string function that returns YYYY-MM-DD format"}'
$context = '{"stack":"React 18 + TypeScript + Vite","srcDir":"src/","conventions":{"naming":"camelCase","modules":"ES modules"}}'
$workingDir = 'C:\Meastro\test-repos\crud-claude'

node index.js run implement-single-step --input "step=$step" --input "context=$context" --input "workingDir=$workingDir"
