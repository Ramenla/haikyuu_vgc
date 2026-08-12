import React, { useState } from 'react';
import { CardInstance } from '../types/card';

interface CardSelectionModalProps {
  title: string;
  cards: CardInstance[];
  onSelect: (card: CardInstance) => void;
  onCancel: () => void;
}

const CardSelectionModal: React.FC<CardSelectionModalProps> = ({ title, cards, onSelect, onCancel }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-6 right-6 z-[200] bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-full shadow-2xl border-2 border-orange-400 cursor-pointer flex items-center gap-2 transition-all transform hover:scale-105"
        onClick={() => setIsMinimized(false)}
      >
        <span className="animate-pulse">Buka Pop-up Pemilihan Kartu ({cards.length})</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border-2 border-gray-700 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative">
        
        <div className="flex justify-between items-center p-3 border-b border-gray-800 bg-neutral-800 rounded-t-lg shrink-0">
          <h2 className="text-white font-bold tracking-widest uppercase text-sm md:text-base">{title}</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsMinimized(true)}
              className="text-gray-400 hover:text-white transition-colors bg-black/30 hover:bg-black/60 rounded px-3 py-1 font-bold text-sm"
              title="Minimize"
            >
              _
            </button>
            <button 
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors bg-black/30 hover:bg-black/60 rounded px-3 py-1 font-bold text-sm"
              title="Tutup"
            >
              X
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-gray-500 text-lg italic">Tidak ada kartu yang tersedia untuk dipilih.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 scrollbar-minimalist">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {cards.map((card) => (
                <div 
                  key={card.instanceId}
                  onClick={() => onSelect(card)}
                  className="group relative flex flex-col items-center cursor-pointer transition-transform hover:-translate-y-1 hover:scale-[1.02]"
                >
                  <div 
                    className="w-full aspect-[63/88] rounded-md bg-cover bg-center border border-gray-700 group-hover:border-orange-500 shadow-lg group-hover:shadow-[0_0_15px_rgba(249,115,22,0.8)]"
                    style={{ backgroundImage: `url('${encodeURI(card.image)}')` }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center pointer-events-none">
                    <span className="text-white font-bold text-sm tracking-wider">PILIH</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardSelectionModal;
