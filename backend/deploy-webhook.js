/**
 * GitHub Webhook Deployment Handler
 * 
 * This endpoint receives GitHub webhook notifications and automatically pulls latest code.
 * 
 * Setup Instructions:
 * 1. Deploy this file to your Hostinger server
 * 2. Go to GitHub repo → Settings → Webhooks → Add webhook
 * 3. Payload URL: https://silver-tapir-929419.hostingersite.com/api/deploy-webhook
 * 4. Content type: application/json
 * 5. Secret: Set in process.env.WEBHOOK_SECRET
 * 6. Events: Push events only
 * 7. Add .env: WEBHOOK_SECRET=your_secret_here
 */

const express = require('express');
const { execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Webhook secret from environment
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-secret-here';
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(req, signature) {
  const payload = JSON.stringify(req.body);
  const hash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  const expected = `sha256=${hash}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Execute git pull and restart backend
 */
function deployLatestCode() {
  try {
    console.log('🚀 Starting deployment...');
    
    // Change to project root
    process.chdir(PROJECT_ROOT);
    console.log(`📁 Working directory: ${PROJECT_ROOT}`);
    
    // Pull latest code
    console.log('📥 Pulling latest code from GitHub...');
    const pullOutput = execSync('git pull origin main', { encoding: 'utf-8' });
    console.log(pullOutput);
    
    // Install backend dependencies (if needed)
    try {
      const backendPath = path.join(PROJECT_ROOT, 'backend');
      if (fs.existsSync(path.join(backendPath, 'package.json'))) {
        console.log('📦 Installing backend dependencies...');
        execSync('npm install', { cwd: backendPath, encoding: 'utf-8' });
      }
    } catch (err) {
      console.warn('⚠️ Backend dependency installation skipped:', err.message);
    }
    
    // Install frontend dependencies (if needed)
    try {
      const frontendPath = path.join(PROJECT_ROOT, 'emailseq-frontend');
      if (fs.existsSync(path.join(frontendPath, 'package.json'))) {
        console.log('📦 Installing frontend dependencies...');
        execSync('npm install', { cwd: frontendPath, encoding: 'utf-8' });
      }
    } catch (err) {
      console.warn('⚠️ Frontend dependency installation skipped:', err.message);
    }
    
    console.log('✅ Deployment successful!');
    return {
      success: true,
      message: 'Latest code deployed successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * POST /api/deploy-webhook
 * GitHub webhook endpoint
 */
router.post('/deploy-webhook', (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing webhook signature' });
    }
    
    if (!verifyWebhookSignature(req, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    
    // Only trigger on push to main branch
    if (req.body.ref !== 'refs/heads/main') {
      console.log(`⏭️ Skipping deployment: push to ${req.body.ref}`);
      return res.json({ message: 'Deployment skipped: not main branch' });
    }
    
    console.log('🔔 GitHub webhook received for main branch');
    
    // Execute deployment asynchronously (don't block webhook response)
    setImmediate(() => {
      const result = deployLatestCode();
      console.log('📊 Deployment result:', result);
    });
    
    // Respond immediately to GitHub
    res.json({
      status: 'deployment_started',
      message: 'Deployment process initiated',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

/**
 * GET /api/deploy-status
 * Check deployment status (health check)
 */
router.get('/deploy-status', (req, res) => {
  res.json({
    status: 'ok',
    webhook: 'active',
    timestamp: new Date().toISOString(),
    instructions: 'Send POST requests to /api/deploy-webhook with GitHub webhook'
  });
});

/**
 * POST /api/deploy-manual
 * Manual deployment trigger (for testing - requires auth ideally)
 */
router.post('/api/deploy-manual', (req, res) => {
  // In production, add authentication here!
  const result = deployLatestCode();
  res.json(result);
});

module.exports = router;
