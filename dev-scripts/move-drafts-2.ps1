cd C:\Meastro

function Move-BlockFiles($srcDir, $dstDir) {
    if (-not (Test-Path $srcDir)) { Write-Host "SKIP dir $srcDir (not found)"; return }
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
    $files = Get-ChildItem $srcDir -Filter "*.block.json" -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $relSrc = $f.FullName.Replace("C:\Meastro\", "").Replace("\", "/")
        $relDst = "$dstDir/" + $f.Name
        $relDst = $relDst.Replace("\", "/")
        git mv $relSrc $relDst
        Write-Host "  git mv $relSrc -> $relDst"
    }
}

function Move-BlockDir($srcDir, $dstDir) {
    if (-not (Test-Path $srcDir)) { Write-Host "SKIP dir $srcDir (not found)"; return }
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
    $files = Get-ChildItem $srcDir -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $relSrc = $f.FullName.Replace("C:\Meastro\", "").Replace("\", "/")
        $relDst = "$dstDir/" + $f.Name
        $relDst = $relDst.Replace("\", "/")
        git mv $relSrc $relDst
        Write-Host "  git mv $relSrc -> $relDst"
    }
}

Write-Host "=== Strategy blocks ==="
Move-BlockFiles "content/system/blocks/system/strategies" "content/system/blocks/_drafts/system/strategies"

Write-Host "=== System tools ==="
Move-BlockFiles "content/system/blocks/system/tools" "content/system/blocks/_drafts/system/tools"

Write-Host "=== Training blocks ==="
Move-BlockFiles "content/system/blocks/system/training" "content/system/blocks/_drafts/system/training"

Write-Host "=== UI blocks ==="
Move-BlockFiles "content/system/blocks/system/ui" "content/system/blocks/_drafts/system/ui"

Write-Host "=== Documentation workflows ==="
Move-BlockFiles "content/system/blocks/workflows/documentation" "content/system/blocks/_drafts/workflows/documentation"

Write-Host "=== Foundry workflows ==="
Move-BlockFiles "content/system/blocks/workflows/foundry" "content/system/blocks/_drafts/workflows/foundry"

Write-Host "=== Placeholder agents (context-analyzer, interaction-handler) ==="
foreach ($name in @("context-analyzer", "interaction-handler")) {
    Move-BlockDir "content/system/blocks/agents/$name" "content/system/blocks/_drafts/agents/$name"
}

Write-Host "=== Placeholder inference blocks ==="
foreach ($name in @("code-generator", "commit-writer", "pr-writer", "test-generator")) {
    $dirPath = "content/system/blocks/inference/$name"
    if (Test-Path $dirPath -PathType Container) {
        Move-BlockDir $dirPath "content/system/blocks/_drafts/inference/$name"
    }
}

Write-Host "=== Placeholder tools (directories) ==="
foreach ($name in @("code-analyzer", "context-builder", "convention-reader", "dependency-manager", "file-scaffolder", "manifest-generator", "workflow-state-manager")) {
    $dirPath = "content/system/blocks/tools/$name"
    if (Test-Path $dirPath -PathType Container) {
        Move-BlockDir $dirPath "content/system/blocks/_drafts/tools/$name"
    }
}

Write-Host "=== Placeholder tools (single files) ==="
foreach ($name in @("code-extractor", "code-search", "directory-list", "git-describe-commit", "llm-generate", "model-detector", "npm-run", "project-structure", "test-runner", "typescript-check")) {
    $filePath = "content/system/blocks/tools/$name.tool.block.json"
    if (Test-Path $filePath) {
        $relSrc = $filePath.Replace("\", "/")
        git mv $relSrc "content/system/blocks/_drafts/tools/$name.tool.block.json"
        Write-Host "  git mv $name"
    }
}

Write-Host "=== Context block ==="
$ctxFile = "content/system/blocks/context/sliding-window-context.context.block.json"
if (Test-Path $ctxFile) {
    git mv $ctxFile "content/system/blocks/_drafts/context/"
    Write-Host "  Moved sliding-window-context"
}

Write-Host "`nDone!"
