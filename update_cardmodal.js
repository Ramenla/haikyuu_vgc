const fs = require('fs');
const content = \import React from 'react';
import { CardData, CardInstance } from '../../types/card';

interface CardModalProps {
  selectedCard: CardData | CardInstance | null;
  pendingEffectCard: any | null;
  isDiscardingForEffect: boolean;
  isPlayValid: boolean;
  currentTurn: string;
  currentPhase: string;
  onUseEffect: () => void;
  onNextPhase: () => void;
  onDeclareBreak: () => void;
  onActivateHandEffect: () => void;
  pendingChoice?: any;
}

export const CardModal: React.FC<CardModalProps> = ({
  selectedCard,
  pendingEffectCard,
  isDiscardingForEffect,
  isPlayValid,
  currentTurn,
  currentPhase,
  onUseEffect,
  onNextPhase,
  onDeclareBreak,
  onActivateHandEffect,
  pendingChoice,
}) => {
  return (
    <div className="w-[185px] bg-neutral-900 border border-gray-800 rounded-lg p-2 flex flex-col justify-start shrink-0 h-full overflow-hidden shadow-xl box-border">
      {selectedCard ? (
        <>
          <div className="w-full aspect-[2/3] max-h-[165px] bg-black rounded border border-gray-700 overflow-hidden relative group shrink-0">
            <img
              src={encodeURI(selectedCard.image)}
              alt={selectedCard.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute top-1 left-1 text-[8px] bg-black/80 text-white px-1.5 py-0.5 rounded border border-gray-700">
              {selectedCard.type}
            </span>
          </div>

          <div className="text-center mt-2 shrink-0">
            <h2 className="text-white font-bold text-sm leading-tight">
              {selectedCard.name}
            </h2>
            <p className="text-gray-400 text-[9px] font-mono mt-0.5 mb-1">
              {selectedCard.id}
            </p>

            {selectedCard.type !== 'Action' && (
              <div className="flex flex-wrap justify-center gap-1 mt-1">
                {selectedCard.school && <span className="text-[8px] bg-blue-900/50 text-blue-300 border border-blue-700 px-1.5 py-0.5 rounded">{selectedCard.school}</span>}
                {selectedCard.year && <span className="text-[8px] bg-green-900/50 text-green-300 border border-green-700 px-1.5 py-0.5 rounded">{selectedCard.year}</span>}
                {selectedCard.position && <span className="text-[8px] bg-purple-900/50 text-purple-300 border border-purple-700 px-1.5 py-0.5 rounded">{selectedCard.position}</span>}
              </div>
            )}

            {selectedCard.type !== 'Action' && selectedCard.stats && (
              <div className="flex justify-between mt-2">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-400 font-bold">receive</span>
                  <span className="text-sm font-bold text-white">{selectedCard.stats.receive}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-400 font-bold">toss</span>
                  <span className="text-sm font-bold text-white">{selectedCard.stats.toss}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-400 font-bold">attack</span>
                  <span className="text-sm font-bold text-white">{selectedCard.stats.attack}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-400 font-bold">Block</span>
                  <span className="text-sm font-bold text-white">{selectedCard.stats.block}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-400 font-bold">Serve</span>
                  <span className="text-sm font-bold text-white">{selectedCard.stats.serve}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 bg-neutral-800 border border-gray-700 rounded p-1.5 mt-2 flex flex-col shrink-0 overflow-hidden">
            <span className="text-[9px] font-bold text-gray-500 text-center uppercase tracking-widest block mb-0.5 border-b border-gray-700 pb-0.5 shrink-0">
              Efek Kartu
            </span>
            <p className="text-[10px] text-gray-300 leading-[1.1] italic overflow-y-auto pr-1 flex-1 scrollbar-minimalist text-left">
              {selectedCard.effect || '-'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 mt-2 shrink-0">
            {(() => {
              if (pendingChoice) {
                return (
                  <div className="w-full flex flex-col gap-1 pt-1 border-t border-gray-700">
                    <div className="text-[10px] font-bold text-orange-400 mb-0.5 text-center leading-tight">
                      {pendingChoice.title}
                    </div>
                    {pendingChoice.options.map((opt: any, idx: number) => (
                      <button key={idx} onClick={opt.action} className="w-full py-1 px-1 rounded font-bold text-xs tracking-wider transition-all shadow-lg bg-red-600 hover:bg-red-500 text-white border border-red-500">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                );
              }

              const buttons = [];

              buttons.push(
                <button
                  key="phase"
                  onClick={onNextPhase}
                  disabled={!isPlayValid}
                  className={\w-full py-2 px-1 rounded font-bold text-xs uppercase tracking-wider transition-all \\}
                >
                  {currentTurn === 'Player 1' ? (isPlayValid ? 'Selesaikan Fase' : 'Mainkan') : 'Tunggu'}
                </button>
              );

              if (isDiscardingForEffect) {
                buttons.push(
                  <button
                    key="use_effect"
                    onClick={onUseEffect}
                    disabled={!pendingEffectCard}
                    className={\w-full py-2 px-1 rounded font-bold text-xs uppercase tracking-wider transition-all \\}
                  >
                    Batal Efek
                  </button>
                );
              } else {
                if (currentPhase === 'Start Phase' || currentPhase === 'Receive Phase' || currentPhase === 'Set Phase' || currentPhase === 'Attack Phase' || currentPhase === 'Block Phase') {
                  if (selectedCard && selectedCard.type === 'Action' && 'location' in selectedCard && selectedCard.location === 'hand') {
                    buttons.push(
                      <button
                        key="use_effect"
                        onClick={onActivateHandEffect}
                        disabled={currentTurn !== 'Player 1'}
                        className={\w-full py-2 px-1 rounded font-bold text-xs uppercase tracking-wider transition-all shadow-lg \\}
                      >
                        Pakai Efek
                      </button>
                    );
                  }
                }
              }

              if (currentPhase === 'Start Phase') {
                buttons.push(
                  <button
                    key="break"
                    onClick={onDeclareBreak}
                    disabled={currentTurn !== 'Player 1'}
                    className={\w-full py-2 px-1 rounded font-bold text-xs uppercase tracking-wider transition-all \\}
                  >
                    Break
                  </button>
                );
              }

              return buttons;
            })()}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-4 border border-dashed border-gray-700 rounded mb-2 shrink-0">
          <p className="text-[10px] text-gray-500 font-bold leading-relaxed uppercase tracking-wider">
            Pilih kartu untuk melihat detail
          </p>
        </div>
      )}
    </div>
  );
};
\;
fs.writeFileSync('src/components/CardModal.tsx', content);
