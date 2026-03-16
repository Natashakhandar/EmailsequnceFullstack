
const fs = require('fs');
const content = fs.readFileSync('c:/Users/natas/OneDrive/Desktop/EmailsequnceFullstack/emailseq-frontend/src/pages/Leads.tsx', 'utf8');

let braces = 0;
let brackets = 0;
let parens = 0;

for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') braces++;
  if (content[i] === '}') braces--;
  if (content[i] === '[') brackets++;
  if (content[i] === ']') brackets--;
  if (content[i] === '(') parens++;
  if (content[i] === ')') parens--;
}

console.log({ braces, brackets, parens });
