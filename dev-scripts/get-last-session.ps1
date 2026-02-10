$r = Invoke-RestMethod -Uri 'http://localhost:5000/api/sessions'
$arr = @($r.value)
$last = $arr[$arr.Count - 1]
$last.id
