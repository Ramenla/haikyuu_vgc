import React, { useEffect, useRef, useState } from "react";
import { CardData, CardInstance } from "../../types/card";
import { Phase, Turn, PendingEffectCard, CalculatedPoints, Screen } from "../../types/game";
import { CardModal } from "../CardModal";

interface GameBoardScreenProps {
  playerDeck: CardInstance[];
  botDeck: CardInstance[];
  activeCards: CardInstance[];
  currentTurn: Turn;
  currentPhase: Phase;
  selectedCard: CardData | CardInstance | null;
  pendingEffectCard: PendingEffectCard | null;
  isDiscardingForEffect: boolean;
  gameLogs: string[];
  points: CalculatedPoints;
  isPlayValid: boolean;
  isDiscardingForEffectState: boolean;
  onSelectCard: (card: CardData | CardInstance | null) => void;
  onZoneClick: (zoneId: string) => void;
  onUseEffect: () => void;
  onNextPhase: () => void;
  onDeclareBreak: () => void;
  onNavigate: (screen: Screen) => void;
  isPlayableZone: (zoneId: string) => boolean;
  onActivateHandEffect: () => void;
  pendingChoice: any;
  isOpponentDisconnected?: boolean;
  playerName?: string;
  opponentName?: string;
  chatMessages: import('../../types/game').ChatMessage[];
  onSendMessage: (text: string) => void;
  matchWinner: Turn | null;
  onReturnToMenu: () => void;
}

