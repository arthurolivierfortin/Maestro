# Script PowerShell pour builder tous les projets modifiés et lancer le projet web principal

# Resolve repository root (two levels up from this script folder)
$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot '..\..')

# Nettoyage des dossiers bin/ et obj/ pour chaque projet (depuis la racine)
Get-ChildItem -Path $repoRoot -Recurse -Include bin,obj -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Build de la solution complète (tous les projets)
dotnet build (Join-Path $repoRoot 'AzureAppCore.sln')

# Lancement du projet web principal
$webProj = Join-Path $repoRoot 'AppCore.AzureImplementation\AppCore.AzureImplementation.csproj'
if (Test-Path $webProj) {
	dotnet run --project $webProj
} else {
	Write-Host "[ROOT][ERROR] Web project not found: $webProj" -ForegroundColor Red
}
