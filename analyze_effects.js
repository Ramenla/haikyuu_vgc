import fs from 'fs';
import { cardDatabase } from './src/data/cardDatabase.ts';

const appCode = fs.readFileSync('./src/App.tsx', 'utf-8');

let totalCards = 0;
let cardsWithNoEffect = 0;
let cardsWithEffect = 0;
let cardsImplemented = 0;
let cardsUnimplemented = 0;

const implementedCards = [];
const unimplementedCards = [];

for (const card of cardDatabase) {
    totalCards++;
    if (!card.effect || card.effect.toLowerCase().includes('tidak ada efek') || card.effect.trim() === '-') {
        cardsWithNoEffect++;
        continue;
    }

    cardsWithEffect++;

    // Cek apakah diimplementasi melalui generic fields (effectTrigger, effectType)
    let isImplemented = false;
    let reason = '';

    if (card.effectTrigger && card.effectType) {
        isImplemented = true;
        reason = `Generic (${card.effectTrigger} -> ${card.effectType})`;
    } else {
        // Cek hardcoded references di App.tsx
        // Cari ID atau nama kartu
        if (appCode.includes(card.id) || appCode.includes(card.id.replace(/-/g, ''))) {
            isImplemented = true;
            reason = 'Hardcoded by ID in App.tsx';
        } else {
            // Khusus untuk Action Aoba, HVD-03, dll
            if (appCode.includes("actionIllGoAhead") && card.name.includes("I'll Go Ahead")) {
                isImplemented = true;
                reason = 'Hardcoded Handler';
            } else if (appCode.includes("actionDeadOnHVD03") && card.name.includes("Dead On!!")) {
                isImplemented = true;
                reason = 'Hardcoded Handler';
            } else if (appCode.includes("oikawaHVD04") && card.name.includes("Oikawa") && card.type === "Character") {
                isImplemented = true;
                reason = 'Hardcoded Handler';
            }
        }
    }

    if (isImplemented) {
        cardsImplemented++;
        implementedCards.push(`- [x] **${card.id} - ${card.name}**: ${reason}`);
    } else {
        cardsUnimplemented++;
        unimplementedCards.push(`- [ ] **${card.id} - ${card.name}**: ${card.effect}`);
    }
}

const report = `
# Laporan Analisis Efek Kartu Haikyuu VCG

- **Total Kartu di Database:** ${totalCards}
- **Kartu Tanpa Efek ("Tidak ada efek"):** ${cardsWithNoEffect}
- **Kartu Memiliki Efek Text:** ${cardsWithEffect}
  - **Terimplementasi (Secara Data/Sistem):** ${cardsImplemented}
  - **Belum Terimplementasi (Kosong/Hanya Teks):** ${cardsUnimplemented}

## Daftar Kartu Belum Terimplementasi
${unimplementedCards.join('\n')}

## Daftar Kartu Terimplementasi (atau sebagian)
${implementedCards.join('\n')}
`;

fs.writeFileSync('./card_effect_analysis.md', report);
console.log('Analysis saved to card_effect_analysis.md');
