# Liste tous les packages NuGet de l'organisation kersia via l'API GitHub
# Nécessite que la variable d'environnement GITHUB_NUGET_TOKEN soit définie

$headers = @{ Authorization = "Bearer $env:GITHUB_NUGET_TOKEN" }
$url = "https://api.github.com/orgs/kersia/packages?package_type=nuget"

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers
    if ($response) {
        Write-Host "Packages NuGet trouvés dans l'organisation kersia :"
        $response | ForEach-Object {
            Write-Host ("- " + $_.name + " (" + $_.package_type + ")")
        }
    } else {
        Write-Host "Aucun package trouvé ou réponse vide."
    }
} catch {
    Write-Error "Erreur lors de l'appel à l'API GitHub : $_"
}
