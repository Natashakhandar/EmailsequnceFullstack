/**
 * GitHub Webhook Handler for Auto-Deployment
 * 
 * Setup:
 * 1. GitHub Webhook URL: https://silver-tapir-929419.hostingersite.com/api/deploy/deploy-webhook
 * 2. Payload URL: same as above
 * 3. Content type: application/json
 * 4. Secret: Set in process.env.WEBHOOK_SECRET
 * 5. Events: Push events only
 */

const express = require('express');
const crypto = require('crypto');
const { execSync } = require('child_process');
const path = require('path');

const router = express.Router();

// Webhook verification middleware
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!signature || !secret) {
    console.log('⚠️  No signature or secret provided');
    return res.status(401).json({ error: 'Unauthorized: Missing signature or secret' });
  }

  const payload = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedSignature = `sha256=${hash}`;

  if (signature !== expectedSignature) {
    console.log('❌ Webhook signature verification failed');
    return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
  }

  console.log('✅ Webhook signature verified');
  next();
}

// Deploy webhook endpoint
router.post('/deploy-webhook', verifyWebhookSignature, async (req, res) => {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 WEBHOOK: Deployment triggered by GitHub push');
    console.log('='.repeat(60));

    const projectRoot = path.resolve(__dirname, '..');

    // Step 1: Git pull
    console.log('\n📥 Step 1: Pulling latest code from GitHub...');
    try {
      const pullOutput = execSync('git pull origin main', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log('✅ Git pull successful\n', pullOutput);
    } catch (error) {
      console.error('❌ Git pull failed:', error.message);
      throw error;
    }

    // Step 2: Install backend deps
    console.log('\n📦 Step 2: Installing backend dependencies...');
    try {
      execSync('npm install', {
        cwd: path.join(projectRoot, 'backend'),
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log('✅ Backend dependencies installed');
    } catch (error) {
      console.error('❌ Backend npm install failed:', error.message);
      throw error;
    }

    // Step 3: Regenerate Prisma client
    console.log('\n🔄 Step 3: Regenerating Prisma client...');
    try {
      execSync('npx prisma generate', {
        cwd: path.join(projectRoot, 'backend'),
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log('✅ Prisma client regenerated');
    } catch (error) {
      console.error('⚠️  Prisma generate warning:', error.message);
      // Don't fail deployment for Prisma issues
    }

    // Step 4: Build frontend
    console.log('\n🏗️  Step 4: Building frontend...');
    try {
      execSync('npm install', {
        cwd: path.join(projectRoot, 'emailseq-frontend'),
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log('✅ Frontend dependencies installed');

      execSync('npm run build', {
        cwd: path.join(projectRoot, 'emailseq-frontend'),
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000 // 2 minutes max for build
      });
      console.log('✅ Frontend build completed');
    } catch (error) {
      console.error('❌ Frontend build failed:', error.message);
      throw error;
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEPLOYMENT SUCCESSFUL!');
    console.log('='.repeat(60) + '\n');

    res.json({
      status: 'success',
      message: 'Deployment completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED:', error.message);
    console.log('='.repeat(60) + '\n');

    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
