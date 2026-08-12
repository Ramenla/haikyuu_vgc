const fs = require('fs');
const content = fs.readFileSync('src/data/cardDatabase.ts', 'utf8');
const cards = content.match(/id: "HV-01-\d{3}"[\s\S]*?(?=\n  \{|\n\])/g) || [];
let effectCards = [];
cards.forEach(cardStr => {
  const nameMatch = cardStr.match(/name: "([^"]+)"/);
  const effectMatch = cardStr.match(/effect: "([^"]+)"/);
  const effectTypeMatch = cardStr.match(/effectType: "([^"]*)"/);
  
  if (effectMatch && (effectMatch[1] !== 'Tidak ada efek' && effectMatch[1] !== '')) {
    const idMatch = cardStr.match(/id: "([^"]+)"/);
    effectCards.push({
      id: idMatch ? idMatch[1] : '?',
      name: nameMatch ? nameMatch[1] : '?',
      effectType: effectTypeMatch ? effectTypeMatch[1] : 'MISSING',
      effect: effectMatch[1]
    });
  }
});
console.log(JSON.stringify(effectCards, null, 2));
