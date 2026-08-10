import React from 'react';
import { CardInstance } from '../types/card';

interface CardSelectionModalProps {
  title: string;
  cards: CardInstance[];
  onSelect: (card: CardInstance) => void;
  onCancel: () => void;
}

const CardSelectionModal: React.FC<CardSelectionModalProps> = ({ title, cards, onSelect, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border-2 border-orange-500 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[0_0_30px_rgba(249,115,22,0.3)]">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-orange-500 uppercase tracking-wider">{title}</h2>
          <button 
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-gray-500 text-lg italic">Tidak ada kartu yang tersedia untuk dipilih.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {cards.map((card) => (
                <div 
                  key={card.instanceId}
                  onClick={() => onSelect(card)}
                  className="group relative cursor-pointer transition-transform hover:-translate-y-2 hover:scale-105"
                >
                  <div 
                    className="w-full aspect-[63/88] rounded-md bg-cover bg-center border-2 border-transparent group-hover:border-orange-500 shadow-lg group-hover:shadow-[0_0_15px_rgba(249,115,22,0.8)]"
                    style={{ backgroundImage: `url('${encodeURI(card.image)}')` }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                    <span className="text-white font-bold text-sm tracking-wider">PILIH</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-6 flex justify-end pt-4 border-t border-gray-800">
          <button 
            onClick={onCancel}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-bold rounded transition-colors uppercase tracking-wider text-sm border border-gray-700"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default CardSelectionModal;
