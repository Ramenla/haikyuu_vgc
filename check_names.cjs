const fs = require('fs');
const db = fs.readFileSync('src/data/cardDatabase.ts', 'utf8');
const regex = /id:\s*[\`\"'](HVD-[^\`\"']+)[\`\"'],\s*name:\s*[\`\"']([^\`\"']+)[\`\"']/g;
let m;
while((m = regex.exec(db)) !== null) {
  console.log(m[1] + ' : ' + m[2]);
}
