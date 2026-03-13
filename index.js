const path = require('path');
const fs = require('fs');
const http = require('http');

console.log('--- Startup Diagnostic ---');
console.log('CWD:', process.cwd());
console.log('DIR:', __dirname);
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

const possiblePaths = [
    path.join(process.cwd(), 'backend/src/index.js'),
    path.join(__dirname, 'backend/src/index.js'),
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
    try {
        require(targetPath);
    } catch (err) {
        console.error('❌ FAILED to require backend:', err);
        http.createServer((req, res) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Error loading backend: ${err.message}\nStack: ${err.stack}`);
        }).listen(process.env.PORT || 3000);
    }
} else {
    console.error('❌ CRITICAL ERROR: Could not find backend entry point');
    http.createServer((req, res) => {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Backend not found. Searched in: ${possiblePaths.join(', ')}`);
    }).listen(process.env.PORT || 3000);
}
