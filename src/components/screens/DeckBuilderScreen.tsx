import React, { useState } from "react";
import { CardData } from "../../types/card";
import { cardDatabase } from "../../data/cardDatabase";
import { Screen, CustomDeck } from "../../types/game";

interface DeckBuilderScreenProps {
  customDecks: CustomDeck[];
  setCustomDecks: React.Dispatch<React.SetStateAction<CustomDeck[]>>;
  setBuilderDeck: React.Dispatch<React.SetStateAction<CardData[]>>;
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
  customDecks,
  setCustomDecks,
  setBuilderDeck,
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

  const [activeDeckId, setActiveDeckId] = useState<string>("new");
  const [deckName, setDeckName] = useState<string>("Custom Deck");

  const handleSaveDeck = () => {
    if (deckName.trim() === "") {
      alert("Nama deck tidak boleh kosong!");
      return;
    }

    const isValid = builderDeck.length === 40;
    
    if (activeDeckId === "new") {
      const newId = "deck_" + Date.now();
      const newDeck: CustomDeck = {
        id: newId,
        name: deckName,
        cards: builderDeck.map(c => c.id),
        isValid
      };
      setCustomDecks([...customDecks, newDeck]);
      setActiveDeckId(newId);
      alert(isValid ? "Deck berhasil disimpan!" : "Draft Deck disimpan (Belum Valid: Kurang dari 40 kartu).");
    } else {
      setCustomDecks(customDecks.map(d => 
        d.id === activeDeckId 
          ? { ...d, name: deckName, cards: builderDeck.map(c => c.id), isValid }
          : d
      ));
      alert(isValid ? "Deck berhasil diperbarui!" : "Draft Deck diperbarui (Belum Valid: Kurang dari 40 kartu).");
    }
  };

  const handleDeleteDeck = () => {
    if (activeDeckId === "new") return;
    if (confirm("Apakah kamu yakin ingin menghapus deck ini?")) {
      setCustomDecks(customDecks.filter(d => d.id !== activeDeckId));
      setActiveDeckId("new");
      setDeckName("Custom Deck");
      setBuilderDeck([]);
    }
  };

