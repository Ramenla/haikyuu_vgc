import { CardData } from "../data/cardDatabase";

export function getStarterDeckCards(deckId: string, cardDatabase: CardData[]): CardData[] {
  const prefixMap: Record<string, string> = {
    "starter-1": "HVD-01",
    "Karasuno Starter Deck": "HVD-01",
    "starter-2": "HVD-02",
    "Rivals Starter Deck": "HVD-02",
    "starter-3": "HVD-03",
    "Karasuno Evolves Explosively Starter Deck": "HVD-03",
    "starter-4": "HVD-04",
    "It's Seijō that Goes to Nationals Starter Deck": "HVD-04",
    "starter-5": "HVD-05",
    "Powerhouse!! Fukurodani Academy Group Starter Deck": "HVD-05"
  };

  const prefix = prefixMap[deckId];
  if (!prefix) return [];

  const pool = cardDatabase.filter((c) => c.id.startsWith(prefix));
  const starterCards: CardData[] = [];

  // Khusus untuk HVD-02 (Rivals Starter Deck)
  if (prefix === "HVD-02") {
    const cardCounts: Record<string, number> = {
      "HVD-02-001": 4, // Tetsurō Kuroo
      "HVD-02-002": 4, // Kenma Kozume
      "HVD-02-003": 4, // Sō Inuoka
      "HVD-02-004": 4, // Taketora Yamamoto
      "HVD-02-005": 2, // Morisuke Yaku
      "HVD-02-006": 2, // This is what it means to connect
      "HVD-02-007": 4, // Tōru Oikawa
      "HVD-02-008": 4, // Hajime Iwaizumi
      "HVD-02-009": 3, // Yūtarō Kindaichi
      "HVD-02-010": 3, // Akira Kunimi
      "HVD-02-011": 3, // Issei Matsukawa
      "HVD-02-012": 3, // Doesn't it make sense to connect to that attack?
    };

    pool.forEach(card => {
      const count = cardCounts[card.id] || 0;
      for (let i = 0; i < count; i++) {
        starterCards.push(card);
      }
    });

    return starterCards;
  }

  // Fallback untuk starter deck lain yang belum memiliki rincian jumlah spesifik:
  // Ambil 10 kartu unik, masing-masing 4 lembar.
  const uniqueNames = new Set<string>();
  const finalPool: CardData[] = [];
  for (const card of pool) {
    if (!uniqueNames.has(card.name)) {
      uniqueNames.add(card.name);
      finalPool.push(card);
      if (finalPool.length === 10) break;
    }
  }

  finalPool.forEach(card => {
    starterCards.push(card, card, card, card);
  });

  return starterCards;
}
