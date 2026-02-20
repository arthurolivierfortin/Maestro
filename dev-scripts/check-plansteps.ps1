param([string]$SessionId)
$base = "http://localhost:5000/api/sessions/$SessionId/variables"
$data = Invoke-RestMethod -Uri "$base/_planSteps" -TimeoutSec 5
$val = $data.value
Write-Host "Type: $($val.GetType().Name)"
Write-Host "Length: $($val.Length)"
if ($val -is [string]) {
    Write-Host "First 300 chars:"
    Write-Host $val.Substring(0, [Math]::Min(300, $val.Length))
    Write-Host ""
    Write-Host "Contains '[': $($val.Contains('['))"
    $idx = $val.IndexOf('[')
    if ($idx -ge 0) {
        Write-Host "First '[' at index: $idx"
        Write-Host "After bracket: $($val.Substring($idx, [Math]::Min(200, $val.Length - $idx)))"
    }
} else {
    Write-Host ($val | ConvertTo-Json -Depth 3 -Compress)
}
