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
    require(targetPath);
} else {
    console.error('❌ CRITICAL ERROR: Could not find src/index.js or backend/src/index.js');
    console.log('Files in current directory:', fs.readdirSync(process.cwd()));
    process.exit(1);
}
