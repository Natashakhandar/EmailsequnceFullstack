/**
 * Smart Entry Point for Hostinger Node.js Web App.
 * This file detects the environment and starts the backend service.
 */
const path = require('path');
const fs = require('fs');

console.log('--- Starting BoostNow Email Service ---');
console.log('Current Directory:', process.cwd());

// Log Environment Variables Presence (Names only for security)
const envsToCheck = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV', 'PORT'];
console.log('--- Environment Check ---');
envsToCheck.forEach(env => {
    let status = '❌ MISSING';
    if (process.env[env]) {
        status = '✅ PRESENT';
        if (env === 'DATABASE_URL') {
            const url = process.env.DATABASE_URL;
            // Mask password but show host/db
            const parts = url.split('@');
            if (parts.length > 1) {
                const head = parts[0].split(':'); // mysql://user
                const tail = parts[1]; // host:port/db
                status += ` [${head[0]}://${head[1]}:****@${tail}]`;
            }
        }
    }
    console.log(`${env}: ${status}`);
});

// Check for shadowing .env files
const envFiles = [
    path.join(__dirname, '.env'),
    path.join(__dirname, 'backend/.env'),
    path.join(__dirname, 'backend/src/.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'backend/.env')
];
console.log('--- .env File Audit ---');
envFiles.forEach(f => {
    try {
        if (fs.existsSync(f)) {
            const stats = fs.statSync(f);
            console.warn(`⚠️  CRITICAL: .env file found at ${f} (Size: ${stats.size} bytes). PLEASE DELETE THIS FROM HOSTINGER FILE MANAGER!`);
        }
    } catch (e) {}
});
console.log('-------------------------');

// 1. Precise Path Discovery
const possiblePaths = [
    path.join(__dirname, 'backend/src/index.js'),
    path.join(__dirname, 'src/index.js'),
    path.join(process.cwd(), 'backend/src/index.js'),
    path.join(process.cwd(), 'src/index.js')
];

let targetPath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        targetPath = p;
        break;
    }
}

if (targetPath) {
    console.log(`🚀 Launching backend from: ${targetPath}`);
    // Clear cache to ensure fresh load on redeploy
    delete require.cache[require.resolve(targetPath)];
    require(targetPath);
} else {
    console.error('❌ CRITICAL ERROR: Backend entry point not found!');
    console.log('Checked paths:', possiblePaths);
    
    // Emergency Fallback Server (to prevent 404)
    const http = require('http');
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Backend Entry Point Missing', 
            paths_checked: possiblePaths,
            cwd: process.cwd()
        }));
    }).listen(process.env.PORT || 3001);
}

