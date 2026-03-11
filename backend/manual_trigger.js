const { processDueEmails } = require('./src/jobs/scheduler');

async function trigger() {
  console.log('Triggering email processing...');
  await processDueEmails();
  console.log('Finished.');
  process.exit(0);
}

trigger();
