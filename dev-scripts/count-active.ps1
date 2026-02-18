cd C:\Meastro
$files = Get-ChildItem "content/system/blocks" -Recurse -Filter "*.block.json" | Where-Object { $_.FullName -notlike "*_drafts*" }
Write-Host "Active blocks: $($files.Count)"
foreach ($f in $files) {
    Write-Host "  $($f.FullName.Replace('C:\Meastro\',''))"
}
