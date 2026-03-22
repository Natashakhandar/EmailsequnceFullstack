#!/usr/bin/env node

/**
 * Setup Hostinger Webhook Deployment
 * 
 * Run this script to:
 * 1. Generate secure webhook secret
 * 2. Add to .env files
 * 3. Show GitHub webhook setup steps
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

async function setupWebhookDeployment() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        Hostinger Webhook Auto-Deployment Setup               ║
║                                                                ║
║ This will set up automatic deployment when you push to GitHub ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  return new Promise((resolve) => {
    rl.question('Generate a new webhook secret? (y/n) ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        const secret = generateSecret();
        console.log(`\n✅ Generated webhook secret:\n`);
        console.log(`${secret}\n`);
        
        // Add to .env
        const backendEnvPath = path.join(__dirname, '.env');
        let envContent = '';
        
        if (fs.existsSync(backendEnvPath)) {
          envContent = fs.readFileSync(backendEnvPath, 'utf-8');
          
          // Remove existing WEBHOOK_SECRET if present
          envContent = envContent.replace(/WEBHOOK_SECRET=.*\n?/g, '');
        }
        
        // Add new secret
        envContent += `\n# ===== WEBHOOK DEPLOYMENT =====\nWEBHOOK_SECRET=${secret}\n`;
        
        fs.writeFileSync(backendEnvPath, envContent);
        
        console.log(`\n📝 Updated: backend/.env`);
        console.log(`\n📋 Next Steps:\n`);
        console.log(`1. Copy this secret to Hostinger's backend/.env file:\n   ${secret}\n`);
        console.log(`2. Go to GitHub repo: https://github.com/Zeeshan2201/EmailsequnceFullstack\n`);
        console.log(`3. Settings → Webhooks → Add webhook`);
        console.log(`4. Fill in:\n   - Payload URL: https://silver-tapir-929419.hostingersite.com/api/deploy/deploy-webhook\n   - Content type: application/json\n   - Secret: ${secret}\n   - Events: Push events only\n`);
        console.log(`5. Test by pushing a small change to main branch 🚀\n`);
        
        console.log(`Full guide available in: HOSTINGER_DEPLOYMENT_GUIDE.md\n`);
        
      } else {
        console.log('\nℹ️ Using existing secret from .env (if set)\n');
      }
      
      rl.close();
      resolve();
    });
  });
}

setupWebhookDeployment().catch(console.error);
