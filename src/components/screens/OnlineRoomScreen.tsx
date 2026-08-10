import React, { useState, useEffect } from "react";
import { Screen, CustomDeck } from "../../types/game";
import { cardDatabase } from "../../data/cardDatabase";
import { socket } from "../../network/socket";

interface OnlineRoomScreenProps {
  customDecks: CustomDeck[];
  onNavigate: (screen: Screen) => void;
  playerName: string;
  roomCode: string;
  onReady: (deckId: string, opponentDeckId: string | null) => void;
  onOpponentNameChange?: (name: string) => void;
}

export const OnlineRoomScreen: React.FC<OnlineRoomScreenProps> = ({
  customDecks,
  onNavigate,
  playerName,
  roomCode,
  onReady,
  onOpponentNameChange,
}) => {
  const [isReady, setIsReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const baseDecks = [
    "Karasuno Starter Deck", 
    "Rivals Starter Deck", 
    "Karasuno Evolves Explosively Starter Deck", 
    "It's Seijō that Goes to Nationals Starter Deck", 
    "Powerhouse!! Fukurodani Academy Group Starter Deck"
  ];
  
  const validCustomDecks = customDecks.filter(d => d.isValid).map(d => d.id);
  const availableDecks = [...baseDecks, ...validCustomDecks];
  
  const getDeckDisplayName = (deckId: string) => {
    const customDeck = customDecks.find(d => d.id === deckId);
    if (customDeck) return customDeck.name;
    return deckId;
  };
  const [selectedDeckId, setSelectedDeckId] = useState<string>(availableDecks[0]);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [opponentSelectedDeckId, setOpponentSelectedDeckId] = useState<string | null>(null);

  useEffect(() => {
    // Notify server of our initial deck
    socket.emit('updateDeck', { roomCode, deckId: selectedDeckId });
    
    // Request full state on mount
    socket.emit('requestRoomState', roomCode);

    // Listeners
    socket.on('roomState', (players: any) => {
      const myId = sessionStorage.getItem('hqvgc_playerId');
      for (const id in players) {
        if (id !== myId) {
          setOpponentName(players[id].name);
          onOpponentNameChange?.(players[id].name);
          setOpponentSelectedDeckId(players[id].deckId);
          setOpponentReady(players[id].isReady);
        }
      }
    });

    socket.on('playerJoined', (playerData: any) => {
      setOpponentName(playerData.name);
      onOpponentNameChange?.(playerData.name);
      setOpponentSelectedDeckId(playerData.deckId);
      setOpponentReady(playerData.isReady);
    });

    socket.on('opponentDeckUpdated', (deckId: string) => {
      setOpponentSelectedDeckId(deckId);
    });

    socket.on('opponentReadyStatus', (status: boolean) => {
      setOpponentReady(status);
    });

    socket.on('startCountdown', () => {
      setCountdown(3);
    });

    socket.on('cancelCountdown', () => {
      setCountdown(null);
    });

    socket.on('playerLeft', () => {
      setOpponentName(null);
      setOpponentSelectedDeckId(null);
      setOpponentReady(false);
      setCountdown(null);
    });

    socket.on('roomUpdated', (players: any) => {
      // In case we joined an existing room, we need to populate opponent data
      const myId = sessionStorage.getItem('hqvgc_playerId');
      for (const id in players) {
        if (id !== myId) {
          setOpponentName(players[id].name);
          onOpponentNameChange?.(players[id].name);
          setOpponentSelectedDeckId(players[id].deckId);
          setOpponentReady(players[id].isReady);
        }
      }
    });

    return () => {
      socket.off('roomState');
      socket.off('playerJoined');
      socket.off('opponentDeckUpdated');
      socket.off('opponentReadyStatus');
      socket.off('startCountdown');
      socket.off('cancelCountdown');
      socket.off('playerLeft');
      socket.off('roomUpdated');
    };
  }, [roomCode]);

  // Handle local deck change
  const handleDeckChange = (deckId: string) => {
    setSelectedDeckId(deckId);
    socket.emit('updateDeck', { roomCode, deckId });
  };

  // Handle local ready toggle
  const handleToggleReady = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    socket.emit('toggleReady', { roomCode, isReady: newReady });
  };

  // Countdown timer logic
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(-1); // Prevent infinite loop
      onReady(selectedDeckId, opponentSelectedDeckId);
    }
  }, [countdown, onReady, selectedDeckId, opponentSelectedDeckId]);

  // Helper untuk mengambil preview kartu
  const getFirstCardImage = (deckName: string | null) => {
    if (!deckName) return null;
    
    let prefix = "";
    if (deckName === "Karasuno Starter Deck") prefix = "HVD-01";
    else if (deckName === "Rivals Starter Deck") prefix = "HVD-02";
    else if (deckName === "Karasuno Evolves Explosively Starter Deck") prefix = "HVD-03";
    else if (deckName === "It's Seijō that Goes to Nationals Starter Deck") prefix = "HVD-04";
    else if (deckName === "Powerhouse!! Fukurodani Academy Group Starter Deck") prefix = "HVD-05";

    if (prefix) {
      const card = cardDatabase.find(c => c.id.startsWith(prefix));
      if (card) return card.image;
    }
    
    return "/assets/backCard_vgc.png";
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center font-sans p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-center bg-cover opacity-10 pointer-events-none" style={{ backgroundImage: "url('/assets/bg_pattern.png')" }} />

      {/* Header */}
      <div className="z-10 flex flex-col items-center mb-8 w-full">
        <h1 className="text-3xl font-black mb-1 text-gray-300 tracking-tight text-center">
          ONLINE ROOM
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm uppercase font-bold tracking-widest">Code :</span>
          <span className="text-orange-500 font-mono font-bold text-lg">{roomCode}</span>
        </div>
      </div>

      {/* Main Content - 3 Columns */}
      <div className="z-10 flex flex-col md:flex-row w-full max-w-6xl h-auto md:h-[450px] gap-6 justify-center items-center">
        
        {/* Left Column: Player 1 Preview Card */}
        <div className="hidden md:flex flex-1 max-w-xs h-full bg-neutral-900 border-2 border-gray-700 rounded-xl flex-col items-center justify-center overflow-hidden p-4">
          <span className="text-gray-500 uppercase tracking-widest font-bold text-xs mb-4">Preview Card</span>
          <img 
            src={encodeURI(getFirstCardImage(selectedDeckId) || "/assets/backCard_vgc.png")} 
            alt="P1 Deck Preview" 
            className="w-full object-contain rounded-lg border border-gray-800"
          />
        </div>

        {/* Center Column: Players & Buttons */}
        <div className="flex flex-col w-full md:w-[400px] h-full justify-between gap-4 md:gap-0">
          
          {/* Players */}
          <div className="flex gap-4 h-[280px]">
            
            {/* Player 1 */}
            <div className={`flex-1 flex flex-col items-center p-4 border rounded-xl transition-all ${isReady ? "bg-orange-900/10 border-orange-500" : "bg-neutral-900 border-gray-700"}`}>
              <h2 className="text-xl font-black text-white mb-2 truncate w-full text-center">{playerName}</h2>
              <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border mb-4 ${isReady ? "text-orange-400 border-orange-500 bg-orange-500/10" : "text-gray-400 border-gray-600"}`}>
                {isReady ? "Ready" : "Not Ready"}
              </span>
              
              <div className="w-full mt-auto">
                <select 
                  className="w-full bg-black border border-gray-700 text-white rounded p-2 text-xs font-bold outline-none focus:border-orange-500"
                  value={selectedDeckId}
                  onChange={(e) => handleDeckChange(e.target.value)}
                  disabled={isReady}
                >
                  {availableDecks.map(deckId => (
                    <option key={deckId} value={deckId}>
                      {getDeckDisplayName(deckId)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Player 2 */}
            <div className={`flex-1 flex flex-col items-center p-4 border rounded-xl transition-all ${opponentReady ? "bg-red-900/10 border-red-500" : "bg-neutral-900 border-gray-700"}`}>
              {opponentName ? (
                <>
                  <h2 className="text-xl font-black text-white mb-2 truncate w-full text-center">{opponentName}</h2>
                  <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border mb-4 ${opponentReady ? "text-red-400 border-red-500 bg-red-500/10" : "text-gray-400 border-gray-600"}`}>
                    {opponentReady ? "Ready" : "Not Ready"}
                  </span>
                  <div className="w-full mt-auto">
                    <select 
                      className="w-full bg-black border border-gray-700 text-white rounded p-2 text-xs font-bold outline-none disabled:opacity-80"
                      value={opponentSelectedDeckId || ""}
                      disabled
                    >
                      {opponentSelectedDeckId ? (
                        <option>{opponentSelectedDeckId}</option>
                      ) : (
                        <option>Selecting Deck...</option>
                      )}
                    </select>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center h-full w-full">
                  <span className="text-gray-500 font-bold animate-pulse text-center text-xs">
                    Waiting for<br/>opponent...
                  </span>
                </div>
              )}
            </div>
            
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 mt-6">
            {countdown !== null ? (
              <div className="w-full py-3 h-[52px] bg-neutral-800 border-2 border-gray-600 rounded flex items-center justify-center">
                <div className="text-2xl font-black text-white animate-bounce">
                  {countdown === 0 ? "START!" : `STARTING IN ${countdown}`}
                </div>
              </div>
            ) : (
              <button
                onClick={handleToggleReady}
                className={`w-full py-3 h-[52px] font-black text-lg uppercase tracking-widest transition-all rounded shadow-sm ${
                  isReady 
                  ? "bg-neutral-800 border-2 border-gray-600 text-gray-400 hover:bg-neutral-700" 
                  : "bg-gradient-to-r from-orange-600 to-red-600 text-white hover:scale-[1.02]"
                }`}
              >
                {isReady ? "Cancel Ready" : "Ready"}
              </button>
            )}

            <button
              onClick={() => onNavigate("online-lobby")}
              disabled={isReady || countdown !== null}
              className="text-sm text-gray-500 hover:text-white uppercase tracking-widest font-bold transition-colors pb-1 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Right Column: Player 2 Preview Card */}
        <div className="hidden md:flex flex-1 max-w-xs h-full bg-neutral-900 border-2 border-gray-700 rounded-xl flex-col items-center justify-center overflow-hidden p-4">
          <span className="text-gray-500 uppercase tracking-widest font-bold text-xs mb-4">Preview Card</span>
          {opponentName ? (
            <img 
              src={encodeURI(getFirstCardImage(opponentSelectedDeckId) || "/assets/backCard_vgc.png")} 
              alt="P2 Deck Preview" 
              className="w-full object-contain rounded-lg border border-gray-800"
            />
          ) : (
            <div className="w-full aspect-[63/88] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
              <span className="text-gray-600 font-bold text-xs">Waiting...</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