export const GameBoardScreen: React.FC<GameBoardScreenProps> = ({
  playerDeck,
  botDeck,
  activeCards,
  currentTurn,
  currentPhase,
  selectedCard,
  pendingEffectCard,
  isDiscardingForEffect,
  gameLogs,
  points,
  isPlayValid,
  onSelectCard,
  onZoneClick,
  onUseEffect,
  onNextPhase,
  onDeclareBreak,
  onNavigate,
  isPlayableZone,
  onActivateHandEffect,
  pendingChoice,
  isOpponentDisconnected,
  playerName = "Player 1",
  opponentName = "Player 2",
  chatMessages,
  onSendMessage,
  matchWinner,
  onReturnToMenu
}) => {
  const isDefendingChoice = currentPhase === "Defense Choice Phase" && pendingChoice;
  const [isGameOverModalClosed, setIsGameOverModalClosed] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [activeMobileMenu, setActiveMobileMenu] = useState<"log" | "chat" | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [viewingDropZone, setViewingDropZone] = useState<"Player 1" | "Player 2" | null>(null);
  const mobileLogEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeMobileMenu]);

  useEffect(() => {
    if (activeMobileMenu === "log" && mobileLogEndRef.current) {
      mobileLogEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameLogs, activeMobileMenu]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameLogs]);

  const handleChatSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && chatInput.trim() !== '') {
      onSendMessage(chatInput);
      setChatInput("");
    }
  };

  const renderChatMessages = () => {
    if (chatMessages.length === 0) {
      return <div className="text-gray-600 text-center italic mt-2 text-[10px]">Belum ada pesan.</div>;
    }
    
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {chatMessages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === "Player 1" ? "items-end" : "items-start"}`}>
            <span className="text-[8px] text-gray-500">{msg.sender === "Player 1" ? playerName : opponentName}</span>
            <div className={`px-2 py-1 rounded-lg text-[10px] max-w-[90%] break-words ${msg.sender === "Player 1" ? "bg-blue-600 text-white rounded-br-none" : "bg-neutral-700 text-gray-200 rounded-bl-none"}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    );
  };

  // Render Indikator Fase (Flowchart)
  const renderPhaseIndicator = () => {
    let phases: string[] = [];
    if (currentPhase === "Serve Phase") {
      phases = ["Serve Phase", "End Phase"];
    } else if (currentPhase === "Block Phase") {
      phases = ["Start Phase", "Block Phase", "End Phase"];
    } else {
      phases = ["Start Phase", "Draw Phase", "Receive Phase", "Set Phase", "Attack Phase", "End Phase"];
    }

    const strokeColor = currentTurn === "Player 1" ? "blue" : "#e11d48"; // blue or rose-600
    // Show the actual player name for the current turn
    const turnDisplayName = currentTurn === "Player 1" ? playerName : opponentName;

    return (
      <div className="hidden md:flex w-[120px] h-full flex-col items-center justify-center shrink-0 p-2 gap-1 bg-neutral-900/40 border border-gray-800 rounded-lg">
        <div 
          className="text-white font-black text-center text-sm leading-tight mb-2 tracking-wide"
          style={{
            textShadow: `-1.5px -1.5px 0 ${strokeColor}, 1.5px -1.5px 0 ${strokeColor}, -1.5px 1.5px 0 ${strokeColor}, 1.5px 1.5px 0 ${strokeColor}`,
          }}
        >
          {turnDisplayName}
        </div>
        
        {phases.map((phase, index) => {
          // Map internal phase name to the flowchart text
          const mappedCurrentPhase = currentPhase === "Toss Phase" ? "Set Phase" : currentPhase;
          const isActive = !pendingChoice && phase === mappedCurrentPhase;

          return (
            <React.Fragment key={phase}>
              <div 
                className={`w-[100px] py-1.5 text-center rounded border-2 font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                  isActive 
                  ? 'bg-orange-500 border-orange-700 text-white  z-10 scale-105' 
                  : 'bg-black border-gray-800 text-gray-500'
                }`}
              >
                {phase}
              </div>
              {index < phases.length - 1 && (
                <div className={`text-[12px] -my-1 ${isActive ? 'text-orange-500' : 'text-gray-700'}`}>
                  ▼
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Render Mini Card untuk Game Board
  const renderMiniCard = (card: CardInstance, forceClickable = false) => {
    const isEvent = card.type === "Action";
    const isHandCardSelected = selectedCard && 'location' in selectedCard && (selectedCard as CardInstance).location === "hand";
    const shouldPassThrough = isHandCardSelected && card.location !== "hand" && card.location !== "bot_hand";

    return (
      <div
        key={card.instanceId}
        onClick={(e) => {
          if (shouldPassThrough) return; // Prevent selection if passing through
          e.stopPropagation();
          if (isDiscardingForEffect && card.location === "hand" && pendingEffectCard) {
            onSelectCard(card);
          } else {
            onSelectCard(card);
          }
        }}
        className={`${isEvent ? "w-[5.5rem] h-16" : "w-16 h-[5.5rem]"} bg-neutral-800 border-2 ${
          selectedCard &&
          "instanceId" in selectedCard &&
          (selectedCard as CardInstance).instanceId === card.instanceId
            ? "border-orange-500 scale-105 z-20"
            : card.isGuts && !forceClickable
            ? "border-gray-700 opacity-60 brightness-50"
            : card.isGuts && forceClickable
            ? "border-gray-700 opacity-60 brightness-50 cursor-pointer hover:border-orange-500"
            : "border-gray-400 hover:border-orange-500"
        } rounded flex flex-col ${
          !card.isGuts ? " z-10" : "z-0 shadow"
        } shrink-0 transition-colors bg-cover bg-center overflow-hidden ${shouldPassThrough ? "pointer-events-none" : "cursor-pointer"}`}
        style={{
          backgroundImage: `url('${encodeURI(card.image)}')`,
        }}
        title={card.name}
      />
    );
  };

  const renderZone = (
    zoneId: string,
    label: string,
    isBot = false,
    isBlock = false,
  ) => {
    const allCardsInZone = activeCards.filter((c) => c.location === zoneId);
    const activeCardsInZone = allCardsInZone.filter((c) => !c.isGuts);
    const gutsCardsInZone = allCardsInZone.filter((c) => c.isGuts);

    const isEmpty = allCardsInZone.length === 0;

    const isDefendingChoice = pendingChoice && typeof pendingChoice.title === 'string' && (
      pendingChoice.title.includes("Pilih Cara Bertahan") || 
      pendingChoice.title.includes("Bola Memantul")
    );

    const isBallHere = 
      (currentPhase === "Serve Phase" && zoneId === (currentTurn === "Player 1" ? "serve" : "bot_serve")) ||
      (currentPhase === "Receive Phase" && zoneId === (currentTurn === "Player 1" ? "receive" : "bot_receive")) ||
      (currentPhase === "Toss Phase" && zoneId === (currentTurn === "Player 1" ? "toss" : "bot_toss")) ||
      (currentPhase === "Attack Phase" && !isDefendingChoice && zoneId === (currentTurn === "Player 1" ? "attack" : "bot_attack")) ||
      (currentPhase === "Block Phase" && !isDefendingChoice && zoneId === (currentTurn === "Player 1" ? "block" : "bot_block")) ||
      (currentPhase === "Defense Choice Phase" && zoneId === (currentTurn === "Player 1" ? "block" : "bot_block")) ||
      (isDefendingChoice && zoneId === (currentTurn === "Player 1" ? "block" : "bot_block"));

    const content = (
      <div className="w-full h-full relative flex items-center justify-center">
        {isBallHere && (
          <img 
            src="/assets/voleyball.png" 
            alt="Volleyball" 
            className="absolute z-[100] w-9 h-9 object-contain animate-spin-slow pointer-events-none "
          />
        )}
        {gutsCardsInZone.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-black w-5 h-5 flex items-center justify-center rounded-full z-50  shadow-black/50 border-2 border-neutral-900 pointer-events-none">
            {gutsCardsInZone.length}
          </div>
        )}
        {gutsCardsInZone.map((card, i) => {
          const isTopGuts = i === gutsCardsInZone.length - 1 && activeCardsInZone.length === 0;
          return (
            <div
              key={card.instanceId}
              className={`absolute transition-all ${isTopGuts ? "" : "pointer-events-none"}`}
              style={{
                marginTop: `${(i + 1) * -8}px`,
                marginRight: `${(i + 1) * -8}px`,
                zIndex: i,
              }}
            >
              {renderMiniCard(card, isTopGuts)}
            </div>
          );
        })}
        
        {/* Tampilan Event bertumpuk (seperti guts) jika area ini adalah Event Area */}
        {zoneId.includes("action") && activeCardsInZone.map((card, i) => (
          <div
            key={card.instanceId}
            className="absolute transition-all"
            style={{
              marginTop: `${(gutsCardsInZone.length + i + 1) * -8}px`,
              marginRight: `${(gutsCardsInZone.length + i + 1) * -8}px`,
              zIndex: gutsCardsInZone.length + i + 10,
            }}
          >
            {renderMiniCard(card)}
          </div>
        ))}

        {/* Tampilan kartu aktif normal (berjajar) untuk area selain Event Area */}
        {!zoneId.includes("action") && (
          <div
            className="absolute flex gap-1 items-center justify-center w-full h-full"
            style={{ zIndex: gutsCardsInZone.length + 10 }}
          >
            {activeCardsInZone.map((c) => renderMiniCard(c))}
          </div>
        )}
        {isEmpty && (
          <span
            className="text-[9px] font-bold text-gray-500 leading-tight text-center"
            dangerouslySetInnerHTML={{ __html: label }}
          />
        )}
      </div>
    );

    if (isBot) {
      return (
        <div
          className={`${
            zoneId === "bot_action" ? "w-full" : "w-16"
          } h-[5.5rem] bg-neutral-800 border border-gray-700 rounded flex items-center justify-center text-[9px] font-bold text-gray-500 text-center leading-tight ${
            isBlock ? "w-full max-w-[480px]" : ""
          }`}
        >
          {content}
        </div>
      );
    }

    const playable = isPlayableZone(zoneId);
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onZoneClick(zoneId);
        }}
        className={`${
          isBlock ? "flex-1" : zoneId === "action" ? "w-full" : "w-16"
        } h-[5.5rem] rounded flex items-center justify-center text-[9px] font-bold text-center leading-tight transition-all border-2
          ${
            playable
              ? "border-orange-500 bg-orange-500/20  text-orange-400 animate-pulse"
              : "border-gray-700 bg-neutral-800/80 text-gray-400 hover:border-orange-500"
          } cursor-pointer
        `}
      >
        {content}
      </div>
    );
  };

  return (
    <div 
      onClick={() => onSelectCard(null)}
      className="h-screen w-screen bg-black text-gray-200 font-sans p-2 flex flex-col md:flex-row gap-2 overflow-hidden box-border"
    >
      {/* Panel Kiri: Detail Kartu Penuh */}
      
      <div className="hidden md:flex w-full md:w-auto h-auto md:h-full flex-shrink-0 flex-col order-last md:order-none z-[60] overflow-hidden md:overflow-visible">
        <CardModal
          selectedCard={selectedCard}
          pendingEffectCard={pendingEffectCard}
          isDiscardingForEffect={isDiscardingForEffect}
          isPlayValid={isPlayValid}
          currentTurn={currentTurn}
          currentPhase={currentPhase}
          onUseEffect={onUseEffect}
          onNextPhase={onNextPhase}
          onDeclareBreak={onDeclareBreak}
          onActivateHandEffect={onActivateHandEffect}
          pendingChoice={pendingChoice}
          activeCards={activeCards}
          onLeaveGame={() => onNavigate("menu")}
        />
      </div>

      {/* Indikator Fase */}
      {renderPhaseIndicator()}

      {/* Panel Tengah: Area Papan Permainan */}
      <div className="flex-1 flex flex-col gap-1.5 items-center justify-start overflow-y-auto overflow-x-hidden scrollbar-none w-full h-full relative pb-2 pt-1">
        {/* MOBILE TOP BAR */}
        <div className="md:hidden flex flex-col w-full max-w-[480px] gap-1 shrink-0 z-10 mt-1">
          {/* Row 1: Turn Phase Indicator */}
          <div className="bg-neutral-900 border-2 border-gray-700 rounded-sm py-1.5 px-2 text-center w-full shadow-md">
             <span className="font-black text-white text-[12px] uppercase tracking-wider">
               {currentTurn === "Player 1" ? "Giliranmu" : "Giliran Lawan"} - {currentPhase === "Toss Phase" ? "Set Phase" : currentPhase.replace(" Phase", "")}
             </span>
          </div>

          {/* Row 2: Stats & Hands */}
          <div className="flex gap-1 w-full">
             <div className="flex-1 bg-neutral-900 border-2 border-gray-700 rounded-sm py-1.5 px-2 flex justify-around items-center shadow-md">
                <div className="flex flex-col items-center">
                  <span className="text-[7px] text-gray-400 font-bold uppercase mb-0.5">Incoming</span>
                  <span className="text-[11px] font-black text-red-500 leading-none">{points.incomingAttack}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] text-gray-400 font-bold uppercase mb-0.5">Defense</span>
                  <span className="text-[11px] font-black text-blue-500 leading-none">{points.totalDefense}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] text-gray-400 font-bold uppercase mb-0.5">Attack</span>
                  <span className="text-[11px] font-black text-orange-500 leading-none">{points.outgoingAttack}</span>
                </div>
             </div>
             <div className="flex-1 bg-neutral-900 border-2 border-gray-700 rounded-sm py-1.5 px-2 flex justify-around items-center shadow-md">
                <div className="flex flex-col items-center">
                  <span className="text-[7px] text-gray-400 font-bold uppercase mb-0.5">P1 Hand</span>
                  <span className="text-[11px] font-black text-white leading-none">{activeCards.filter((c) => c.location === "hand").length}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] text-gray-400 font-bold uppercase mb-0.5">P2 Hand</span>
                  <span className="text-[11px] font-black text-white leading-none">{activeCards.filter((c) => c.location === "bot_hand").length}</span>
                </div>
             </div>
          </div>
        </div>
        {/* Scale wrapper for mobile */}
        <div className="transform scale-[0.65] sm:scale-[0.75] md:scale-100 flex flex-col gap-1.5 min-w-[480px] items-center justify-start origin-top -mb-[200px] sm:-mb-[140px] md:mb-0 mt-4 shrink-0">
        {/* Zona Lawan */}
        <div className="w-full max-w-[480px] flex-shrink-0 grid grid-cols-5 gap-1 transform rotate-180 bg-neutral-900/40 border border-gray-800 rounded-lg p-1.5 place-content-center place-items-center">
          <div className="row-span-2 flex flex-col gap-1 justify-center h-full">
            <div className="w-[5.5rem] h-16 bg-neutral-800 border border-gray-700 rounded flex flex-col items-center justify-center relative overflow-hidden">
              {activeCards.filter((card) => card.location === "bot_set").length >
              0 ? (
                <div className="w-[3.2rem] h-[4.5rem] border border-orange-500 rounded  overflow-hidden shrink-0 -rotate-90">
                  <img
                    src="/assets/backCard_vgc.png"
                    alt="Card Back"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <span className="text-[9px] font-bold text-gray-500 text-center leading-tight">
                  Set
                  <br />
                  Area
                </span>
              )}
            </div>
            <div className="w-[5.5rem] h-16 bg-neutral-800 border border-gray-700 rounded flex flex-col items-center justify-center relative overflow-hidden">
              {activeCards.filter((card) => card.location === "bot_set").length >
              1 ? (
                <div className="w-[3.2rem] h-[4.5rem] border border-orange-500 rounded  overflow-hidden shrink-0 -rotate-90">
                  <img
                    src="/assets/backCard_vgc.png"
                    alt="Card Back"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <span className="text-[9px] font-bold text-gray-500 text-center leading-tight">
                  Set
                  <br />
                  Area
                </span>
              )}
            </div>
          </div>

          {renderZone("bot_receive", "Receive<br/>area", true)}
          {renderZone("bot_toss", "Toss<br/>Area", true)}
          {renderZone("bot_attack", "Attack<br/>Area", true)}

          <div className="w-16 h-[5.5rem] bg-neutral-800 border border-gray-700 rounded flex items-center justify-center text-[9px] font-bold text-gray-500 text-center leading-tight relative overflow-hidden">
            {botDeck.length > 0 && (
              <img
                src="/assets/backCard_vgc.png"
                alt="Bot Deck"
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
            )}
            <span className="text-white text-xl z-10 font-black drop-">
              {botDeck.length}
            </span>
            <span className="absolute bottom-1 text-white opacity-80 font-bold drop- z-10">
              Deck
            </span>
          </div>

          {renderZone("bot_serve", "Serve<br/>Area", true)}
          <div className="col-span-2 w-full h-[5.5rem] bg-neutral-800 border border-gray-700 rounded flex flex-col items-center justify-center text-[9px] font-bold text-gray-500 text-center leading-tight relative overflow-hidden">
            {activeCards.filter((c) => c.location === "bot_action").length > 0 ? (
              renderZone("bot_action", "Event<br/>Area", true)
            ) : (
              <>Event<br />Area</>
            )}
          </div>
          <div 
            className="w-16 h-[5.5rem] bg-neutral-800 border border-gray-700 rounded flex items-center justify-center text-[9px] font-bold text-gray-500 text-center leading-tight relative overflow-hidden cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => setViewingDropZone("Player 2")}
          >
            {activeCards.filter((card) => card.location === "bot_drop").length >
            0 ? (
              <div className="w-full h-full relative">
                {activeCards
                  .filter((card) => card.location === "bot_drop")
                  .slice(-1)
                  .map((card) => (
                    <div
                      key={card.instanceId}
                      className="absolute inset-0 bg-cover bg-center opacity-60"
                      style={{
                        backgroundImage: `url('${encodeURI(card.image)}')`,
                      }}
                    />
                  ))}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-[10px] font-black text-white drop-">
                    DROP
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-[9px] font-bold text-gray-500 text-center leading-tight">
                Drop
                <br />
                Area
              </span>
            )}
          </div>
        </div>

        {/* Zona Tengah: Block Area Player 2 & Player 1 */}
        <div className="flex gap-2 w-full max-w-[480px] h-[5.5rem] shrink-0">
          {renderZone("block", "P1 BLOCK", false, true)}
          <div className="flex-1 rounded-lg flex items-center justify-center font-black tracking-widest text-sm transition-all border-gray-700 bg-neutral-800 text-gray-500 transform rotate-180">
            {renderZone("bot_block", "P2 BLOCK", true, true)}
          </div>
        </div>

        {/* Zona Pemain 1 */}
        <div className="w-full max-w-[480px] flex-shrink-0 grid grid-cols-5 gap-1 bg-neutral-900 border border-gray-800 rounded-lg p-1.5 place-content-center place-items-center">
          <div className="row-span-2 flex flex-col gap-1 justify-center h-full">
            <div className="w-[5.5rem] h-16 bg-neutral-800/80 border border-gray-700 rounded flex flex-col items-center justify-center relative overflow-hidden">
              {activeCards.filter((card) => card.location === "set").length >
              0 ? (
                <div className="w-[3.2rem] h-[4.5rem] border border-orange-500 rounded  overflow-hidden shrink-0 -rotate-90">
                  <img
                    src="/assets/backCard_vgc.png"
                    alt="Card Back"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <span className="text-[9px] font-bold text-gray-400 text-center leading-tight">
                  Set
                  <br />
                  Area
                </span>
              )}
            </div>
            <div className="w-[5.5rem] h-16 bg-neutral-800/80 border border-gray-700 rounded flex flex-col items-center justify-center relative overflow-hidden">
              {activeCards.filter((card) => card.location === "set").length >
              1 ? (
                <div className="w-[3.2rem] h-[4.5rem] border border-orange-500 rounded  overflow-hidden shrink-0 -rotate-90">
                  <img
                    src="/assets/backCard_vgc.png"
                    alt="Card Back"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <span className="text-[9px] font-bold text-gray-400 text-center leading-tight">
                  Set
                  <br />
                  Area
                </span>
              )}
            </div>
          </div>

          {renderZone("receive", "Receive<br/>area")}
          {renderZone("toss", "Toss<br/>Area")}
          {renderZone("attack", "Attack<br/>Area")}

          <div className="w-16 h-[5.5rem] bg-neutral-800/80 border border-gray-700 rounded flex items-center justify-center text-[9px] font-bold text-gray-400 text-center leading-tight relative overflow-hidden">
            {playerDeck.length > 0 && (
              <img
                src="/assets/backCard_vgc.png"
                alt="Player Deck"
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
            )}
            <span className="text-white text-xl z-10 font-black drop-">
              {playerDeck.length}
            </span>
            <span className="absolute bottom-1 text-white opacity-80 font-bold drop- z-10">
              Deck
            </span>
          </div>

          {renderZone("serve", "Serve<br/>Area")}

          <div className="col-span-2 w-full h-[5.5rem] bg-neutral-800/80 border border-gray-700 rounded flex items-center justify-center text-[9px] font-bold text-gray-400 text-center leading-tight relative">
            {renderZone("action", "Event<br/>Area")}
          </div>
          <div 
            className="w-16 h-[5.5rem] bg-neutral-800/80 border border-gray-700 rounded flex flex-col items-center justify-center relative overflow-hidden cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => setViewingDropZone("Player 1")}
          >
            {activeCards.filter((card) => card.location === "drop").length >
            0 ? (
              <div className="w-full h-full relative">
                {activeCards
                  .filter((card) => card.location === "drop")
                  .slice(-1)
                  .map((card) => (
                    <div
                      key={card.instanceId}
                      className="absolute inset-0 bg-cover bg-center opacity-60"
                      style={{
                        backgroundImage: `url('${encodeURI(card.image)}')`,
                      }}
                    />
                  ))}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-[10px] font-black text-white drop-">
                    DROP
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-[9px] font-bold text-gray-400 text-center leading-tight">
                Drop
                <br />
                Area
              </span>
            )}
          </div>
        </div>

        <div
          onClick={() => onZoneClick("hand")}
          className={`w-full max-w-[480px] h-[7rem] shrink-0 rounded-lg p-2 relative flex items-center justify-center gap-2 overflow-hidden transition-all border-2
            ${
              isDiscardingForEffect
                ? "border-red-500 bg-red-900/20  animate-pulse"
                : "border-gray-800 bg-neutral-900"
            } cursor-pointer
          `}
        >
          <span
            className={`absolute top-1.5 left-2 text-[9px] font-black uppercase tracking-widest pointer-events-none ${
              isDiscardingForEffect ? "text-red-500" : "text-gray-500"
            }`}
          >
            {isDiscardingForEffect ? "Pilih Kartu Untuk Dibuang" : "Hand Area"}
          </span>
          <div className="mt-4 flex flex-nowrap gap-2 h-[5.5rem] items-center justify-start w-full overflow-x-auto overflow-y-hidden px-1 pb-1 scrollbar-minimalist">
            {activeCards
              .filter((card) => card.location === "hand")
              .map(renderMiniCard)}
          </div>
        </div>
        </div>
        {/* MOBILE HORIZONTAL CARD MODAL */}
        <div className="md:hidden w-full max-w-[480px] shrink-0 mt-2">
          <CardModal
            selectedCard={selectedCard}
            pendingEffectCard={pendingEffectCard}
            isDiscardingForEffect={isDiscardingForEffect}
            isPlayValid={isPlayValid}
            currentTurn={currentTurn}
            currentPhase={currentPhase}
            onUseEffect={onUseEffect}
            onNextPhase={onNextPhase}
            onDeclareBreak={onDeclareBreak}
            onActivateHandEffect={onActivateHandEffect}
            pendingChoice={pendingChoice}
            activeCards={activeCards}
            onLeaveGame={() => onNavigate("menu")}
          />
        </div>

        {/* MOBILE LOG & CHAT BUTTONS */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="md:hidden flex w-full max-w-[480px] gap-2 mt-auto shrink-0 px-2 pb-2 relative"
        >
          <button 
            onClick={() => setActiveMobileMenu(prev => prev === "log" ? null : "log")}
            className="flex-1 bg-neutral-300 hover:bg-neutral-400 text-black font-bold py-1 px-2 text-[9px] rounded border-2 border-neutral-400 shadow-[0_0_10px_rgba(0,0,0,0.5)] flex justify-between items-center transition-colors z-[101]"
          >
            <span>Log Game</span>
            <span className="text-[9px]">{activeMobileMenu === "log" ? "▼" : "▲"}</span>
          </button>
          <button 
            onClick={() => setActiveMobileMenu(prev => prev === "chat" ? null : "chat")}
            className="flex-1 bg-neutral-300 hover:bg-neutral-400 text-black font-bold py-1 px-2 text-[9px] rounded border-2 border-neutral-400 shadow-[0_0_10px_rgba(0,0,0,0.5)] flex justify-between items-center transition-colors z-[101]"
          >
            <span>Chat</span>
            <span className="text-[9px]">{activeMobileMenu === "chat" ? "▼" : "▲"}</span>
          </button>

          {/* MOBILE DROP-UP CONTENT */}
          {activeMobileMenu && (
            <div className="absolute bottom-full left-2 right-2 mb-2 h-[200px] bg-neutral-900 border border-gray-700 rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden animate-slide-up">
              <div className="flex justify-between items-center bg-neutral-800 px-3 py-1.5 border-b border-gray-700">
                <span className="font-bold text-[10px] text-gray-300 uppercase tracking-wider">
                  {activeMobileMenu === "log" ? "Log Game" : "Chat Area"}
                </span>
                <button onClick={() => setActiveMobileMenu(null)} className="text-gray-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 scrollbar-minimalist bg-black/50">
                {activeMobileMenu === "log" && (
                  <div className="font-mono text-[9px] text-gray-400 leading-relaxed space-y-1">
                    {gameLogs.length === 0 ? (
                      <div className="text-gray-600">&gt; Menunggu pertandingan...</div>
                    ) : (
                      gameLogs.map((log, i) => (
                        <div key={i} className="border-b border-gray-800 pb-1">
                          &gt; {log}
                        </div>
                      ))
                    )}
                    <div ref={mobileLogEndRef} />
                  </div>
                )}
                
                {activeMobileMenu === "chat" && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto text-[10px] text-gray-400 p-1 scrollbar-minimalist">
                      {renderChatMessages()}
                    </div>
                    <div className="flex gap-1 mt-2 shrink-0 w-full">
                      <input
                        type="text"
                        placeholder="Ketik pesan..."
                        className="flex-1 bg-black border border-gray-700 rounded p-1.5 text-[10px] text-white focus:outline-none focus:border-orange-500 transition-colors"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleChatSubmit}
                      />
                      <button 
                        onClick={() => {
                          if (chatInput.trim() !== '') {
                            onSendMessage(chatInput);
                            setChatInput("");
                          }
                        }}
                        className="bg-orange-600 hover:bg-orange-500 text-white rounded px-3 py-1 text-[10px] font-bold"
                      >
                        Kirim
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay for Right Panel */}
      {/* Mobile overlay no longer used for Right Panel */}
      {/* Panel Kanan: Menu dan Indikator */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="hidden md:flex w-[200px] bg-neutral-900/95 md:bg-transparent flex-col gap-2 shrink-0 h-full p-2 md:p-0 rounded-lg md:rounded-none overflow-y-auto"
      >
        <button
          onClick={() => onNavigate("menu")}
          className="bg-neutral-800 border-2 border-gray-700 hover:border-orange-500 hover:text-orange-500 text-white font-bold py-2 px-3 rounded transition-colors text-xs shrink-0"
        >
          Leave Game
        </button>



        <div className="bg-neutral-900 border border-gray-800 rounded p-2 text-center flex flex-col items-center justify-center h-14 shadow-sm shrink-0">
          <span className="text-[10px] font-bold text-gray-400">
            Player 1 Hand
          </span>
          <span className="font-bold text-orange-500">
            {activeCards.filter((c) => c.location === "hand").length} Cards
          </span>
        </div>

        <div className="bg-neutral-900 border border-gray-800 rounded p-2 text-center flex flex-col items-center justify-center h-14 shadow-sm shrink-0">
          <span className="text-[10px] font-bold text-gray-400">
            Player 2 Hand
          </span>
          <span className="font-bold text-orange-500">
            {activeCards.filter((c) => c.location === "bot_hand").length} Cards
          </span>
        </div>

        <div className="flex-none bg-neutral-900 border-2 border-orange-500/50 rounded p-1.5 flex flex-col items-center justify-center  shrink-0 w-full overflow-hidden">
          <span className="text-[10px] font-bold text-orange-400 text-center uppercase tracking-wide truncate w-full">
            {currentTurn}
          </span>
          <div className="mt-1 text-center w-full">
            {currentPhase === "Serve Phase" ? (
              <>
                <span className="text-[8px] text-gray-400 uppercase tracking-widest block">
                  Serve Power
                </span>
                <span className="text-lg font-black text-orange-500">
                  {points.outgoingAttack}
                </span>
              </>
            ) : (
              <div className="flex flex-col gap-0.5 w-full mt-1">
                <div className="flex items-center justify-between bg-black/40 rounded px-1.5 py-0.5 border border-red-900/50 overflow-hidden">
                  <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest truncate">
                    Incoming
                  </span>
                  <span className="text-xs font-black text-red-500 leading-none ml-1">
                    {points.incomingAttack}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-black/40 rounded px-1.5 py-0.5 border border-blue-900/50 overflow-hidden">
                  <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest truncate">
                    Defense
                  </span>
                  <span className="text-xs font-black text-blue-400 leading-none ml-1">
                    {points.totalDefense}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-black/40 rounded px-1.5 py-0.5 border border-orange-900/50 overflow-hidden">
                  <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest truncate">
                    Attack
                  </span>
                  <span className="text-xs font-black text-orange-500 leading-none ml-1">
                    {points.outgoingAttack}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-[1.5] min-h-0 bg-neutral-900 border border-gray-800 rounded p-2 flex flex-col text-sm text-gray-400">
          <span className="font-bold text-gray-300 mb-1.5 border-b border-gray-700 pb-1 text-[10px] uppercase tracking-wider shrink-0">
            Log game
          </span>
          <div className="overflow-y-auto flex-1 font-mono text-[9px] text-gray-400 leading-relaxed space-y-1 scrollbar-minimalist">
            {gameLogs.length === 0 ? (
              <div className="text-gray-600">&gt; Menunggu pertandingan...</div>
            ) : (
              gameLogs.map((log, i) => (
                <div key={i} className="border-b border-gray-800 pb-1">
                  &gt; {log}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="flex-[1.5] min-h-0 bg-neutral-900 border border-gray-800 rounded p-2 flex flex-col text-sm text-gray-400">
          <span className="font-bold text-gray-300 mb-1.5 border-b border-gray-700 pb-1 text-[10px] uppercase tracking-wider shrink-0">
            Chat Area
          </span>
          <div className="overflow-y-auto flex-1 scrollbar-minimalist p-1">
            {renderChatMessages()}
          </div>
          <div className="flex gap-1 mt-1.5 shrink-0 w-full">
            <input
              type="text"
              placeholder="Ketik pesan..."
              className="flex-1 bg-black border border-gray-700 rounded p-1.5 text-[9px] text-white focus:outline-none focus:border-orange-500 transition-colors"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatSubmit}
            />
            <button 
              onClick={() => {
                if (chatInput.trim() !== '') {
                  onSendMessage(chatInput);
                  setChatInput("");
                }
              }}
              className="bg-orange-600 hover:bg-orange-500 text-white rounded px-2 py-1 text-[9px] font-bold"
            >
              Kirim
            </button>
          </div>
        </div>
      </div>
      {/* Opponent Disconnected Overlay */}
      {isOpponentDisconnected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-neutral-900 border border-orange-500 rounded-lg p-8 max-w-md w-full flex flex-col items-center justify-center shadow-2xl animate-pulse">
            <div className="text-orange-500 mb-4 animate-spin">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white mb-2 text-center tracking-tight">KONEKSI LAWAN TERPUTUS</h2>
            <p className="text-gray-400 text-center font-medium">
              Menunggu lawan untuk menyambung kembali... (Batas Waktu: 60 Detik)
            </p>
          </div>
        </div>
      )}
      {/* Mobile Floating Buttons removed */}

      {/* Match Winner Modal */}
      {viewingDropZone && (
        <div 
          className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300 p-4"
          onClick={() => setViewingDropZone(null)}
        >
          <div 
            className="bg-neutral-900 border-2 border-gray-700 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3 border-b border-gray-800 bg-neutral-800 rounded-t-lg">
              <h2 className="text-white font-bold tracking-widest uppercase">
                Drop Area - {viewingDropZone === "Player 1" ? playerName : opponentName} 
              </h2>
              <button 
                onClick={() => setViewingDropZone(null)}
                className="text-gray-400 hover:text-white bg-black/30 hover:bg-black/60 rounded px-3 py-1 font-bold"
              >
                X
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 scrollbar-minimalist">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {activeCards
                  .filter(c => c.location === (viewingDropZone === "Player 1" ? "drop" : "bot_drop"))
                  .map((card, idx) => (
                    <div key={card.instanceId} className="relative group flex flex-col items-center">
                      <div className="w-full aspect-[2/3] border border-gray-700 rounded relative overflow-hidden bg-black hover:border-orange-500 transition-colors cursor-pointer" onClick={() => onSelectCard(card)}>
                        <img 
                          src={encodeURI(card.image)} 
                          alt={card.name} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 left-1 bg-black/80 border border-gray-600 text-white text-[8px] px-1 rounded">
                          {idx + 1}
                        </div>
                      </div>
                    </div>
                ))}
                {activeCards.filter(c => c.location === (viewingDropZone === "Player 1" ? "drop" : "bot_drop")).length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-10 italic">
                    Drop Area Kosong
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {matchWinner && !isGameOverModalClosed && (
        <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-neutral-900 border-2 border-orange-500 rounded-xl p-8 max-w-sm w-full flex flex-col items-center shadow-[0_0_50px_rgba(249,115,22,0.3)] animate-pop-in">
            <h2 className="text-3xl font-black mb-2 tracking-tight text-center">
              {matchWinner === "Player 1" ? (
                <span className="text-blue-500 uppercase">VICTORY</span>
              ) : (
                <span className="text-red-500 uppercase">DEFEAT</span>
              )}
            </h2>
            <div className="text-gray-300 text-center text-sm mb-6 font-medium">
              {matchWinner === "Player 1" ? "Kamu memenangkan pertandingan!" : "Kamu kalah dalam pertandingan ini."}
            </div>
            
            <div className="flex w-full gap-3">
              <button 
                onClick={() => setIsGameOverModalClosed(true)}
                className="flex-1 border-2 border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-bold py-2 px-4 rounded transition-colors text-sm"
              >
                Lihat Papan
              </button>
              <button 
                onClick={onReturnToMenu}
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
