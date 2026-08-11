const fs = require('fs');
const db = fs.readFileSync('src/data/cardDatabase.ts', 'utf8');

const regex = /id:\s*[\`\"'](HVD-0[1-5])/g;
let match;
const counts = {};

while ((match = regex.exec(db)) !== null) {
  const prefix = match[1];
  counts[prefix] = (counts[prefix] || 0) + 1;
}

console.log("Unique cards per prefix:");
console.log(counts);
