/**
 * Smart Entry Point for Hostinger Node.js Web App.
 * This file detects the environment and starts the backend service.
 */
const path = require('path');
const fs = require('fs');

console.log('--- Starting BoostNow Email Service ---');
console.log('Current Directory:', process.cwd());

// FORCE PRISMA BINARY ENGINE (Crucial for Hostinger/Cloudlinux)
process.env.PRISMA_QUERY_ENGINE_TYPE = 'binary';
console.log('⚙️ Environment: PRISMA_QUERY_ENGINE_TYPE=binary');

// 1. Find and Start Backend
const backendPath = path.join(process.cwd(), 'src/index.js');
const altBackendPath = path.join(process.cwd(), 'backend/src/index.js');

let targetPath = null;
if (fs.existsSync(backendPath)) {
    targetPath = backendPath;
} else if (fs.existsSync(altBackendPath)) {
    targetPath = altBackendPath;
}

if (targetPath) {
    console.log(`🚀 Launching backend from: ${targetPath}`);
    try {
        require(targetPath);
    } catch (e) {
        console.error('❌ CRITICAL ERROR DURING BACKEND LAUNCH:', e);
        process.exit(1);
    }
} else {
    console.error('❌ CRITICAL ERROR: Could not find src/index.js or backend/src/index.js');
    console.log('Files in:', process.cwd(), fs.readdirSync(process.cwd()));
    process.exit(1);
}
