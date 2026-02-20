$connections = netstat -ano | Select-String ':5000.*ESTABLISHED'
$procIds = $connections | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
foreach ($procId in $procIds) {
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Output "$procId $($proc.ProcessName)"
    }
}
