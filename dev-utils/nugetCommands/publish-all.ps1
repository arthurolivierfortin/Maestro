# Charger les variables d'environnement depuis .env (dans nugetCommands)
. "$PSScriptRoot\load-env.ps1"

# Publier tous les packages dans l'ordre correct
# 1. AppCore.*
# 2. AzureClients.* (sauf PostgreSQL et Translator)
# 3. AzureClients.PostgreSQL
# 4. AzureClients.Translator
# 5. AzureAppCore

$nugetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "githubPackages-Kersia" }
$apiKey = $env:GITHUB_NUGET_TOKEN

if (-not $apiKey) {
     Write-Error "La variable d'environnement GITHUB_NUGET_TOKEN n'est pas définie."
     exit 1
}

# Resolve repository root (two levels up from this script folder)
$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot '..\..')
$localNuget = Join-Path $repoRoot 'local-nuget'

# 1. Publier tous les AppCore.* (depuis la racine)
Get-ChildItem (Join-Path $localNuget 'AppCore.*.nupkg') | ForEach-Object {
    Write-Host "Publishing $($_.Name)"
    dotnet nuget push $_.FullName --source $nugetSource --api-key $apiKey --skip-duplicate
}

# 2. Publier tous les AzureClients.* sauf PostgreSQL et Translator
Get-ChildItem (Join-Path $localNuget 'AzureClients.*.nupkg') | Where-Object {
    $_.Name -notmatch "PostgreSQL" -and $_.Name -notmatch "Translator"
} | ForEach-Object {
    Write-Host "Publishing $($_.Name)"
    dotnet nuget push $_.FullName --source $nugetSource --api-key $apiKey --skip-duplicate
}

# 3. Publier AzureClients.PostgreSQL
Get-ChildItem (Join-Path $localNuget 'AzureClients.PostgreSQL*.nupkg') | ForEach-Object {
    Write-Host "Publishing $($_.Name)"
    dotnet nuget push $_.FullName --source $nugetSource --api-key $apiKey --skip-duplicate
}

# 4. Publier AzureClients.Translator
Get-ChildItem (Join-Path $localNuget 'AzureClients.Translator*.nupkg') | ForEach-Object {
    Write-Host "Publishing $($_.Name)"
    dotnet nuget push $_.FullName --source $nugetSource --api-key $apiKey --skip-duplicate
}

# 5. Publier AzureAppCore
Get-ChildItem (Join-Path $localNuget 'AzureAppCore*.nupkg') | ForEach-Object {
    Write-Host "Publishing $($_.Name)"
    dotnet nuget push $_.FullName --source $nugetSource --api-key $apiKey --skip-duplicate
}
