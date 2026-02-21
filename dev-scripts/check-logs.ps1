param([string]$SessionId)
$url = "http://localhost:5000/api/sessions/$SessionId/variables/_executionLog"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    if ($response -is [System.Collections.IEnumerable]) {
        foreach ($log in $response) {
            $time = if ($log.time) { $log.time.Substring([Math]::Max(0, $log.time.Length - 8)) } else { "" }
            $level = $log.level
            $msg = $log.msg
            Write-Host "$time [$level] $msg"
        }
    } else {
        Write-Host "Response is not a list: $response"
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
