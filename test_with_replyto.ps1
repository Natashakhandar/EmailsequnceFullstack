# Create a test SENT event with reply-to information, then add a reply

Write-Host "Creating test email with reply-to information..." -ForegroundColor Yellow

try {
    # First, let's get an enrollment to use
    $enrollments = Invoke-RestMethod -Uri 'http://localhost:3001/api/enrollments?limit=1' -Method GET
    
    if ($enrollments.enrollments.Count -eq 0) {
        Write-Host "No enrollments found. Please create some enrollments first." -ForegroundColor Red
        exit 1
    }
    
    $enrollment = $enrollments.enrollments[0]
    Write-Host "Using enrollment: $($enrollment.id)" -ForegroundColor Green
    
    # Create a test SENT event with reply-to information
    $emailId = "<test-$(Get-Random)@fulboost.fun>"
    
    $sentEventData = @{
        enrollmentId = $enrollment.id
        contactId = $enrollment.contactId
        type = "SENT"
        emailId = $emailId
        details = @{
            to = $enrollment.contact.email
            subject = "Test Email with Reply-To"
            messageId = $emailId
            response = "250 OK"
            replyTo = "support@yourcompany.com"
            sentFrom = "noreply@fulboost.fun"
        } | ConvertTo-Json
    }
    
    $sentJson = $sentEventData | ConvertTo-Json -Depth 3
    
    Write-Host "Creating SENT event..." -ForegroundColor Yellow
    $sentResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/events' -Method POST -Body $sentJson -ContentType 'application/json'
    
    Write-Host "SENT event created: $($sentResponse.id)" -ForegroundColor Green
    
    # Now create a reply to this email
    $replyData = @{
        emailId = $emailId
        replySubject = "Re: Test Email with Reply-To"
        replyBody = "Hi! I received your email and I'm interested in your services. Please contact me at your earliest convenience. Thanks!"
        replyFrom = $enrollment.contact.email
    }
    
    $replyJson = $replyData | ConvertTo-Json
    
    Write-Host "Creating REPLY event..." -ForegroundColor Yellow
    $replyResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/track/reply' -Method POST -Body $replyJson -ContentType 'application/json'
    
    Write-Host "SUCCESS! Test email with reply-to created!" -ForegroundColor Green
    Write-Host "Reply-To Email: support@yourcompany.com" -ForegroundColor Cyan
    Write-Host "Now refresh your Email Activity page to see both SENT and REPLIED events!" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
