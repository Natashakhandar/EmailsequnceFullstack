// Script to fix corrupted JSON in event details
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCorruptedEventDetails() {
  console.log('🔍 Checking for corrupted JSON in event details...');
  
  try {
    // Get all events with details
    const events = await prisma.event.findMany({
      where: {
        details: {
          not: null
        }
      }
    });

    console.log(`📊 Found ${events.length} events with details to check`);

    let corruptedCount = 0;
    let fixedCount = 0;

    for (const event of events) {
      try {
        // Try to parse the JSON
        JSON.parse(event.details);
        // If successful, JSON is valid
      } catch (error) {
        console.log(`❌ Corrupted JSON found in event ${event.id}:`);
        console.log(`   Type: ${event.type}`);
        console.log(`   Details: ${event.details.substring(0, 100)}...`);
        console.log(`   Error: ${error.message}`);
        
        corruptedCount++;

        // Try to fix common JSON issues
        let fixedDetails = null;
        
        // Try to fix unterminated strings by removing incomplete parts
        if (error.message.includes('Unterminated string')) {
          // Find the last complete JSON object
          let details = event.details;
          
          // Try to find a valid JSON by truncating at different points
          for (let i = details.length - 1; i > 0; i--) {
            try {
              const truncated = details.substring(0, i);
              if (truncated.endsWith('"') || truncated.endsWith('}')) {
                JSON.parse(truncated);
                fixedDetails = truncated;
                break;
              }
            } catch (e) {
              // Continue trying
            }
          }
          
          // If we can't fix it, create a minimal valid JSON
          if (!fixedDetails) {
            fixedDetails = JSON.stringify({
              error: 'Original data was corrupted',
              originalLength: details.length,
              type: event.type,
              timestamp: new Date().toISOString()
            });
          }
        }

        if (fixedDetails) {
          // Update the event with fixed details
          await prisma.event.update({
            where: { id: event.id },
            data: { details: fixedDetails }
          });
          
          console.log(`✅ Fixed event ${event.id}`);
          fixedCount++;
        } else {
          // If we can't fix it, set it to null
          await prisma.event.update({
            where: { id: event.id },
            data: { details: null }
          });
          
          console.log(`🗑️  Cleared corrupted details for event ${event.id}`);
          fixedCount++;
        }
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Total events checked: ${events.length}`);
    console.log(`   Corrupted events found: ${corruptedCount}`);
    console.log(`   Events fixed: ${fixedCount}`);
    
    if (corruptedCount === 0) {
      console.log('✅ No corrupted JSON found!');
    } else {
      console.log('✅ All corrupted JSON has been fixed!');
      console.log('🔄 Please refresh your Email Activity page to see the changes.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
fixCorruptedEventDetails();
