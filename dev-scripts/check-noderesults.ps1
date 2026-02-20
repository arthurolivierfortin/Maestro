param([string]$SessionId)
$base = "http://localhost:5000/api/sessions/$SessionId/variables"

$vars = @("_nodeResult_analyze-project","_nodeResult_design-architecture","_nodeResult_create-plan","_nodeResult_validate-plan","_planSteps","planValid")
foreach ($v in $vars) {
    try {
        $data = Invoke-RestMethod -Uri "$base/$v" -TimeoutSec 5
        $val = if ($data.value -is [string]) {
            $len = $data.value.Length
            if ($len -gt 200) { $data.value.Substring(0,200) + "... ($len chars)" } else { $data.value }
        } else { $data.value | ConvertTo-Json -Depth 2 -Compress }
        Write-Host "$v = $val" -ForegroundColor Cyan
    } catch {
        Write-Host "$v = (not set)" -ForegroundColor DarkGray
    }
    Write-Host ""
}
