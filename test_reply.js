// Test script to create a reply event with content
// Run this after you have some sent emails in your system

const axios = require('axios');

async function createTestReply() {
  try {
    // First, let's get some events to find a SENT email
    const eventsResponse = await axios.get('http://localhost:3001/api/events?type=SENT&limit=1');
    
    if (eventsResponse.data.events.length === 0) {
      console.log('❌ No SENT emails found. Please send some emails first through your sequences.');
      return;
    }

    const sentEvent = eventsResponse.data.events[0];
    const emailId = sentEvent.emailId;

    if (!emailId) {
      console.log('❌ No emailId found in the sent event.');
      return;
    }

    console.log(`📧 Found sent email with ID: ${emailId}`);

    // Create a test reply with content
    const replyResponse = await axios.post('http://localhost:3001/api/track/reply', {
      emailId: emailId,
      replySubject: 'Re: Your Email - I\'m Interested!',
      replyBody: `Hi there!

Thank you for reaching out to me. I'm very interested in learning more about your services.

Could we schedule a call this week to discuss further? I'm available:
- Tuesday 2-4 PM
- Wednesday 10 AM - 12 PM  
- Friday 1-3 PM

Looking forward to hearing from you!

Best regards,
John Smith
john.smith@example.com
(555) 123-4567`,
      replyFrom: 'john.smith@example.com'
    });

    console.log('✅ Test reply created successfully!');
    console.log('📋 Reply details:', replyResponse.data);
    console.log('\n🎯 Now go to your Email Activity page and:');
    console.log('1. Look for the REPLIED event (green badge with 💬 icon)');
    console.log('2. Click the eye icon to view the reply content');

  } catch (error) {
    console.error('❌ Error creating test reply:', error.response?.data || error.message);
  }
}

createTestReply();
