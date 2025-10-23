# PowerShell script to create a test reply event
# This will help you see the reply content feature in action

Write-Host "🔍 Getting events from your system..." -ForegroundColor Yellow

try {
    # Get events from your API
    $events = Invoke-RestMethod -Uri 'http://localhost:3001/api/events?limit=10' -Method GET
    
    # Find a SENT event with an emailId
    $sentEvent = $events.events | Where-Object { $_.type -eq 'SENT' -and $_.emailId } | Select-Object -First 1
    
    if (-not $sentEvent) {
        Write-Host "❌ No SENT events with emailId found. Please send some emails through your sequences first." -ForegroundColor Red
        Write-Host "💡 Go to your sequences page and enroll some contacts to generate SENT events." -ForegroundColor Cyan
        exit 1
    }
    
    Write-Host "✅ Found SENT event with emailId: $($sentEvent.emailId)" -ForegroundColor Green
    
    # Create test reply data
    $replyData = @{
        emailId = $sentEvent.emailId
        replySubject = "Re: Your Email - I am Interested!"
        replyBody = "Hi there!`n`nThank you for reaching out to me. I am very interested in learning more about your services.`n`nCould we schedule a call this week to discuss further? I am available:`n* Tuesday 2-4 PM`n* Wednesday 10 AM - 12 PM`n* Friday 1-3 PM`n`nLooking forward to hearing from you!`n`nBest regards,`nJohn Smith`njohn.smith@example.com`n(555) 123-4567"
        replyFrom = "john.smith@example.com"
    }
    
    # Convert to JSON
    $jsonBody = $replyData | ConvertTo-Json -Depth 3
    
    Write-Host "📧 Creating test reply..." -ForegroundColor Yellow
    
    # Create the reply event
    $response = Invoke-RestMethod -Uri 'http://localhost:3001/api/track/reply' -Method POST -Body $jsonBody -ContentType 'application/json'
    
    Write-Host "✅ Test reply created successfully!" -ForegroundColor Green
    Write-Host "📋 Response: $($response.message)" -ForegroundColor Cyan
    
    Write-Host "`n🎯 Now go to your Email Activity page and:" -ForegroundColor Yellow
    Write-Host "1. Look for the REPLIED event (green badge with 💬 icon)" -ForegroundColor White
    Write-Host "2. Click the eye icon (👁️) to view the reply content" -ForegroundColor White
    Write-Host "3. You should see both the original email and the client's reply!" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
