# Script de démarrage pour exécuter les commandes NuGet depuis la racine
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "publish", "list", "build-run")]
    [string]$Command
)

switch ($Command) {
    "build" {
        Write-Host "Exécution du build des packages locaux..." -ForegroundColor Yellow
        & "$PSScriptRoot\nugetCommands\build-local-nugets.ps1"
    }
    "publish" {
        Write-Host "Publication de tous les packages..." -ForegroundColor Yellow
        & "$PSScriptRoot\nugetCommands\publish-all.ps1"
    }
    "list" {
        Write-Host "Liste des packages NuGet..." -ForegroundColor Yellow
        & "$PSScriptRoot\nugetCommands\list-nuget-packages.ps1"
    }
    "build-run" {
        Write-Host "Build et exécution du projet principal..." -ForegroundColor Yellow
        & "$PSScriptRoot\nugetCommands\build-and-run.ps1"
    }
}
