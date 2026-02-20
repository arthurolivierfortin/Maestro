$ErrorActionPreference = "Continue"
$cli = "C:\Meastro\packages\maestro-cli"
$results = @()

function Test-Block {
    param([string]$BlockId, [string]$Args, [string]$ExpectContains)

    Write-Host "`n--- Testing: $BlockId ---" -ForegroundColor Cyan
    $fullCmd = "cd $cli; node index.js run $BlockId $Args 2>&1"
    try {
        $output = Invoke-Expression $fullCmd
        $outputStr = $output -join "`n"

        if ($outputStr -match "error|Error|FAIL|failed" -and $outputStr -notmatch "errorHandling|Error Output|error_log|handleError") {
            Write-Host "  WARN: Output contains error-like text" -ForegroundColor Yellow
            Write-Host "  Output (first 300 chars): $($outputStr.Substring(0, [Math]::Min(300, $outputStr.Length)))"
            $script:results += [PSCustomObject]@{Block=$BlockId; Status="WARN"; Note=$outputStr.Substring(0, [Math]::Min(200, $outputStr.Length))}
        } else {
            Write-Host "  OK" -ForegroundColor Green
            Write-Host "  Output (first 300 chars): $($outputStr.Substring(0, [Math]::Min(300, $outputStr.Length)))"
            $script:results += [PSCustomObject]@{Block=$BlockId; Status="PASS"; Note="Executed successfully"}
        }
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:results += [PSCustomObject]@{Block=$BlockId; Status="FAIL"; Note=$_.Exception.Message}
    }
}

Write-Host "=== Testing Tool Blocks Runtime ===" -ForegroundColor Green
Write-Host "Services: Backend=localhost:5000, LLM-Provider=localhost:5010"

# 1. state-manager (set operation)
Test-Block "state-manager" "--input operation=get --input path=test --input sessionId=test-dummy" "output"

# 2. memory-read
Test-Block "memory-read" "--input file=test.md --input workingDir=C:\Meastro" "output"

# 3. memory-write
Test-Block "memory-write" "--input file=test-runtime-check.md --input content=runtime-test-ok --input mode=overwrite --input workingDir=C:\Meastro" "output"

# 4. compilation-check
Test-Block "compilation-check" "--input projectPath=C:\Meastro\packages\tui --input command=npx_tsc_--noEmit" "output"

Write-Host "`n`n=== RESULTS ===" -ForegroundColor Green
$results | Format-Table -AutoSize

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$warnCount = ($results | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
Write-Host "`nTotal: $($results.Count) | PASS: $passCount | WARN: $warnCount | FAIL: $failCount"
