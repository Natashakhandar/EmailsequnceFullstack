const { buildEmailIdCandidates } = require('./src/utils/emailIdUtils');
const prisma = require('./src/db/prismaClient');
const { v4: uuidv4 } = require('uuid');

async function test() {
  console.log('🧪 Starting Tracking Logic Verification...');
  
  const originalId = `<${uuidv4()}@boostnow.in>`;
  const variants = buildEmailIdCandidates(originalId);
  
  console.log(`✅ Original ID: ${originalId}`);
  console.log(`📂 Generated Variants: ${JSON.stringify(variants)}`);
  
  // Prove that the original is in the variants
  if (variants.includes(originalId)) {
    console.log('✅ Success: Original ID is included in candidates.');
  } else {
    console.log('❌ Failure: Original ID missing from candidates.');
  }

  // Prove that a clean ID (no brackets) is in variants
  const cleanId = originalId.replace(/[<>]/g, '');
  if (variants.includes(cleanId)) {
    console.log(`✅ Success: Clean version "${cleanId}" is matched.`);
  } else {
    console.log(`❌ Failure: Clean version missing.`);
  }

  console.log('\n🚀 Testing Database Match Simulation...');
  
  // Create a mock contact and sent event
  const contact = await prisma.contact.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      status: 'ACTIVE'
    }
  });

  const sentEvent = await prisma.event.create({
    data: {
      contactId: contact.id,
      type: 'SENT',
      emailId: originalId,
      details: JSON.stringify({ subject: 'Proof of work' })
    }
  });

  console.log(`📝 Created mock SENT event with ID: ${originalId}`);

  // Now simulate the track/open query using a VARIANT instead of the original
  const queryId = cleanId; // Simulate client stripping brackets
  const lookupCandidates = buildEmailIdCandidates(queryId);
  
  const matchedEvent = await prisma.event.findFirst({
    where: {
      type: 'SENT',
      emailId: { in: lookupCandidates }
    }
  });

  if (matchedEvent && matchedEvent.id === sentEvent.id) {
    console.log('🎉 PROOF: Matched SENT event using modified ID (without brackets)!');
  } else {
    console.log('❌ PROOF FAILED: Could not match event with modified ID.');
  }

  // Cleanup
  await prisma.event.deleteMany({ where: { contactId: contact.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
  
  console.log('\n🏁 Verification Complete!');
}

test().catch(console.error);
