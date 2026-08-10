import React from "react";
import { Screen } from "../../types/game";

interface MenuScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ onNavigate }) => {
  return (
    <div className="relative h-screen w-screen text-white flex flex-col items-center justify-center font-sans p-4 overflow-hidden">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('/assets/haikyuu_bg.jpeg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/70"></div>
      </div>

      <div className="z-10 flex flex-col items-center max-w-sm w-full mx-auto p-8 rounded-xl bg-black/60 border border-gray-800">
        <h1 className="text-5xl md:text-7xl font-black mb-12 text-orange-500 tracking-tighter text-center">
          HAIKYUU VCG
        </h1>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={() => onNavigate("deck-selection")}
            className="w-full py-4 bg-black border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black font-bold text-xl uppercase tracking-widest transition-colors rounded shadow-sm"
          >
            PvE Match
          </button>
          <button 
            onClick={() => onNavigate("online-lobby")}
            className="w-full py-4 bg-orange-600 text-white hover:bg-orange-700 font-black text-xl uppercase tracking-widest transition-colors rounded shadow-sm"
          >
            PvP Match
          </button>
          <button
            onClick={() => onNavigate("deck-builder")}
            className="w-full py-4 bg-black border-2 border-gray-600 text-gray-300 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/10 font-bold text-xl uppercase tracking-widest transition-all rounded"
          >
            Deck Builder
          </button>
        </div>
      </div>
    </div>
  );
};
