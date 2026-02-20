$file = 'C:\Meastro\test-repos\crud\.maestro\sessions\5719f8d1-8d11-4daf-b58f-a0fdccca18f3.json'
$json = Get-Content $file -Raw | ConvertFrom-Json

Write-Host "=== SESSION OVERVIEW ==="
Write-Host "ID: $($json.id)"
Write-Host "Name: $($json.name)"
Write-Host "Type: $($json.type)"
Write-Host "Status: $($json.status)"
Write-Host "Created: $($json.createdAt)"
Write-Host "Updated: $($json.updatedAt)"
Write-Host "Repo: $($json.repoPath)"
Write-Host "Template: $($json.template)"

Write-Host "`n=== ENTRY POINTS ==="
if ($json.entryPoints) {
    $json.entryPoints.PSObject.Properties | ForEach-Object {
        Write-Host "  $($_.Name) -> $($_.Value)"
    }
}

Write-Host "`n=== VARIABLES (keys) ==="
if ($json.variables) {
    $json.variables.PSObject.Properties | ForEach-Object {
        $val = $_.Value
        $preview = if ($val -is [string]) { 
            $val.Substring(0, [Math]::Min(100, $val.Length)) 
        } elseif ($val -is [array]) { 
            "Array[$($val.Count)]" 
        } else { 
            ($val | ConvertTo-Json -Compress -Depth 1).Substring(0, [Math]::Min(120, ($val | ConvertTo-Json -Compress -Depth 1).Length))
        }
        Write-Host "  $($_.Name): $preview"
    }
}

Write-Host "`n=== _PHASES ==="
if ($json.variables._phases) {
    $phases = $json.variables._phases
    if ($phases -is [array]) {
        foreach ($p in $phases) {
            Write-Host "  Phase: $($p.id) | Name: $($p.name) | Status: $($p.status)"
        }
    } else {
        Write-Host "  (not array): $($phases | ConvertTo-Json -Compress -Depth 2)"
    }
}

Write-Host "`n=== _EXECUTION TREE (summary) ==="
if ($json.variables._executionTree) {
    $tree = $json.variables._executionTree
    if ($tree -is [array]) {
        Write-Host "  Tree has $($tree.Count) root nodes"
        foreach ($node in $tree) {
            $childCount = if ($node.children) { $node.children.Count } else { 0 }
            Write-Host "  Node: $($node.name) | Status: $($node.status) | Children: $childCount"
            if ($node.children -and $node.children.Count -gt 0) {
                foreach ($child in $node.children) {
                    $subChildren = if ($child.children) { $child.children.Count } else { 0 }
                    Write-Host "    Child: $($child.name) | Status: $($child.status) | SubChildren: $subChildren"
                }
            }
        }
    } else {
        Write-Host "  (not array)"
    }
}

Write-Host "`n=== _EXECUTION LOG (last 10) ==="
if ($json.variables._executionLog) {
    $log = $json.variables._executionLog
    if ($log -is [array]) {
        Write-Host "  Log has $($log.Count) entries"
        $last10 = $log | Select-Object -Last 10
        foreach ($entry in $last10) {
            Write-Host "  [$($entry.time)] [$($entry.level)] $($entry.msg)"
        }
    }
}

Write-Host "`n=== _ARTIFACTS ==="
if ($json.variables._artifacts) {
    $artifacts = $json.variables._artifacts
    if ($artifacts -is [array]) {
        Write-Host "  Artifacts: $($artifacts.Count)"
        foreach ($a in $artifacts) {
            Write-Host "  - $($a.path) ($($a.type))"
        }
    }
}

Write-Host "`n=== _LLM ACTIVITY (last 5) ==="
if ($json.variables._llmActivity) {
    $activity = $json.variables._llmActivity
    if ($activity -is [array]) {
        Write-Host "  Activities: $($activity.Count)"
        $last5 = $activity | Select-Object -Last 5
        foreach ($a in $last5) {
            Write-Host "  [$($a.time)] dur=$($a.duration)ms prompt=$($a.promptPreview)"
        }
    }
}
