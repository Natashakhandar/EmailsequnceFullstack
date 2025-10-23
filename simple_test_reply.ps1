# Simple PowerShell script to create a test reply event

Write-Host "Getting events..." -ForegroundColor Yellow

try {
    $events = Invoke-RestMethod -Uri 'http://localhost:3001/api/events?limit=10' -Method GET
    
    $sentEvent = $events.events | Where-Object { $_.type -eq 'SENT' -and $_.emailId } | Select-Object -First 1
    
    if (-not $sentEvent) {
        Write-Host "No SENT events found. Please send emails first." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Found SENT event: $($sentEvent.emailId)" -ForegroundColor Green
    
    $replyData = @{
        emailId = $sentEvent.emailId
        replySubject = "Re: Your Email - I am Interested!"
        replyBody = "Hi there! Thank you for reaching out. I am very interested in learning more about your services. Could we schedule a call this week? Best regards, John Smith"
        replyFrom = "john.smith@example.com"
    }
    
    $jsonBody = $replyData | ConvertTo-Json
    
    Write-Host "Creating test reply..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri 'http://localhost:3001/api/track/reply' -Method POST -Body $jsonBody -ContentType 'application/json'
    
    Write-Host "SUCCESS! Test reply created!" -ForegroundColor Green
    Write-Host "Now refresh your Email Activity page to see the REPLIED event!" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
