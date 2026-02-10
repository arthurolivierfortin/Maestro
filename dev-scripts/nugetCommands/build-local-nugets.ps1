# Charger les variables d'environnement depuis .env (dans nuggetCommands)
. "${PSScriptRoot}\load-env.ps1"

# Resolve repository root (two levels up from this script folder)
$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot '..\..')

# Nettoyage du cache NuGet local
Write-Host "[ROOT] Nettoyage du cache NuGet local..."
& dotnet nuget locals all --clear

# Nettoyage du dossier local-nuget (à la racine)
$localNugetPath = if ($env:LOCAL_NUGET_PATH) { $env:LOCAL_NUGET_PATH } else { Join-Path $repoRoot 'local-nuget' }
Write-Host "[ROOT] Suppression de tous les packages .nupkg dans $localNugetPath..."
Remove-Item "${localNugetPath}\*.nupkg" -Force -ErrorAction SilentlyContinue

# Appel du buildPackage de AppCore.AzureImplementation (à la racine)
Write-Host "[ROOT] Appel de AppCore.AzureImplementation/buildPackage.ps1..."
$implScript = Join-Path $repoRoot 'AppCore.AzureImplementation\buildPackage.ps1'
if (Test-Path $implScript) {
	& $implScript
	Write-Host "[ROOT] Build complet terminé."
} else {
	Write-Host "[ROOT][ERROR] Script not found: $implScript" -ForegroundColor Red
	Write-Host "Please check that AppCore.AzureImplementation/buildPackage.ps1 exists and retry." -ForegroundColor Yellow
}

# Lancer le projet AppCore.AzureImplementation.Integration (à la racine)
Write-Host "[ROOT] Lancement de AppCore.AzureImplementation.Integration..."
$integrationProj = Join-Path $repoRoot 'AppCore.AzureImplementation.Integration\AppCore.AzureImplementation.Integration.csproj'
if (Test-Path $integrationProj) {
	& dotnet run --project $integrationProj
} else {
	Write-Host "[ROOT][ERROR] Integration project not found: $integrationProj" -ForegroundColor Red
}
