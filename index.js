/**
 * Smart Entry Point for Hostinger Node.js Web App.
 * This file detects the environment and starts the backend service.
 */
const path = require('path');
const fs = require('fs');

// Log startup attempt
console.log('--- Starting BoostNow Email Service ---');
console.log('Current Directory:', __cwd);
console.log('Files in directory:', fs.readdirSync(__cwd).join(', '));

// Try to find the backend entry point
const possiblePaths = [
    './backend/src/index.js',
    './src/index.js',
    '../backend/src/index.js'
];

let foundPath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(path.join(__cwd, p))) {
        foundPath = p;
        break;
    }
}

if (foundPath) {
    console.log(`✅ Found backend entry point at: ${foundPath}`);
    require(foundPath);
} else {
    console.error('❌ CRITICAL ERROR: Could not find backend entry point (src/index.js)!');
    console.error('Please ensure your "backend" folder or "src" folder exists in the application root.');
    process.exit(1);
}
