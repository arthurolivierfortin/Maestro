cd C:\Meastro

# Legacy - already deleted via git rm

# System agent placeholders -> _drafts
$systemAgents = @(
    "documenter-agent",
    "experiment-manager",
    "fitness-evaluator",
    "orchestrator-agent",
    "publisher-agent",
    "researcher-agent",
    "tester-agent",
    "trainer-agent"
)
foreach ($a in $systemAgents) {
    $src = "content/system/blocks/system/$a.agent.block.json"
    $dst = "content/system/blocks/_drafts/system/$a.agent.block.json"
    if (Test-Path $src) {
        git mv $src $dst
        Write-Host "Moved $a"
    } else {
        Write-Host "SKIP $a (not found)"
    }
}

# Research team workflow
git mv "content/system/blocks/system/research-team-workflow.workflow.block.json" "content/system/blocks/_drafts/system/research-team-workflow.workflow.block.json"

# Strategy blocks -> _drafts
$stratDir = "content/system/blocks/system/strategies"
$draftStratDir = "content/system/blocks/_drafts/system/strategies"
if (-not (Test-Path $draftStratDir)) { New-Item -ItemType Directory -Force -Path $draftStratDir | Out-Null }
git mv $stratDir/*.block.json $draftStratDir/

# System tools -> _drafts
$sysToolDir = "content/system/blocks/system/tools"
$draftSysToolDir = "content/system/blocks/_drafts/system/tools"
if (-not (Test-Path $draftSysToolDir)) { New-Item -ItemType Directory -Force -Path $draftSysToolDir | Out-Null }
git mv $sysToolDir/*.block.json $draftSysToolDir/

# System training -> _drafts
$trainDir = "content/system/blocks/system/training"
$draftTrainDir = "content/system/blocks/_drafts/system/training"
if (-not (Test-Path $draftTrainDir)) { New-Item -ItemType Directory -Force -Path $draftTrainDir | Out-Null }
git mv $trainDir/*.block.json $draftTrainDir/

# UI blocks -> _drafts
$uiDir = "content/system/blocks/system/ui"
$draftUiDir = "content/system/blocks/_drafts/system/ui"
if (-not (Test-Path $draftUiDir)) { New-Item -ItemType Directory -Force -Path $draftUiDir | Out-Null }
git mv $uiDir/*.block.json $draftUiDir/

# Placeholder agents -> _drafts
foreach ($a in @("context-analyzer", "interaction-handler")) {
    $src = "content/system/blocks/agents/$a"
    $dst = "content/system/blocks/_drafts/agents/$a"
    if (Test-Path $src) {
        if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force -Path $dst | Out-Null }
        git mv "$src/*" "$dst/"
        Write-Host "Moved agent $a"
    }
}

# Placeholder inference blocks -> _drafts
foreach ($i in @("code-generator", "commit-writer", "pr-writer", "test-generator")) {
    $src = "content/system/blocks/inference/$i"
    $dst = "content/system/blocks/_drafts/inference/$i"
    if (Test-Path $src) {
        if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force -Path $dst | Out-Null }
        git mv "$src/*" "$dst/"
        Write-Host "Moved inference $i"
    } elseif (Test-Path "content/system/blocks/inference/$i.inference.block.json") {
        git mv "content/system/blocks/inference/$i.inference.block.json" "content/system/blocks/_drafts/inference/"
        Write-Host "Moved inference file $i"
    }
}

# Sliding window context -> _drafts
if (Test-Path "content/system/blocks/context") {
    git mv "content/system/blocks/context" "content/system/blocks/_drafts/context-old"
    Write-Host "Moved context blocks"
}

# Placeholder tool blocks (ones without scripts, not used by any active workflow)
$placeholderTools = @(
    "code-analyzer",
    "code-extractor",
    "code-search",
    "context-builder",
    "convention-reader",
    "dependency-manager",
    "directory-list",
    "file-scaffolder",
    "git-describe-commit",
    "llm-generate",
    "manifest-generator",
    "model-detector",
    "npm-run",
    "project-structure",
    "test-runner",
    "typescript-check",
    "workflow-state-manager"
)
foreach ($t in $placeholderTools) {
    # Check if it's a directory
    $dirPath = "content/system/blocks/tools/$t"
    $filePath = "content/system/blocks/tools/$t.tool.block.json"
    $dstDir = "content/system/blocks/_drafts/tools"

    if (Test-Path $dirPath -PathType Container) {
        $dstSub = "content/system/blocks/_drafts/tools/$t"
        if (-not (Test-Path $dstSub)) { New-Item -ItemType Directory -Force -Path $dstSub | Out-Null }
        git mv "$dirPath/*" "$dstSub/"
        Write-Host "Moved tool dir $t"
    } elseif (Test-Path $filePath) {
        git mv $filePath "$dstDir/"
        Write-Host "Moved tool file $t"
    } else {
        Write-Host "SKIP tool $t (not found)"
    }
}

# Placeholder workflows -> _drafts
$draftWfDir = "content/system/blocks/_drafts/workflows"
if (-not (Test-Path $draftWfDir)) { New-Item -ItemType Directory -Force -Path $draftWfDir | Out-Null }

# Documentation workflows
$docDir = "content/system/blocks/workflows/documentation"
if (Test-Path $docDir) {
    $dstDoc = "content/system/blocks/_drafts/workflows/documentation"
    if (-not (Test-Path $dstDoc)) { New-Item -ItemType Directory -Force -Path $dstDoc | Out-Null }
    git mv "$docDir/*" "$dstDoc/"
    Write-Host "Moved documentation workflows"
}

# Foundry workflows
$foundryDir = "content/system/blocks/workflows/foundry"
if (Test-Path $foundryDir) {
    $dstFoundry = "content/system/blocks/_drafts/workflows/foundry"
    if (-not (Test-Path $dstFoundry)) { New-Item -ItemType Directory -Force -Path $dstFoundry | Out-Null }
    git mv "$foundryDir/*" "$dstFoundry/"
    Write-Host "Moved foundry workflows"
}

Write-Host "`nDone!"
