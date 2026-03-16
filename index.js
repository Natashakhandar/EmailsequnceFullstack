/**
 * Smart Entry Point for Hostinger Node.js Web App.
 * This file detects the environment and starts the backend service.
 */
const path = require('path');
const fs = require('fs');

console.log('--- Starting BoostNow Email Service ---');
console.log('Current Directory:', process.cwd());

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
    } catch (err) {
        console.error('❌ FATAL: Error during backend launch:');
        console.error(err);
        process.exit(1);
    }
} else {
    console.error('❌ CRITICAL ERROR: Could not find src/index.js or backend/src/index.js');
    console.log('Files in current directory:', fs.readdirSync(process.cwd()));
    process.exit(1);
}
