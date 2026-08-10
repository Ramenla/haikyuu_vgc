import React from "react";
import { Screen, CustomDeck } from "../../types/game";
import { cardDatabase } from "../../data/cardDatabase";

interface DeckSelectionScreenProps {
  customDecks: CustomDeck[];
  selectedDeckType: string | null;
  onSelectDeck: (deck: string) => void;
  onStartGame: () => void;
  onNavigate: (screen: Screen) => void;
}

export const DeckSelectionScreen: React.FC<DeckSelectionScreenProps> = ({
  customDecks,
  selectedDeckType,
  onSelectDeck,
  onStartGame,
  onNavigate,
}) => {
  const getFirstCardImage = (deckId: string | null) => {
    if (!deckId) return null;
    
    // Check custom decks first
    const customDeck = customDecks.find(d => d.id === deckId);
    if (customDeck && customDeck.cards.length > 0) {
      const firstCardId = customDeck.cards[0];
      const card = cardDatabase.find(c => c.id === firstCardId);
      if (card) return card.image;
    }

    let prefix = "";
    if (deckId === "Karasuno Starter Deck") prefix = "HVD-01";
    else if (deckId === "Rivals Starter Deck") prefix = "HVD-02";
    else if (deckId === "Karasuno Evolves Explosively Starter Deck") prefix = "HVD-03";
    else if (deckId === "It's Seijō that Goes to Nationals Starter Deck") prefix = "HVD-04";
    else if (deckId === "Powerhouse!! Fukurodani Academy Group Starter Deck") prefix = "HVD-05";

    if (prefix) {
      const card = cardDatabase.find(c => c.id.startsWith(prefix));
      if (card) return card.image;
    }
    
    return "/assets/backCard_vgc.png";
  };
  
  const getDeckDisplayName = (deckId: string) => {
    const customDeck = customDecks.find(d => d.id === deckId);
    if (customDeck) return customDeck.name;
    return deckId;
  };

  const baseDecks = [
    "Karasuno Starter Deck", 
    "Rivals Starter Deck", 
    "Karasuno Evolves Explosively Starter Deck", 
    "It's Seijō that Goes to Nationals Starter Deck", 
    "Powerhouse!! Fukurodani Academy Group Starter Deck"
  ];
  
  const validCustomDecks = customDecks.filter(d => d.isValid).map(d => d.id);
  const decks = [...baseDecks, ...validCustomDecks];

  return (
    <div className="relative h-screen w-screen bg-black text-white flex flex-col items-center justify-center font-sans p-4 overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('/assets/PvE.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
      </div>
      <div className="z-10 flex flex-col items-center max-w-6xl w-full h-full mx-auto p-4 md:p-8">
        <h2 className="text-3xl md:text-5xl font-black mb-6 shrink-0 text-orange-500 tracking-wide text-center uppercase">
          Choose Your Deck
        </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-6 w-full overflow-y-auto flex-1 pr-2 custom-scrollbar">
        {decks.map(
          (deck) => (
            <div
              key={deck}
              onClick={() => onSelectDeck(deck)}
              className={`relative flex flex-col items-center cursor-pointer transition-all duration-300 rounded-xl p-2 border-2 ${
                selectedDeckType === deck
                  ? "border-orange-500 bg-orange-500/10 scale-105"
                  : "border-transparent hover:bg-neutral-900/60 hover:scale-[1.02]"
              }`}
            >
              <img 
                src={encodeURI(getFirstCardImage(deck) || "/assets/backCard_vgc.png")} 
                alt={deck} 
                className="w-full aspect-[63/88] object-contain rounded border border-gray-800 shadow-md mb-3"
              />
              <span className={`text-center text-[10px] md:text-xs font-bold leading-tight ${selectedDeckType === deck ? "text-orange-400" : "text-gray-400"}`}>
                {getDeckDisplayName(deck)}
              </span>
            </div>
          ),
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center shrink-0 mt-4">
        <button
          onClick={() => onNavigate("menu")}
          className="w-full sm:w-auto px-8 py-3 bg-neutral-800 border-2 border-gray-700 hover:border-gray-500 text-white font-bold uppercase tracking-widest transition-colors rounded"
        >
          Back to Menu
        </button>
        <button
          disabled={!selectedDeckType}
          onClick={onStartGame}
          className={`px-8 py-3 rounded font-black text-xl tracking-widest uppercase transition-colors ${
            selectedDeckType
              ? "bg-orange-600 border border-orange-500 hover:bg-orange-700 text-white cursor-pointer"
              : "bg-neutral-800 text-gray-600 cursor-not-allowed border border-gray-700"
          }`}
        >
          Start Battle
        </button>
      </div>
      </div>
    </div>
  );
};
