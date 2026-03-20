const { execSync } = require('child_process');
const fs = require('fs');

// SSH credentials
const host = '89.117.27.1';
const port = 65002;
const user = 'u825197931';
const password = 'Boost@123';

// Commands to execute
const commands = [
  'cd public_html/EmailsequnceFullstack',
  'killall -9 node 2>/dev/null || true',
  'sleep 2',
  'cd backend',
  'npm install 2>&1 | tail -20',
  'npx prisma generate 2>&1',
  'cd ..',
  'npm start 2>&1 &',
  'sleep 3',
  'pm2 status'
];

const sshCmd = commands.join('; ');

try {
  console.log('🔗 Connecting to Hostinger server...');
  // Using plink from PuTTY if available, otherwise try ssh with expect
  const cmd = `echo ${password} | ssh -p ${port} ${user}@${host} "${sshCmd}"`;
  
  console.log('Executing remote commands...');
  const result = execSync(cmd, { 
    encoding: 'utf-8',
    shell: 'bash',
    timeout: 60000
  });
  
  console.log('✅ Command output:');
  console.log(result);
} catch (error) {
  console.error('❌ SSH Error:', error.message);
  console.error('Stdout:', error.stdout);
  console.error('Stderr:', error.stderr);
}
