Get-ChildItem C:\Cantante -Recurse -Include *.json,*.ts,*.tsx,*.html,*.css |
    Where-Object { -not ($_.FullName -match 'node_modules') } |
    ForEach-Object {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $content = [System.IO.File]::ReadAllText($_.FullName)
            [System.IO.File]::WriteAllBytes($_.FullName, [System.Text.UTF8Encoding]::new($false).GetBytes($content))
            Write-Host "Fixed BOM: $($_.FullName)"
        }
    }
