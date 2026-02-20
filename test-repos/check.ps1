foreach ($r in @('crud','auth','dashboard','explorer','notifications')) {
    $count = (Get-ChildItem -Path "C:\Meastro\test-repos\$r" -Recurse -File).Count
    Write-Output "$r : $count files"
}
