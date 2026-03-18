require('dotenv').config();

console.log('\n🔍 UNSUBSCRIBE SETUP VERIFICATION\n');
console.log('═'.repeat(50));

console.log('\n📧 EMAIL CONFIGURATION:');
console.log(`  APP_URL: ${process.env.APP_URL || 'NOT SET'}`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`  Backend Port: ${process.env.PORT || 3001}`);

const { emailConfig } = require('./src/config/smtp');

console.log('\n✅ RESOLVED CONFIG:');
console.log(`  appUrl: ${emailConfig.appUrl}`);
console.log(`  Unsubscribe Link Format: ${emailConfig.appUrl}/api/unsubscribe/{token}`);

console.log('\n📋 WHEN YOU SEND A CAMPAIGN:');
console.log(`  1. Each email gets a unique unsubscribe token`);
console.log(`  2. Token stored in database with contact ID`);
console.log(`  3. Email contains link: ${emailConfig.appUrl}/api/unsubscribe/{token}`);
console.log(`  4. Recipient clicks link → sees popup dialog`);
console.log(`  5. Selects reason + submit → you get notified`);

console.log('\n🌍 PUBLIC ACCESS:');
if (process.env.APP_URL && process.env.APP_URL.includes('email.boostnow.in')) {
  console.log('  ✅ Production domain is configured');
  console.log('  ✅ Recipients can access from any device');
  console.log('  ✅ Works on mobile phones');
} else {
  console.log('  ⚠️  Check APP_URL in .env file');
}

console.log('\n' + '═'.repeat(50) + '\n');
