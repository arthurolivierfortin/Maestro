Set-Location 'C:\Meastro\maestro-cli'
$raw = node index.js execute convention-reader --input workingDir=C:\Meastro --json 2>&1 | Out-String
# Extract JSON portion (starts at first '{')
$jsonStart = $raw.IndexOf('{')
if ($jsonStart -lt 0) { Write-Host "No JSON found in output"; Write-Host $raw; exit 1 }
$jsonStr = $raw.Substring($jsonStart)
$j = $jsonStr | ConvertFrom-Json
Write-Host "Output keys:" ($j.outputs.PSObject.Properties.Name -join ', ')
Write-Host ""
Write-Host "Files found:" ($j.outputs.files -join ', ')
Write-Host ""
Write-Host "Summary:" $j.outputs.summary
Write-Host ""
Write-Host "ProjectPath:" $j.outputs.projectPath
Write-Host ""
Write-Host "Convention sections:" ($j.outputs.conventions.PSObject.Properties.Name -join ', ')
