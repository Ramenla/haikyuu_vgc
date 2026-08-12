const fs = require('fs');
const content = fs.readFileSync('src/data/cardDatabase.ts', 'utf8');
const cards = content.match(/id: "HV-01-\d{3}"[\s\S]*?(?=\n  \{|\n\])/g) || [];
let vanillaCount = 0;
let effectCount = 0;
cards.forEach(cardStr => {
  const effectMatch = cardStr.match(/effect: "([^"]+)"/);
  if (effectMatch && (effectMatch[1] === 'Tidak ada efek' || effectMatch[1] === '')) {
    vanillaCount++;
  } else {
    effectCount++;
  }
});
console.log('Vanilla cards:', vanillaCount);
console.log('Effect cards:', effectCount);
console.log('Total:', vanillaCount + effectCount);
