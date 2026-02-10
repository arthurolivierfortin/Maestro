$sessionId = $args[0]
$act = (Invoke-RestMethod -Uri "http://localhost:5000/api/sessions/$sessionId/variables/_llmActivity").value
$last = $act[-1]
Write-Host "Model: $($last.model)"
Write-Host "Response:"
Write-Host $last.fullResponse
