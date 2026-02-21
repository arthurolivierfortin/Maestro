$dll = Get-ChildItem 'C:\Meastro\apps\backend\src\Maestro.Api\bin\' -Recurse -Filter 'Maestro.Infrastructure.dll' | Select-Object -First 1
Write-Host "DLL: $($dll.FullName)"
Write-Host "Modified: $($dll.LastWriteTime)"

$bytes = [System.IO.File]::ReadAllBytes($dll.FullName)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

$checks = @(
    @("plain text", "NEW (plain text msg)"),
    @("parsed JSON", "OLD (parsed JSON msg)"),
    @("token type", "NEW (token type msg)"),
    @("JValue string", "NEW (JValue string)"),
    @("item list", "EITHER (item list)")
)

foreach ($check in $checks) {
    $found = $content.Contains($check[0])
    $status = if ($found) { "FOUND" } else { "NOT FOUND" }
    Write-Host "$status : $($check[1])"
}
