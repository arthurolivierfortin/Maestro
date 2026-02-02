# Fonction pour charger les variables d'environnement depuis un fichier .env
function Load-EnvFile {
    param(
        [string]$EnvFilePath = ".\.env"
    )
    
    # Le fichier .env est à la racine du projet, pas dans nuggetCommands
    $rootPath = Split-Path $PSScriptRoot -Parent
    $EnvFilePath = Join-Path $rootPath ".env"
    
    if (-not (Test-Path $EnvFilePath)) {
        Write-Warning "Fichier .env non trouvé à l'emplacement: $EnvFilePath"
        return
    }
    
    Write-Host "Chargement des variables d'environnement depuis $EnvFilePath..." -ForegroundColor Green
    
    Get-Content $EnvFilePath | ForEach-Object {
        $line = $_.Trim()
        
        # Ignorer les lignes vides et les commentaires
        if ($line -and -not $line.StartsWith('#')) {
            $parts = $line -split '=', 2
            if ($parts.Count -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim()
                
                # Supprimer les guillemets si présents
                if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
                
                # Définir la variable d'environnement
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
                Write-Host "  $key = $value" -ForegroundColor Gray
            }
        }
    }
}

# Charger automatiquement le fichier .env s'il existe
Load-EnvFile
