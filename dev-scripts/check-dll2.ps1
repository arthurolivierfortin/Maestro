$dll = Get-ChildItem 'C:\Meastro\apps\backend\src\Maestro.Api\bin\' -Recurse -Filter 'Maestro.Infrastructure.dll' | Select-Object -First 1
Write-Host "DLL: $($dll.FullName)"
Write-Host "Modified: $($dll.LastWriteTime)"
Write-Host "Size: $($dll.Length) bytes"

$bytes = [System.IO.File]::ReadAllBytes($dll.FullName)

# Try both encodings
foreach ($encoding in @([System.Text.Encoding]::UTF8, [System.Text.Encoding]::Unicode)) {
    $content = $encoding.GetString($bytes)
    Write-Host "`n=== $($encoding.EncodingName) ==="

    $searches = @("plain text", "parsed JSON", "token type", "item list", "set-variable", "for-each")
    foreach ($s in $searches) {
        $found = $content.Contains($s)
        Write-Host "  $(if($found){'YES'}else{'NO '}) : '$s'"
    }
}
