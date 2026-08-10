import React from "react";
import { CardData, CardInstance } from "../types/card";
import { PendingEffectCard, Phase } from "../types/game";

interface CardModalProps {
  selectedCard: CardData | CardInstance | null;
  pendingEffectCard: PendingEffectCard | null;
  isDiscardingForEffect: boolean;
  isPlayValid: boolean;
  currentTurn: string;
  currentPhase?: Phase;
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
    <div className="w-full md:w-[185px] bg-neutral-900 border border-gray-800 rounded-lg p-1.5 md:p-2 flex flex-row md:flex-col justify-start shrink-0 md:h-full overflow-hidden shadow-xl box-border gap-1.5 md:gap-2 h-[155px] md:h-auto">
      {selectedCard ? (
        <div className="w-[85px] md:w-full aspect-[2/3] max-h-[140px] md:max-h-none bg-black rounded border border-gray-700 overflow-hidden relative group shrink-0">
          <img
            src={encodeURI(selectedCard.image)}
            alt={selectedCard.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-1 left-1 text-[8px] bg-black/80 text-white px-1.5 py-0.5 rounded border border-gray-700">
            {selectedCard.type}
          </span>
        </div>
      ) : (
        <div className="hidden md:flex aspect-[2/3] w-full items-center justify-center text-center p-4 border border-dashed border-gray-700 rounded mb-2 shrink-0">
          <p className="text-[10px] text-gray-500 font-bold leading-relaxed uppercase tracking-wider">
            Pilih kartu
          </p>
        </div>
      )}

      {selectedCard ? (
        <div className="flex-1 flex flex-row md:flex-col gap-1.5 md:gap-0 min-w-0">
          
          {/* MOBILE: Name & Stats | DESKTOP: Name */}
          <div className="flex flex-col md:text-center shrink-0 md:mt-2 w-[70px] md:w-auto">
            <h2 className="text-white font-bold text-[11px] md:text-sm leading-tight truncate md:whitespace-normal">
              {selectedCard.name}
            </h2>
            <p className="text-gray-400 text-[8px] md:text-[9px] font-mono mt-0.5 mb-0.5 hidden md:block">
              {selectedCard.id}
            </p>
            
            {/* Desktop Badges */}
            {selectedCard.type !== "Action" && (
              <div className="flex flex-wrap justify-start md:justify-center gap-0.5 md:gap-1 mt-0.5 md:mt-1">
                {selectedCard.school && <span className="text-[6px] md:text-[8px] bg-blue-900/50 text-blue-300 border border-blue-700 px-1.5 py-0.5 rounded">{selectedCard.school}</span>}
                {selectedCard.year && <span className="text-[6px] md:text-[8px] bg-green-900/50 text-green-300 border border-green-700 px-1.5 py-0.5 rounded">{selectedCard.year}</span>}
                {selectedCard.position && <span className="text-[6px] md:text-[8px] bg-purple-900/50 text-purple-300 border border-purple-700 px-1.5 py-0.5 rounded">{selectedCard.position}</span>}
              </div>
            )}

            {/* Stats Block (Inline on mobile, below badges on desktop) */}
            {selectedCard.type !== "Action" && selectedCard.stats && (
              <div className="mt-1 md:mt-2 shrink-0 w-full">
                <div className="flex flex-col md:flex-row md:justify-between gap-0.5 md:gap-0">
                  <div className="border border-gray-700 md:border-transparent bg-black md:bg-transparent rounded p-0.5 md:p-0 flex justify-between md:flex-col items-center px-1 md:px-0">
                    <span className="text-[7px] md:text-[9px] text-gray-400 font-bold">receive</span>
                    <span className="text-[9px] md:text-sm font-bold text-white">{selectedCard.stats.receive}</span>
                  </div>
                  <div className="border border-gray-700 md:border-transparent bg-black md:bg-transparent rounded p-0.5 md:p-0 flex justify-between md:flex-col items-center px-1 md:px-0">
                    <span className="text-[7px] md:text-[9px] text-gray-400 font-bold">toss</span>
                    <span className="text-[9px] md:text-sm font-bold text-white">{selectedCard.stats.toss}</span>
                  </div>
                  <div className="border border-gray-700 md:border-transparent bg-black md:bg-transparent rounded p-0.5 md:p-0 flex justify-between md:flex-col items-center px-1 md:px-0">
                    <span className="text-[7px] md:text-[9px] text-gray-400 font-bold">attack</span>
                    <span className="text-[9px] md:text-sm font-bold text-white">{selectedCard.stats.attack}</span>
                  </div>
                  <div className="border border-gray-700 md:border-transparent bg-black md:bg-transparent rounded p-0.5 md:p-0 flex justify-between md:flex-col items-center px-1 md:px-0">
                    <span className="text-[7px] md:text-[9px] text-gray-400 font-bold">Block</span>
                    <span className="text-[9px] md:text-sm font-bold text-white">{selectedCard.stats.block}</span>
                  </div>
                  <div className="border border-gray-700 md:border-transparent bg-black md:bg-transparent rounded p-0.5 md:p-0 flex justify-between md:flex-col items-center px-1 md:px-0">
                    <span className="text-[7px] md:text-[9px] text-gray-400 font-bold">Serve</span>
                    <span className="text-[9px] md:text-sm font-bold text-white">{selectedCard.stats.serve}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Effect Block */}
          <div className="flex-1 bg-neutral-800 border border-gray-700 rounded p-1 md:p-1.5 md:mt-2 flex flex-col shrink-0 overflow-hidden">
            <span className="text-[8px] md:text-[9px] font-bold text-gray-500 text-center uppercase tracking-widest block mb-0.5 border-b border-gray-700 pb-0.5 shrink-0">
              Efek Kartu
            </span>
            <p className="text-[8px] md:text-[10px] text-gray-300 leading-[1.1] italic overflow-y-auto pr-1 flex-1 scrollbar-minimalist text-left">
              {selectedCard.effect || "-"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="w-[85px] md:w-auto flex flex-col gap-1 md:gap-1.5 justify-center md:justify-start md:mt-2 shrink-0">
            {(() => {
              if (pendingChoice) {
                return (
                  <div className="w-full flex flex-col gap-1 pt-1 border-t border-gray-700">
                    <div className="text-[8px] md:text-[10px] font-bold text-orange-400 mb-0.5 text-center leading-tight">
                      {pendingChoice.title}
                    </div>
                    {pendingChoice.options.map((opt: any, idx: number) => (
                      <button key={idx} onClick={opt.action} className="w-full py-1 px-1 rounded font-bold text-[8px] md:text-xs tracking-wider transition-all shadow-lg bg-red-600 hover:bg-red-500 text-white border border-red-500">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                );
              }

              // Normal action buttons
              const buttons = [];

              // 1. Phase action (End phase / Play Card)
              buttons.push(
                <button
                  key="phase"
                  onClick={onNextPhase}
                  disabled={!isPlayValid}
                  className={`w-full py-1.5 md:py-2 px-1 rounded font-bold text-[8px] md:text-xs uppercase tracking-wider transition-all ${
                    isPlayValid ? "bg-orange-600 hover:bg-orange-500 text-white border border-orange-500" : "bg-neutral-800 text-gray-600 border border-gray-700 cursor-not-allowed"
                  }`}
                >
                  {currentTurn === "Player 1" ? (isPlayValid ? "Selesaikan Fase" : "Mainkan") : "Tunggu"}
                </button>
              );

              // 2. Use Effect / Cancel
              if (isDiscardingForEffect) {
                buttons.push(
                  <button key="cancel" onClick={onUseEffect} className="w-full py-1.5 md:py-2 px-1 rounded font-bold text-[8px] md:text-xs uppercase tracking-wider transition-all bg-neutral-700 hover:bg-red-600 text-gray-300 hover:text-white border border-gray-600">
                    Batal
                  </button>
                );
              } else {
                const isHandEffect = selectedCard.location === "hand" && selectedCard.effectTrigger === "onHandActivate";
                const isBoardEffectActive = selectedCard.isEffectActive === true;
                let isCorrectZone = false;
                if (selectedCard.effectTrigger) {
                  if (selectedCard.effectTrigger === "onPlayAny") isCorrectZone = true;
                  else if (selectedCard.effectTrigger === "onPlayReceiveOrToss") isCorrectZone = selectedCard.location.includes("receive") || selectedCard.location.includes("toss");
                  else {
                    const triggerMap: Record<string, string> = { "onPlayAttack": "attack", "onPlayBlock": "block", "onPlayToss": "toss", "onPlayServe": "serve", "onPlayReceive": "receive", "onPlayEvent": "action" };
                    isCorrectZone = triggerMap[selectedCard.effectTrigger] ? selectedCard.location.includes(triggerMap[selectedCard.effectTrigger]) : false;
                  }
                }
                if (selectedCard.phaseRestriction && selectedCard.location.includes("action")) isCorrectZone = true;

                if (isHandEffect || (isBoardEffectActive && isCorrectZone)) {
                  buttons.push(
                    <button key="effect" onClick={isHandEffect ? onActivateHandEffect : onUseEffect} className="w-full py-1.5 md:py-2 px-1 rounded font-bold text-[8px] md:text-xs uppercase tracking-wider transition-all bg-blue-600 hover:bg-blue-500 text-white border border-blue-500">
                      Gunakan Efek
                    </button>
                  );
                }
              }

              // 3. Declare Break
              buttons.push(
                <button
                  key="break"
                  onClick={onDeclareBreak}
                  disabled={currentTurn !== "Player 1"}
                  className={`w-full py-1.5 md:py-2 px-1 rounded font-bold text-[8px] md:text-xs uppercase tracking-wider transition-all ${
                    currentTurn === "Player 1" ? "bg-white hover:bg-gray-200 text-black border border-gray-300" : "bg-neutral-800 text-gray-600 border border-gray-700 cursor-not-allowed"
                  }`}
                >
                  Break
                </button>
              );

              return buttons;
            })()}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center text-center p-2 md:hidden">
          <p className="text-[10px] text-gray-500 font-bold leading-relaxed uppercase tracking-wider">
            Pilih kartu untuk melihat detail
          </p>
        </div>
      )}

      {/* Action buttons when NO card is selected (still need to be able to pass turn / break) */}
      {!selectedCard && !pendingChoice && (
        <div className="flex flex-col justify-center w-[85px] md:w-full gap-1 md:mt-2 shrink-0">
          <button
            onClick={onNextPhase}
            disabled={!isPlayValid}
            className={`w-full py-1.5 md:py-2 px-1 rounded font-bold text-[8px] md:text-xs uppercase tracking-wider transition-all ${
              isPlayValid ? "bg-orange-600 hover:bg-orange-500 text-white border border-orange-500" : "bg-neutral-800 text-gray-600 border border-gray-700 cursor-not-allowed"
            }`}
          >
            {currentTurn === "Player 1" ? (isPlayValid ? "Selesaikan Fase" : "Mainkan") : "Tunggu"}
          </button>
          <button
            onClick={onDeclareBreak}
            disabled={currentTurn !== "Player 1"}
            className={`w-full py-1.5 md:py-2 px-1 rounded font-bold text-[8px] md:text-xs uppercase tracking-wider transition-all ${
              currentTurn === "Player 1" ? "bg-white hover:bg-gray-200 text-black border border-gray-300" : "bg-neutral-800 text-gray-600 border border-gray-700 cursor-not-allowed"
            }`}
          >
            Break
          </button>
        </div>
      )}
    </div>
  );
};
