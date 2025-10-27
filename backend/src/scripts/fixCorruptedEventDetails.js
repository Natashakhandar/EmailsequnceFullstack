/**
 * Script to fix corrupted event details in the database
 * This will sanitize and re-save all event details that have JSON parse errors
 */

const prisma = require('../db/prismaClient');

// Sanitize text content for safe JSON storage
function sanitizeForJson(text) {
  if (!text) return '';
  
  // Convert to string if not already
  let sanitized = String(text);
  
  // Remove control characters (0x00-0x1F and 0x7F-0x9F) except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  // Limit length to prevent oversized JSON (5000 chars for body content)
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000) + '... [truncated]';
  }
  
  // Normalize line endings
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  return sanitized;
}

// Try to extract data from corrupted JSON
function extractDataFromCorruptedJson(corruptedJson) {
  const extracted = {};
  
  // Extract fields using regex
  const patterns = [
    { key: 'replySubject', pattern: /"replySubject":\s*"([^"]*)"/ },
    { key: 'subject', pattern: /"subject":\s*"([^"]*)"/ },
    { key: 'replyBody', pattern: /"replyBody":\s*"([^"]*)/ },
    { key: 'replyContent', pattern: /"replyContent":\s*"([^"]*)/ },
    { key: 'content', pattern: /"content":\s*"([^"]*)/ },
    { key: 'body', pattern: /"body":\s*"([^"]*)/ },
    { key: 'replyFrom', pattern: /"replyFrom":\s*"([^"]*)"/ },
    { key: 'repliedAt', pattern: /"repliedAt":\s*"([^"]*)"/ },
    { key: 'messageId', pattern: /"messageId":\s*"([^"]*)"/ },
    { key: 'inReplyTo', pattern: /"inReplyTo":\s*"([^"]*)"/ },
    { key: 'source', pattern: /"source":\s*"([^"]*)"/ },
    { key: 'attachments', pattern: /"attachments":\s*(\d+)/ }
  ];
  
  for (const { key, pattern } of patterns) {
    const match = corruptedJson.match(pattern);
    if (match && match[1]) {
      extracted[key] = match[1];
    }
  }
  
  return extracted;
}

async function fixCorruptedEventDetails() {
  console.log('🔧 Starting to fix corrupted event details...\n');
  
  try {
    // Get all events with details
    const events = await prisma.event.findMany({
      where: {
        details: {
          not: null
        }
      },
      select: {
        id: true,
        type: true,
        details: true
      }
    });
    
    console.log(`📊 Found ${events.length} events with details\n`);
    
    let fixedCount = 0;
    let alreadyValidCount = 0;
    let failedCount = 0;
    
    for (const event of events) {
      try {
        // Try to parse the JSON
        JSON.parse(event.details);
        alreadyValidCount++;
      } catch (error) {
        // JSON is corrupted, try to fix it
        console.log(`❌ Event ${event.id} (${event.type}) has corrupted JSON`);
        
        try {
          // Extract data from corrupted JSON
          const extracted = extractDataFromCorruptedJson(event.details);
          
          if (Object.keys(extracted).length === 0) {
            console.log(`   ⚠️  Could not extract any data, skipping...`);
            failedCount++;
            continue;
          }
          
          // Sanitize extracted data
          const sanitized = {};
          for (const [key, value] of Object.entries(extracted)) {
            if (key === 'attachments') {
              sanitized[key] = parseInt(value) || 0;
            } else {
              sanitized[key] = sanitizeForJson(value);
            }
          }
          
          // Create new valid JSON
          const newDetails = JSON.stringify(sanitized);
          
          // Update the event
          await prisma.event.update({
            where: { id: event.id },
            data: { details: newDetails }
          });
          
          console.log(`   ✅ Fixed! Extracted fields: ${Object.keys(sanitized).join(', ')}`);
          fixedCount++;
          
        } catch (fixError) {
          console.log(`   ❌ Failed to fix: ${fixError.message}`);
          failedCount++;
        }
      }
    }
    
    console.log('\n📈 Summary:');
    console.log(`   ✅ Already valid: ${alreadyValidCount}`);
    console.log(`   🔧 Fixed: ${fixedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   📊 Total: ${events.length}`);
    
  } catch (error) {
    console.error('❌ Error fixing corrupted event details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixCorruptedEventDetails()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
