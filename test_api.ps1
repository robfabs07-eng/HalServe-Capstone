$body = @{
  messages = @(
    @{ role = 'user'; content = 'do you have pizza?' }
  )
} | ConvertTo-Json

$res = Invoke-RestMethod -Uri 'https://halden-s-catering-service.vercel.app/api/chat' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 45
Write-Output ($res | ConvertTo-Json -Depth 3)
