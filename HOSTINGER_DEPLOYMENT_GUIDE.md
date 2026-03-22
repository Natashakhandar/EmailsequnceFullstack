# Hostinger Auto-Deployment Guide

## Overview
This guide sets up **automatic deployment** to Hostinger whenever you push code to GitHub. No manual pulling needed! ✨

---

## Step 1: Add Webhook Secret to .env

Add this to your `backend/.env` file on **both local and Hostinger**:

```env
# Deployment webhook secret (make it long and random, e.g., 32+ characters)
WEBHOOK_SECRET=your-super-secret-webhook-key-32-chars-min-abc123xyz789abc123xyz789abc123
```

Generate a secure secret:
- Linux/Mac: `openssl rand -hex 32`
- Windows PowerShell: `[Convert]::ToBase64String((1..32|ForEach-Object{[byte](Get-Random -Max 256)}))`

Or just use any 32+ character string.

---

## Step 2: Push Code to GitHub

The webhook router is already integrated. Just push:

```bash
cd c:\Users\natas\Documents\New folder\EmailsequnceFullstack

# Add the webhook file
git add -A
git commit -m "Add webhook-based auto-deployment for Hostinger"
git push origin main
```

---

## Step 3: Setup GitHub Webhook

### On GitHub:

1. Go to your repo: `https://github.com/Zeeshan2201/EmailsequnceFullstack`
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Fill in:
   - **Payload URL**: `https://silver-tapir-929419.hostingersite.com/api/deploy/deploy-webhook`
   - **Content type**: `application/json`
   - **Secret**: (paste your WEBHOOK_SECRET from Step 1)
   - **Which events?**: Select "Just the push event"
   - **Active**: ✅ Check this box

4. Click **Add webhook**

### Verify Webhook:

- Go back to Webhooks page
- Click the webhook you just created
- Click **Recent Deliveries** tab
- If it shows a response from Hostinger, you're good! ✅

---

## Step 4: Update Hostinger's .env

SSH into Hostinger (or use File Manager Terminal) and add to `backend/.env`:

```bash
# Same WEBHOOK_SECRET as Step 1
WEBHOOK_SECRET=your-super-secret-webhook-key-32-chars-min-abc123xyz789abc123xyz789abc123
```

---

## How It Works

```
You push to GitHub
        ↓
GitHub sends webhook notification to Hostinger
        ↓
Webhook hits: https://silver-tapir-929419.hostingersite.com/api/deploy/deploy-webhook
        ↓
Backend verifies signature (checks WEBHOOK_SECRET)
        ↓
Runs: git pull origin main
        ↓
Runs: npm install (backend + frontend)
        ↓
✅ Latest code is now live!
```

---

## Optional: Access Hostinger Terminal

If you want to manually test or run commands:

1. In cPanel (Hostinger control panel)
2. Find **Terminal** or **File Manager → Terminal**
3. Navigate to project:
   ```bash
   cd public_html/EmailsequnceFullstack
   git pull origin main
   npm install
   ```

---

## Verify Deployment is Working

After pushing to GitHub:

1. Check Hostinger UI at: `https://silver-tapir-929419.hostingersite.com/unsubscribe?token=...`
2. Should see **beautiful purple gradient UI** (same as localhost)
3. Check GitHub webhook recent deliveries for logs
4. Or call: `https://silver-tapir-929419.hostingersite.com/api/deploy/deploy-status`

---

## Troubleshooting

### Webhook shows error status

**Check Hostinger logs:**
```bash
# In Hostinger terminal
tail -f backend.log
```

**Common issues:**
- WEBHOOK_SECRET doesn't match between GitHub and Hostinger .env
- Git SSH keys not configured on Hostinger
- Node/npm not in PATH

**Solution:** Contact Hostinger support to:
- Verify git is installed
- Check SSH keys are configured
- Ensure npm is available

### Manual Test (without GitHub)

Call the endpoint directly:
```bash
curl -X POST https://silver-tapir-929419.hostingersite.com/api/deploy/deploy-manual
```

(In production, add authentication to `/deploy-manual` endpoint!)

---

## What Gets Deployed

- ✅ Backend code (Express routes, logic)
- ✅ Frontend dist build (CSS, JS, HTML)
- ✅ Database migrations (if any)
- ✅ All dependencies (npm install)

**What NOT deployed:**
- ❌ `.env` files (security - must be manually set)
- ❌ `generate-local-token.js` (development only)
- ❌ Node modules (cleared + reinstalled)

---

## Next Steps

1. ✅ Verify code is on GitHub (`git push` already done)
2. ✅ Set webhook secret in both `.env` files
3. ✅ Add GitHub webhook (Settings → Webhooks)
4. ✅ Test by pushing a tiny change:
   ```bash
   echo "# Deployment test" >> DEPLOYMENT_NOTE.md
   git add DEPLOYMENT_NOTE.md
   git commit -m "Test webhook deployment"
   git push origin main
   ```
5. ✅ Check GitHub webhook recent deliveries → should show success
6. ✅ Visit `https://silver-tapir-929419.hostingersite.com/unsubscribe?token=...` → should see purple UI!

---

## Deploy Immediately (Manual)

If you can't wait for webhook, on Hostinger terminal:
```bash
cd public_html/EmailsequnceFullstack
git pull origin main
npm install --prefix backend
npm install --prefix emailseq-frontend
```

Or use Hostinger's **Deploy from Git** feature if available in cPanel → Git Version Control.

---

## Questions?

Check these files:
- [backend/deploy-webhook.js](backend/deploy-webhook.js) - Webhook handler code
- [backend/src/index.js](backend/src/index.js) - Route registration
- GitHub Webhook docs: https://docs.github.com/en/developers/webhooks-and-events/webhooks