  const handleLoadDeck = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveDeckId(id);
    if (id === "new") {
      setDeckName("Custom Deck");
      setBuilderDeck([]);
    } else {
      const deck = customDecks.find(d => d.id === id);
      if (deck) {
        setDeckName(deck.name);
        const loadedCards = deck.cards.map(cardId => cardDatabase.find(c => c.id === cardId)!).filter(Boolean);
        setBuilderDeck(loadedCards);
      }
    }
  };

  const handleExport = () => {
    const code = btoa(JSON.stringify(builderDeck.map(c => c.id)));
    prompt("Salin kode deck ini:", code);
  };

  const handleImport = () => {
    const code = prompt("Masukkan kode deck:");
    if (!code) return;
    try {
      const cardIds = JSON.parse(atob(code));
      if (Array.isArray(cardIds)) {
        const loadedCards = cardIds.map((id: string) => cardDatabase.find(c => c.id === id)!).filter(Boolean);
        setBuilderDeck(loadedCards);
        setActiveDeckId("new");
        setDeckName("Imported Deck");
      }
    } catch (e) {
      alert("Kode deck tidak valid!");
    }
  };


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
      else if (deckBuilderFilter === "KarasunoEvo")
        filterMatch = card.id.startsWith("HVD-03");
      else if (deckBuilderFilter === "Aoba")
        filterMatch = card.id.startsWith("HVD-04");
      else if (deckBuilderFilter === "Fukurodani")
        filterMatch = card.id.startsWith("HVD-05");
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
    <div className="h-screen w-screen bg-black text-gray-200 font-sans p-4 flex flex-col gap-4 overflow-y-auto md:overflow-hidden box-border custom-scrollbar">
      {/* Header Deck Builder */}
      <div className="flex flex-col shrink-0 gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl md:text-3xl font-bold text-orange-500 uppercase tracking-widest">
            Deck Builder
          </h2>
          <div className="flex gap-2 md:gap-3 w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => onNavigate("menu")}
              className="px-4 py-2 bg-neutral-800 border-2 border-gray-700 hover:border-orange-500 hover:text-orange-500 text-white font-bold uppercase tracking-wider text-[10px] md:text-sm transition-all rounded whitespace-nowrap"
            >
              Back to Menu
            </button>
            <button onClick={handleExport} className="px-4 py-2 bg-blue-600 border-2 border-blue-500 hover:bg-blue-700 text-white font-bold uppercase tracking-wider text-[10px] md:text-sm transition-all rounded whitespace-nowrap">
              Export
            </button>
            <button onClick={handleImport} className="px-4 py-2 bg-purple-600 border-2 border-purple-500 hover:bg-purple-700 text-white font-bold uppercase tracking-wider text-[10px] md:text-sm transition-all rounded whitespace-nowrap">
              Import
            </button>
            <button onClick={handleSaveDeck} className="px-4 py-2 bg-orange-600 border-2 border-orange-500 hover:bg-orange-700 text-white font-bold uppercase tracking-wider text-[10px] md:text-sm transition-all rounded whitespace-nowrap">
              Save Deck
            </button>
          </div>
        </div>
        
        {/* Sub-header for Deck Management */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-neutral-900 p-3 rounded border border-gray-800">
          <select 
            value={activeDeckId}
            onChange={handleLoadDeck}
            className="bg-black text-white p-2 rounded border border-gray-700 min-w-[200px]"
          >
            <option value="new">-- Buat Deck Baru --</option>
            {customDecks.map(d => (
              <option key={d.id} value={d.id}>{d.name} {d.isValid ? "(Valid)" : "(Draft)"}</option>
            ))}
          </select>
          
          <input 
            type="text" 
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Nama Deck"
            className="bg-black text-white p-2 rounded border border-gray-700 flex-1 min-w-[200px]"
          />
          
          <div className={`px-4 py-2 font-bold rounded ${builderDeck.length === 40 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
            {builderDeck.length}/40 Kartu
          </div>
          
          {activeDeckId !== "new" && (
            <button onClick={handleDeleteDeck} className="px-4 py-2 bg-red-600 border-2 border-red-500 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-[10px] md:text-sm transition-all rounded">
              Hapus Deck
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-y-auto md:overflow-hidden min-h-0">
        {/* Kolom Kiri: Detail Panel */}
        <div className="w-full md:w-1/4 lg:w-1/5 bg-neutral-900 border border-gray-800 rounded p-4 flex flex-col min-h-0 md:min-h-0 overflow-y-auto shrink-0 md:shrink">
          <h3 className="text-base md:text-lg font-bold text-gray-300 mb-3 border-b border-gray-700 pb-2">
            Card Detail
          </h3>
          {selectedCard ? (
            <div className="flex flex-col gap-2">
              <img 
                src={selectedCard.image} 
                alt={selectedCard.name} 
                className={`mx-auto object-cover rounded border-2 border-gray-700 ${selectedCard.type === 'Action' ? 'w-5/6 aspect-[3/2]' : 'w-1/2 aspect-[2/3]'}`} 
              />
              <div className="text-center">
                <h4 className="font-bold text-orange-500 text-base leading-tight">{selectedCard.name}</h4>
                <p className="text-[10px] text-gray-400">ID: {selectedCard.id} | {selectedCard.type}</p>
              </div>
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={() => onAddToBuilderDeck(selectedCard)}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded transition-colors text-sm"
                >
                  Add
                </button>
                <button 
                  onClick={() => {
                    const realIndex = builderDeck.findIndex(c => c.id === selectedCard.id);
                    if (realIndex !== -1) onRemoveFromBuilderDeck(realIndex);
                  }}
                  disabled={!builderDeck.some(c => c.id === selectedCard.id)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-gray-600 text-white font-bold rounded transition-colors text-sm"
                >
                  Remove
                </button>
              </div>
              <div className="text-xs mt-1">
                <p><span className="text-gray-500">School:</span> {selectedCard.school || "-"}</p>
                {selectedCard.type === "Character" && (
                  <>
                    <p><span className="text-gray-500">Year:</span> {selectedCard.year}</p>
                    <p><span className="text-gray-500">Position:</span> {selectedCard.position}</p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1 text-[10px] mt-1">
                <div className="bg-neutral-800 p-1 rounded text-center border border-gray-700"><span className="text-gray-500 block">S</span> <span className="font-bold text-sm">{selectedCard.stats?.serve ?? 0}</span></div>
                <div className="bg-neutral-800 p-1 rounded text-center border border-gray-700"><span className="text-gray-500 block">R</span> <span className="font-bold text-sm">{selectedCard.stats?.receive ?? 0}</span></div>
                <div className="bg-neutral-800 p-1 rounded text-center border border-gray-700"><span className="text-gray-500 block">T</span> <span className="font-bold text-sm">{selectedCard.stats?.toss ?? 0}</span></div>
                <div className="bg-neutral-800 p-1 rounded text-center border border-gray-700"><span className="text-gray-500 block">A</span> <span className="font-bold text-sm">{selectedCard.stats?.attack ?? 0}</span></div>
                <div className="bg-neutral-800 p-1 rounded text-center border border-gray-700"><span className="text-gray-500 block">B</span> <span className="font-bold text-sm">{selectedCard.stats?.block ?? 0}</span></div>
              </div>
              <div className="bg-neutral-800 p-2 rounded border border-gray-700 mt-1 max-h-32 overflow-y-auto scrollbar-minimalist">
                <span className="text-gray-500 text-[10px] block mb-1">Effect:</span>
                <p className="text-xs leading-tight">{selectedCard.effect || "Tidak ada efek"}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 italic text-sm text-center">
              Click a card to see details
            </div>
          )}
        </div>

        <div className="flex-[1.5] bg-neutral-900 border border-gray-800 rounded p-4 flex flex-col min-h-0">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-3 border-b border-gray-700 pb-2 gap-2">
            <h3 className="text-base md:text-lg font-bold text-gray-300">
              Card Pool
            </h3>
            <div className="flex gap-2 w-full xl:w-auto">
              <input
                type="text"
                placeholder="Cari nama/ID..."
                value={deckBuilderSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-neutral-800 border-2 border-gray-700 text-white px-3 py-1.5 rounded text-xs min-w-[100px] flex-1 xl:flex-none focus:outline-none focus:border-orange-500"
              />
              <select
                value={deckBuilderFilter}
                onChange={(e) => onFilterChange(e.target.value)}
                className="bg-neutral-800 border-2 border-gray-700 text-white px-2 py-1.5 rounded text-xs flex-1 xl:flex-none focus:outline-none focus:border-orange-500"
              >
                <option value="All">Semua Kartu</option>
                <option value="Karasuno">HVD-01 (Karasuno)</option>
                <option value="Rivals">HVD-02 (Rivals)</option>
                <option value="KarasunoEvo">HVD-03 (Karasuno Evo)</option>
                <option value="Aoba">HVD-04 (Aoba JÅsai)</option>
                <option value="Fukurodani">HVD-05 (FukurÅdani)</option>
                <option value="Character">Character Saja</option>
                <option value="Action">Action Saja</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto content-start pr-2 scrollbar-minimalist">
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
                      className={`aspect-[2/3] bg-neutral-800 border-2 ${selectedCard?.id === card.id ? 'border-orange-500' : 'border-gray-700'} rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-colors group relative overflow-hidden`}
                      title="Click to view details"
                      style={{
                        backgroundImage: `url('${encodeURI(card.image)}')`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/20 transition-colors"></div>
                      <div className="relative z-10 text-[10px] font-bold text-white leading-tight">
                        {card.name}
                      </div>
                      <div className="relative z-10 text-[8px] font-bold text-gray-200 mt-1">
                        R{card.stats?.receive ?? 0}/T{card.stats?.toss ?? 0}/A
                        {card.stats?.attack ?? 0}/B{card.stats?.block ?? 0}
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
                      className={`aspect-[3/2] bg-neutral-800 border-2 ${selectedCard?.id === card.id ? 'border-orange-500' : 'border-gray-700'} rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-colors group relative overflow-hidden`}
                      title="Click to view details"
                      style={{
                        backgroundImage: `url('${encodeURI(card.image)}')`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/20 transition-colors"></div>
                      <div className="relative z-10 text-[10px] font-bold text-white leading-tight">
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
              className={`text-xs md:text-sm font-mono font-bold ${
                builderDeck.length >= 40 ? "text-orange-500" : "text-gray-400"
              }`}
            >
              Total Cards: {builderDeck.length}/40
            </span>
          </div>

          <div className="flex-1 overflow-y-auto bg-black/50 border border-gray-800 rounded p-3 content-start scrollbar-minimalist">
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
                          key={`char-${card.id}-${index}`}
                          onClick={() => setSelectedCard(card)}
                          className={`w-14 md:w-16 aspect-[2/3] bg-neutral-800 border ${selectedCard?.id === card.id ? 'border-orange-500' : 'border-gray-600'} rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-1 text-center transition-colors relative overflow-hidden shrink-0`}
                          title="Click to view details"
                          style={{
                            backgroundImage: `url('${encodeURI(card.image)}')`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          <div className="absolute inset-0 bg-black/60 hover:bg-black/20 transition-colors"></div>
                          <div className="relative z-10 text-[8px] font-bold text-white leading-tight">
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
                          key={`event-${card.id}-${index}`}
                          onClick={() => setSelectedCard(card)}
                          className={`w-20 md:w-24 aspect-[3/2] bg-neutral-800 border ${selectedCard?.id === card.id ? 'border-orange-500' : 'border-gray-600'} rounded hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center p-1 text-center transition-colors relative overflow-hidden shrink-0`}
                          title="Click to view details"
                          style={{
                            backgroundImage: `url('${encodeURI(card.image)}')`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          <div className="absolute inset-0 bg-black/60 hover:bg-black/20 transition-colors"></div>
                          <div className="relative z-10 text-[8px] font-bold text-white leading-tight">
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
