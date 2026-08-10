const fs = require('fs');
const content = \import React, { useState } from "react";
import { CardData } from "../../types/card";
import { cardDatabase } from "../../data/cardDatabase";
import { Screen } from "../../types/game";

interface DeckBuilderScreenProps {
  builderDeck: CardData[];
  deckBuilderSearch: string;
  deckBuilderFilter: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onAddToBuilderDeck: (card: CardData) => void;
  onRemoveFromBuilderDeck: (index: number) => void;
  onNavigate: (screen: Screen) => void;
}

export const DeckBuilderScreen: React.FC<DeckBuilderScreenProps> = ({
  builderDeck,
  deckBuilderSearch,
  deckBuilderFilter,
  onSearchChange,
  onFilterChange,
  onAddToBuilderDeck,
  onRemoveFromBuilderDeck,
  onNavigate,
}) => {
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

  // Filter dan urutkan kartu dari database
  const filteredPool = cardDatabase
    .filter((card) => {
      const searchMatch =
        card.name.toLowerCase().includes(deckBuilderSearch.toLowerCase()) ||
        card.id.toLowerCase().includes(deckBuilderSearch.toLowerCase());

      let filterMatch = true;
      if (deckBuilderFilter === "Karasuno")
        filterMatch = card.id.startsWith("HVD-01");
      else if (deckBuilderFilter === "Rivals")
        filterMatch = card.id.startsWith("HVD-02");
      else if (deckBuilderFilter === "Character")
        filterMatch = card.type === "Character";
      else if (deckBuilderFilter === "Action")
        filterMatch = card.type === "Action";

      return searchMatch && filterMatch;
    })
    .sort((a, b) => {
      if (a.type === "Character" && b.type === "Action") return -1;
      if (a.type === "Action" && b.type === "Character") return 1;
      return 0;
    });

  const sortedBuilderDeck = [...builderDeck].sort((a, b) => {
    if (a.type === "Character" && b.type === "Action") return -1;
    if (a.type === "Action" && b.type === "Character") return 1;
    return 0;
  });

  const filteredCharacters = filteredPool.filter(
    (c) => c.type === "Character",
  );
  const filteredEvents = filteredPool.filter((c) => c.type === "Action");

  const deckCharacters = sortedBuilderDeck.filter(
    (c) => c.type === "Character",
  );
  const deckEvents = sortedBuilderDeck.filter((c) => c.type === "Action");

  return (
    <div className="h-screen w-screen bg-black text-gray-200 font-sans p-4 flex flex-col gap-4 overflow-hidden box-border">
      {/* Header Deck Builder */}
      <div className="flex flex-col md:flex-row justify-between items-center shrink-0 gap-4">
        <h2 className="text-xl md:text-3xl font-bold text-orange-500 uppercase tracking-widest">
          Deck Builder
        </h2>
        <div className="flex gap-2 md:gap-3 w-full md:w-auto overflow-x-auto">
          <input
            type="text"
            placeholder="Cari nama/ID..."
            value={deckBuilderSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-neutral-800 border-2 border-gray-700 text-white px-3 py-2 rounded text-sm min-w-[120px] focus:outline-none focus:border-orange-500"
          />
          <select
            value={deckBuilderFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="bg-neutral-800 border-2 border-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-orange-500"
          >
            <option value="All">Semua Kartu</option>
            <option value="Karasuno">Karasuno Deck</option>
            <option value="Rivals">Rivals Deck</option>
            <option value="Character">Character Saja</option>
            <option value="Action">Action Saja</option>
          </select>
          <button
            onClick={() => onNavigate("menu")}
            className="px-4 py-2 bg-neutral-800 border-2 border-gray-700 hover:border-orange-500 hover:text-orange-500 text-white font-bold uppercase tracking-wider text-[10px] md:text-sm transition-all rounded whitespace-nowrap"
          >
            Back to Menu
          </button>
          <button className="px-4 py-2 bg-orange-600 border-2 border-orange-500 hover:bg-orange-700 text-white font-bold uppercase tracking-wider text-[10px] md:text-sm transition-all rounded shadow-lg whitespace-nowrap">
            Save Deck
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Kolom Kiri: Detail Panel */}
        <div className="w-full md:w-1/4 lg:w-1/5 bg-neutral-900 border border-gray-800 rounded p-4 flex flex-col min-h-0 overflow-y-auto">
          <h3 className="text-base md:text-lg font-bold text-gray-300 mb-3 border-b border-gray-700 pb-2">
            Card Detail
          </h3>
          {selectedCard ? (
            <div className="flex flex-col gap-3">
              <img src={selectedCard.image} alt={selectedCard.name} className="w-full rounded border-2 border-gray-700" />
              <div>
                <h4 className="font-bold text-orange-500 text-lg leading-tight">{selectedCard.name}</h4>
                <p className="text-xs text-gray-400 mt-1">ID: {selectedCard.id} | {selectedCard.type}</p>
              </div>
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={() => onAddToBuilderDeck(selectedCard)}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded shadow-lg transition-colors text-sm"
                >
                  Add
                </button>
                <button 
                  onClick={() => {
                    const realIndex = builderDeck.findIndex(c => c.id === selectedCard.id);
                    if (realIndex !== -1) onRemoveFromBuilderDeck(realIndex);
                  }}
                  disabled={!builderDeck.some(c => c.id === selectedCard.id)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-gray-600 text-white font-bold rounded shadow-lg transition-colors text-sm"
                >
                  Remove
                </button>
              </div>
              <div className="text-sm mt-2">
                <p><span className="text-gray-500">School:</span> {selectedCard.school || "-"}</p>
                {selectedCard.type === "Character" && (
                  <>
                    <p><span className="text-gray-500">Year:</span> {selectedCard.year}</p>
                    <p><span className="text-gray-500">Position:</span> {selectedCard.position}</p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                <div className="bg-neutral-800 p-2 rounded text-center border border-gray-700"><span className="text-gray-500 block">Serve</span> <span className="font-bold text-base">{selectedCard.stats.serve}</span></div>
                <div className="bg-neutral-800 p-2 rounded text-center border border-gray-700"><span className="text-gray-500 block">Receive</span> <span className="font-bold text-base">{selectedCard.stats.receive}</span></div>
                <div className="bg-neutral-800 p-2 rounded text-center border border-gray-700"><span className="text-gray-500 block">Toss</span> <span className="font-bold text-base">{selectedCard.stats.toss}</span></div>
                <div className="bg-neutral-800 p-2 rounded text-center border border-gray-700"><span className="text-gray-500 block">Attack</span> <span className="font-bold text-base">{selectedCard.stats.attack}</span></div>
                <div className="bg-neutral-800 p-2 rounded text-center border border-gray-700 col-span-2"><span className="text-gray-500 block">Block</span> <span className="font-bold text-base">{selectedCard.stats.block}</span></div>
              </div>
              <div className="bg-neutral-800 p-3 rounded border border-gray-700 mt-2">
                <span className="text-gray-500 text-xs block mb-1">Effect:</span>
                <p className="text-sm leading-relaxed">{selectedCard.effect || "Tidak ada efek"}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 italic text-sm text-center">
              Click a card to see details
            </div>
          )}
        </div>

        {/* Kolom Tengah: Card Pool */}
        <div className="flex-[1.5] bg-neutral-900 border border-gray-800 rounded p-4 flex flex-col min-h-0">
          <h3 className="text-base md:text-lg font-bold text-gray-300 mb-3 border-b border-gray-700 pb-2">
            Card Pool
          </h3>
          <div className="flex-1 overflow-y-auto content-start pr-2">
            {filteredCharacters.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">
                  Characters
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredCharacters.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCard(card)}
                      className={\spect-[2/3] bg-neutral-800 border-2 \ rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-colors group relative overflow-hidden\}
                      title="Click to view details"
                      style={{
                        backgroundImage: \url('\')\,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/20 transition-colors"></div>
                      <div className="relative z-10 text-[10px] font-bold text-white leading-tight drop-shadow-md">
                        {card.name}
                      </div>
                      <div className="relative z-10 text-[8px] font-bold text-gray-200 mt-1 drop-shadow-md">
                        R{card.stats.receive}/T{card.stats.toss}/A
                        {card.stats.attack}/B{card.stats.block}
                      </div>
                      <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredEvents.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">
                  Actions
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredEvents.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCard(card)}
                      className={\spect-[3/2] bg-neutral-800 border-2 \ rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-colors group relative overflow-hidden\}
                      title="Click to view details"
                      style={{
                        backgroundImage: \url('\')\,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/20 transition-colors"></div>
                      <div className="relative z-10 text-[10px] font-bold text-white leading-tight drop-shadow-md">
                        {card.name}
                      </div>
                      <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredPool.length === 0 && (
              <div className="w-full text-center text-gray-500 italic p-4">
                Tidak ada kartu yang ditemukan.
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Your Deck */}
        <div className="w-full md:w-1/4 lg:w-1/4 bg-neutral-900 border border-gray-800 rounded p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2 shrink-0">
            <h3 className="text-base md:text-lg font-bold text-gray-300">
              Your Deck
            </h3>
            <span
              className={\	ext-xs md:text-sm font-mono font-bold \\}
            >
              Total Cards: {builderDeck.length}/40
            </span>
          </div>

          <div className="flex-1 overflow-y-auto bg-black/50 border border-gray-800 rounded p-3 content-start">
            {builderDeck.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-600 italic text-sm text-center p-4">
                Click cards from the pool to add them to your deck.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {deckCharacters.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">
                      Characters ({deckCharacters.length})
                    </h4>
                    <div className="flex flex-wrap gap-2 items-start">
                      {deckCharacters.map((card, index) => (
                        <div
                          key={\char-\-\\}
                          onClick={() => setSelectedCard(card)}
                          className={\w-14 md:w-16 aspect-[2/3] bg-neutral-800 border \ rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-1 text-center transition-colors relative overflow-hidden shrink-0\}
                          title="Click to view details"
                          style={{
                            backgroundImage: \url('\')\,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          <div className="absolute inset-0 bg-black/60 hover:bg-black/20 transition-colors"></div>
                          <div className="relative z-10 text-[8px] font-bold text-white leading-tight drop-shadow-md">
                            {card.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {deckEvents.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">
                      Actions ({deckEvents.length})
                    </h4>
                    <div className="flex flex-wrap gap-2 items-start">
                      {deckEvents.map((card, index) => (
                        <div
                          key={\event-\-\\}
                          onClick={() => setSelectedCard(card)}
                          className={\w-20 md:w-24 aspect-[3/2] bg-neutral-800 border \ rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-1 text-center transition-colors relative overflow-hidden shrink-0\}
                          title="Click to view details"
                          style={{
                            backgroundImage: \url('\')\,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          <div className="absolute inset-0 bg-black/60 hover:bg-black/20 transition-colors"></div>
                          <div className="relative z-10 text-[8px] font-bold text-white leading-tight drop-shadow-md">
                            {card.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
\;
fs.writeFileSync('src/components/screens/DeckBuilderScreen.tsx', content);
