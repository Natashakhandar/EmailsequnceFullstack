# Create a proper test reply with full content

Write-Host "Creating test reply with proper content..." -ForegroundColor Yellow

try {
    # Get a recent SENT event to reply to
    $events = Invoke-RestMethod -Uri 'http://localhost:3001/api/events?type=SENT&limit=1' -Method GET
    
    if ($events.events.Count -eq 0) {
        Write-Host "No SENT events found. Please send some emails first." -ForegroundColor Red
        exit 1
    }
    
    $sentEvent = $events.events[0]
    Write-Host "Found SENT event: $($sentEvent.emailId)" -ForegroundColor Green
    
    # Delete any existing reply for this email
    $existingReplies = Invoke-RestMethod -Uri "http://localhost:3001/api/events?type=REPLIED" -Method GET
    foreach ($reply in $existingReplies.events) {
        if ($reply.emailId -eq $sentEvent.emailId) {
            try {
                Invoke-RestMethod -Uri "http://localhost:3001/api/events/$($reply.id)" -Method DELETE
                Write-Host "Deleted existing reply: $($reply.id)" -ForegroundColor Yellow
            } catch {
                # Continue if delete fails
            }
        }
    }
    
    # Create a new reply with rich content
    $replyData = @{
        emailId = $sentEvent.emailId
        replySubject = "Re: Your Email - Very Interested!"
        replyBody = @"
Hi there!

Thank you so much for reaching out to me. I'm very interested in learning more about your services and how they can help my business.

I have a few questions:
1. What are your pricing options?
2. How long does implementation typically take?
3. Do you offer ongoing support?

I'm available for a call this week if you'd like to discuss further. My preferred times are:
- Tuesday 2:00 PM - 4:00 PM
- Wednesday 10:00 AM - 12:00 PM  
- Friday 1:00 PM - 3:00 PM

Looking forward to hearing from you soon!

Best regards,
John Smith
CEO, Smith Enterprises
john.smith@example.com
Phone: (555) 123-4567
"@
        replyFrom = "john.smith@example.com"
    }
    
    $jsonBody = $replyData | ConvertTo-Json -Depth 3
    
    Write-Host "Creating new reply with rich content..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri 'http://localhost:3001/api/track/reply' -Method POST -Body $jsonBody -ContentType 'application/json'
    
    Write-Host "SUCCESS! Created reply with full content!" -ForegroundColor Green
    Write-Host "Reply from: $($replyData.replyFrom)" -ForegroundColor Cyan
    Write-Host "Subject: $($replyData.replySubject)" -ForegroundColor Cyan
    Write-Host "Content length: $($replyData.replyBody.Length) characters" -ForegroundColor Cyan
    Write-Host "`nNow refresh your Email Activity page and click on the REPLIED event!" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
