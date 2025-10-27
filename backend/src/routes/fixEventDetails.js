/**
 * API endpoint to fix corrupted event details
 */

const express = require('express');
const router = express.Router();
const prisma = require('../db/prismaClient');

// Sanitize text content for safe JSON storage
function sanitizeForJson(text) {
  if (!text) return '';
  
  let sanitized = String(text);
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000) + '... [truncated]';
  }
  
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return sanitized;
}

// Extract data from corrupted JSON
function extractDataFromCorruptedJson(corruptedJson) {
  const extracted = {};
  
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

// POST /api/fix-event-details - Fix all corrupted event details
router.post('/', async (req, res) => {
  try {
    console.log('🔧 Starting to fix corrupted event details...');
    
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
    
    console.log(`📊 Found ${events.length} events with details`);
    
    let fixedCount = 0;
    let alreadyValidCount = 0;
    let failedCount = 0;
    const fixedEvents = [];
    
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
          fixedEvents.push({
            id: event.id,
            type: event.type,
            extractedFields: Object.keys(sanitized)
          });
          
        } catch (fixError) {
          console.log(`   ❌ Failed to fix: ${fixError.message}`);
          failedCount++;
        }
      }
    }
    
    const summary = {
      total: events.length,
      alreadyValid: alreadyValidCount,
      fixed: fixedCount,
      failed: failedCount,
      fixedEvents
    };
    
    console.log('📈 Summary:', summary);
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} corrupted events`,
      summary
    });
    
  } catch (error) {
    console.error('❌ Error fixing corrupted event details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/fix-event-details/check - Check how many events need fixing
router.get('/check', async (req, res) => {
  try {
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
    
    let validCount = 0;
    let corruptedCount = 0;
    const corruptedEvents = [];
    
    for (const event of events) {
      try {
        JSON.parse(event.details);
        validCount++;
      } catch (error) {
        corruptedCount++;
        corruptedEvents.push({
          id: event.id,
          type: event.type,
          detailsLength: event.details.length
        });
      }
    }
    
    res.json({
      total: events.length,
      valid: validCount,
      corrupted: corruptedCount,
      corruptedEvents: corruptedEvents.slice(0, 10) // Show first 10
    });
    
  } catch (error) {
    console.error('❌ Error checking event details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
