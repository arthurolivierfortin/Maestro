param([string]$SessionId)
$url = "http://localhost:5000/api/sessions/$SessionId/variables/_executionLog"
try {
    $json = Invoke-WebRequest -Uri $url -Method Get -ErrorAction Stop | Select-Object -ExpandProperty Content
    $data = $json | ConvertFrom-Json -Depth 10
    $logs = $data.value
    if ($logs) {
        foreach ($log in $logs) {
            $time = if ($log.time) { $log.time } else { "" }
            $level = $log.level
            $msg = $log.msg
            if ($msg.Length -gt 120) { $msg = $msg.Substring(0, 120) + "..." }
            Write-Host "$time [$level] $msg"
        }
        Write-Host "`nTotal: $($logs.Count) log entries"
    } else {
        Write-Host "No logs found. Raw: $($json.Substring(0, [Math]::Min(200, $json.Length)))"
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
