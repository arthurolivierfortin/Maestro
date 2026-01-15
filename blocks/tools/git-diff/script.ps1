try {
    git diff --staged --no-color
} catch {
    Write-Output ""
}
