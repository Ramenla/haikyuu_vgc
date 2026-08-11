import React, { useState, useEffect, useRef } from "react";
import { CardData, CardInstance } from "./types/card";
import { Phase, Turn, Screen, PendingEffectCard, PendingCardSelection, PendingChoice, CustomDeck, ChatMessage } from "./types/game";
import { cardDatabase } from "./data/cardDatabase";
import { getStarterDeckCards } from "./utils/starterDeckUtils";
import { MenuScreen } from "./components/screens/MenuScreen";
import { DeckSelectionScreen } from "./components/screens/DeckSelectionScreen";
import { DeckBuilderScreen } from "./components/screens/DeckBuilderScreen";
import { GameBoardScreen } from "./components/screens/GameBoardScreen";
import { OnlineLobbyScreen } from "./components/screens/OnlineLobbyScreen";
import { OnlineRoomScreen } from "./components/screens/OnlineRoomScreen";
import CardSelectionModal from "./components/CardSelectionModal";
import { socket, connectSocket } from "./network/socket";

export const playSound = (type: "draw" | "play") => {
  const src = type === "draw" ? "/assets/ambilKartu.mp3" : "/assets/mainKartukeArea.mp3";
  const audio = new Audio(src);
  audio.play().catch(e => console.warn("Audio play blocked", e));
};

export default function App() {

  const pendingReconnect = useRef(false);

  // State untuk menyimpan layar yang sedang aktif
  const [currentScreen, setCurrentScreen] = useState<Screen>("menu");

  // State untuk Deck Selection
  const [selectedDeckType, setSelectedDeckType] = useState<string | null>(null);

  // State untuk Deck Builder
  const [builderDeck, setBuilderDeck] = useState<CardData[]>([]);
  const [deckBuilderSearch, setDeckBuilderSearch] = useState("");
  const [deckBuilderFilter, setDeckBuilderFilter] = useState("All");

  // State untuk Custom Decks
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>(() => {
    const saved = localStorage.getItem('hqvgc_custom_decks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse custom decks", e);
      }
    }
    return [];
  });

  // Sinkronisasi customDecks ke localStorage
  useEffect(() => {
    localStorage.setItem('hqvgc_custom_decks', JSON.stringify(customDecks));
  }, [customDecks]);

  // State untuk Online Play (Simulasi)
  const [playerName, setPlayerName] = useState("Player 1");
  const [roomCode, setRoomCode] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false);
  const [forceSyncTrigger, setForceSyncTrigger] = useState(0);
  const [opponentName, setOpponentName] = useState("Player 2");

  // State untuk menyimpan deck pemain di game board
  const [playerDeck, setPlayerDeck] = useState<CardInstance[]>([]);
  const [botDeck, setBotDeck] = useState<CardInstance[]>([]);
  const [gameLogs, setGameLogs] = useState<string[]>([]);

  // State untuk menyimpan semua kartu yang sedang dimainkan
  const [activeCards, setActiveCards] = useState<CardInstance[]>([]);

  // State Game Loop
  const [currentTurn, setCurrentTurn] = useState<Turn>("Player 1");
  const [currentPhase, setCurrentPhase] = useState<Phase>("Serve Phase");
  const [isOpponentBlockDisabled, setIsOpponentBlockDisabled] = useState<boolean>(false);
  const [isOpponentLiDisabled, setIsOpponentLiDisabled] = useState<boolean>(false);
  const [isBokutoRestricted, setIsBokutoRestricted] = useState<boolean>(false);
  const [isBlockRebound, setIsBlockRebound] = useState(false);
  const [player1Sets, setPlayer1Sets] = useState(0);
  const [player2Sets, setPlayer2Sets] = useState(0);
  const [selectedCard, setSelectedCard] = useState<CardData | CardInstance | null>(null);
  const [hasDrawnThisTurn, setHasDrawnThisTurn] = useState(false);
  const [pendingEffectCard, setPendingEffectCard] = useState<PendingEffectCard | null>(null);
  const [isDiscardingForEffect, setIsDiscardingForEffect] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingCardSelection, setPendingCardSelection] = useState<PendingCardSelection | null>(null);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [matchWinner, setMatchWinner] = useState<Turn | null>(null);

  // Efek Toast Notification
  // Penjelasan Logika: Jika toastMessage memiliki isi (tidak null), kita akan memasang timer.
  // Setelah 3 detik (3000 ms), timer akan me-reset toastMessage kembali ke null sehingga notifikasi menghilang.
  // Jangan lupa 'cleanup' timer-nya agar tidak tumpang tindih jika muncul toast baru sebelum yang lama hilang.
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  const nextPhaseRef = useRef<() => void>(() => { });
  const botHasActed = useRef(false);

  // ========== AUTO-RECONNECT LOGIC ==========
  useEffect(() => {
    const savedRoom = sessionStorage.getItem('hqvgc_roomCode');
    const savedName = sessionStorage.getItem('hqvgc_playerName');
    const savedPlayerId = sessionStorage.getItem('hqvgc_playerId');
    
    if (savedRoom && savedName && savedPlayerId) {
      pendingReconnect.current = true;
      setPlayerName(savedName);
      connectSocket();
      
      const handleReconnectJoined = (data: any) => {
        if (data.isReconnect) {
          isSyncing.current = true;
          setRoomCode(data.roomCode);
          setIsOnline(true);
          setCurrentScreen("game-board");
        } else {
          // Room existed but we're not reconnecting (e.g. server restarted)
          sessionStorage.removeItem('hqvgc_roomCode');
          pendingReconnect.current = false;
        }
      };
      
      const handleReconnectError = () => {
        sessionStorage.removeItem('hqvgc_roomCode');
        pendingReconnect.current = false;
      };
      
      socket.once('roomJoined', handleReconnectJoined);
      socket.once('error', handleReconnectError);
      
      socket.emit('joinRoom', { 
        roomCode: savedRoom, 
        playerName: savedName, 
        playerId: savedPlayerId 
      });
    }
  }, []);

  // ========== ONLINE SYNC LOGIC ==========
  const isSyncing = useRef(false);
  const syncVersion = useRef(0);

  const mirrorLocation = (loc: string): string => {
    if (loc.startsWith("bot_")) return loc.replace("bot_", "");
    if (["hand", "deck", "drop", "set", "serve", "toss", "attack", "receive", "block", "action"].includes(loc)) {
      return "bot_" + loc;
    }
    return loc;
  };

  const mirrorCards = (cards: CardInstance[]): CardInstance[] => {
    return cards.map(c => ({ ...c, location: mirrorLocation(c.location) as any }));
  };

  const mirrorLogs = (logs: string[]): string[] => {
    return logs.map(log => {
      if (log.startsWith("[SISTEM]")) return log;
      return log
        .replace(/Player 1/g, "##P1##")
        .replace(/Player 2/g, "Player 1")
        .replace(/##P1##/g, "Player 2");
    });
  };

  // Broadcast state to opponent whenever game state changes
  useEffect(() => {
    if (!isOnline || currentScreen !== "game-board") return;
    if (isSyncing.current) return;

    syncVersion.current += 1;
    const ver = syncVersion.current;

    // Small debounce to batch rapid state changes
    const timer = setTimeout(() => {
      if (syncVersion.current !== ver) return; // skip if newer change happened
      socket.emit('gameAction', {
        roomCode,
        action: {
          type: 'FULL_SYNC',
          playerDeck,
          botDeck,
          activeCards,
          currentPhase,
          currentTurn,
          gameLogs,
          player1Sets,
          player2Sets,
          isBlockRebound,
          senderName: playerName,
          matchWinner
        }
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [playerDeck, botDeck, activeCards, currentPhase, currentTurn, player1Sets, player2Sets, isBlockRebound, gameLogs, isOnline, currentScreen, forceSyncTrigger]);

  // Listen for opponent state & game start
  useEffect(() => {
    if (!isOnline) return;

    const handleGameStarted = (data: any) => {
      if (!isHost) {
        isSyncing.current = true;
        // Guest receives host's decks - mirror them
        setPlayerDeck(mirrorCards(data.guestDeck));
        setBotDeck(mirrorCards(data.hostDeck));
        setActiveCards(mirrorCards(data.activeCards));
        setCurrentPhase("Serve Phase");
        setCurrentTurn("Player 2"); // From guest perspective, it's Player 2's (host's) turn to serve
        setGameLogs(["Game Dimulai!"]);
        setCurrentScreen("game-board");
        setTimeout(() => { isSyncing.current = false; }, 200);
      }
    };

    const handleOpponentAction = (action: any) => {
      if (action.type === 'FULL_SYNC') {
        isSyncing.current = true;
        // Mirror everything: our "player" is their "bot" and vice versa
        setPlayerDeck(mirrorCards(action.botDeck));
        setBotDeck(mirrorCards(action.playerDeck));
        setActiveCards(mirrorCards(action.activeCards));
        setCurrentPhase(action.currentPhase);
        // Mirror turns
        const mirroredTurn = action.currentTurn === "Player 1" ? "Player 2" : "Player 1";
        setCurrentTurn(mirroredTurn as Turn);
        // Sync logs
        setGameLogs(mirrorLogs(action.gameLogs || []));
        // Mirror scores
        setPlayer1Sets(action.player2Sets || 0);
        setPlayer2Sets(action.player1Sets || 0);
        // Sync block rebound
        setIsBlockRebound(!!action.isBlockRebound);
        // Restore opponent name from the sender
        if (action.senderName) {
          setOpponentName(action.senderName);
        }
        if (action.matchWinner) {
          setMatchWinner(action.matchWinner === "Player 1" ? "Player 2" : "Player 1");
        } else {
          setMatchWinner(null);
        }
        setTimeout(() => { isSyncing.current = false; }, 200);
      }
    };

    const handlePlayerLeft = (playerId: string) => {
      if (isOnline && currentScreen === "game-board") {
        setGameLogs((prev) => [...prev, `[SISTEM] ${opponentName} keluar dari permainan secara permanen. Permainan dibatalkan.`]);
        alert(`${opponentName} terputus dari permainan secara permanen. Permainan dibatalkan.`);
        setIsOnline(false);
        setRoomCode("");
        setIsHost(false);
        setIsOpponentDisconnected(false);
        sessionStorage.removeItem('hqvgc_roomCode');
        setCurrentScreen("menu");
      }
    };

    const handleOpponentDisconnected = (playerId: string) => {
      setIsOpponentDisconnected(true);
      setGameLogs((prev) => [...prev, `[SISTEM] ${opponentName} terputus koneksi! Menunggu kembali (60 detik)...`]);
    };

    const handleOpponentRejoined = (playerId: string) => {
      setIsOpponentDisconnected(false);
      setGameLogs((prev) => [...prev, `[SISTEM] ${opponentName} berhasil terhubung kembali!`]);
      // Don't trigger forceSyncTrigger here - the reconnecting player will request sync itself
    };

    // Handle sync request from opponent who just reconnected
    const handleSyncRequested = () => {
      // Opponent reconnected and is asking us to send our current state
      setForceSyncTrigger((prev) => prev + 1);
    };

    const handleChatMessage = (messageData: ChatMessage) => {
      setChatMessages((prev) => [...prev, messageData]);
    };

    socket.on('gameStarted', handleGameStarted);
    socket.on('opponentAction', handleOpponentAction);
    socket.on('playerLeft', handlePlayerLeft);
    socket.on('opponentDisconnected', handleOpponentDisconnected);
    socket.on('opponentRejoined', handleOpponentRejoined);
    socket.on('syncRequested', handleSyncRequested);
    socket.on('chatMessage', handleChatMessage);

    return () => {
      socket.off('gameStarted', handleGameStarted);
      socket.off('opponentAction', handleOpponentAction);
      socket.off('playerLeft', handlePlayerLeft);
      socket.off('opponentDisconnected', handleOpponentDisconnected);
      socket.off('opponentRejoined', handleOpponentRejoined);
      socket.off('syncRequested', handleSyncRequested);
      socket.off('chatMessage', handleChatMessage);
    };
  }, [isOnline, isHost, currentScreen, opponentName]);

  // When reconnecting player enters game-board, request sync from opponent
  // This runs AFTER the useEffect above has registered the listeners
  useEffect(() => {
    if (pendingReconnect.current && isOnline && currentScreen === "game-board") {
      pendingReconnect.current = false;
      // Small delay to ensure listeners are fully registered
      const timer = setTimeout(() => {
        socket.emit('requestSync', { roomCode });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOnline, currentScreen, roomCode]);
  // ========================================

  useEffect(() => {
    botHasActed.current = false;
  }, [currentTurn, currentPhase]);

  const addLog = (message: string) => {
    setGameLogs((prev) => [...prev, message]);
  };

  // Kalkulasi poin otomatis
  const calculatePoints = () => {
    const opponent = currentTurn === "Player 1" ? "Player 2" : "Player 1";

    const opponentServeLoc = opponent === "Player 1" ? "serve" : "bot_serve";
    const opponentTossLoc = opponent === "Player 1" ? "toss" : "bot_toss";
    const opponentAttackLoc = opponent === "Player 1" ? "attack" : "bot_attack";

    const opponentServe = activeCards.find(
      (c) => c.location === opponentServeLoc && !c.isGuts,
    );
    const opponentToss = activeCards.find(
      (c) => c.location === opponentTossLoc && !c.isGuts,
    );
    const opponentAttack = activeCards.find(
      (c) => c.location === opponentAttackLoc && !c.isGuts,
    );

    let incomingAttack = 0;
    let incomingAttackType: "Serve" | "Attack" | "BlockReturn" | null = null;

    if (isBlockRebound) {
      incomingAttackType = "BlockReturn";
      incomingAttack = 1;
    } else if (opponentServe && opponentServe.type !== "Action") {
      incomingAttack = opponentServe.stats.serve;
      incomingAttackType = "Serve";
    } else if (
      opponentToss &&
      opponentAttack &&
      opponentToss.type !== "Action" &&
      opponentAttack.type !== "Action"
    ) {
      incomingAttack = opponentToss.stats.toss + opponentAttack.stats.attack;
      incomingAttackType = "Attack";
    }

    const receiveLoc = currentTurn === "Player 1" ? "receive" : "bot_receive";
    const blockLoc = currentTurn === "Player 1" ? "block" : "bot_block";

    const receiveCard = activeCards.find(
      (c) => c.location === receiveLoc && !c.isGuts,
    );
    const blockCards = activeCards
      .filter((c) => c.location === blockLoc && !c.isGuts)
      .slice(0, 3);

    const blockPoint = blockCards.reduce(
      (sum, card) => sum + (card.type !== "Action" ? card.stats.block : 0),
      0,
    );
    const receivePoint =
      receiveCard && receiveCard.type !== "Action"
        ? receiveCard.stats.receive
        : 0;

    const totalDefense = Math.max(receivePoint, blockPoint);
    const defenseType: "block" | "receive" = blockPoint > 0 ? "block" : "receive";

    const serveLoc = currentTurn === "Player 1" ? "serve" : "bot_serve";
    const tossLoc = currentTurn === "Player 1" ? "toss" : "bot_toss";
    const attackLoc = currentTurn === "Player 1" ? "attack" : "bot_attack";

    const myServe = activeCards.find(
      (c) => c.location === serveLoc && !c.isGuts,
    );
    const myToss = activeCards.find((c) => c.location === tossLoc && !c.isGuts);
    const myAttack = activeCards.find(
      (c) => c.location === attackLoc && !c.isGuts,
    );

    let outgoingAttack = 0;
    if (currentPhase === "Serve Phase") {
      if (myServe && myServe.type !== "Action")
        outgoingAttack = myServe.stats.serve;
    } else {
      if (
        myToss &&
        myAttack &&
        myToss.type !== "Action" &&
        myAttack.type !== "Action"
      ) {
        outgoingAttack = myToss.stats.toss + myAttack.stats.attack;
      }
    }

    return {
      incomingAttack,
      incomingAttackType,
      totalDefense,
      defenseType,
      outgoingAttack,
    };
  };

  const points = calculatePoints();

  const sendChatMessage = (text: string) => {
    if (!text.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      sender: "Player 1", // For our local perspective, we are always sending as Player 1
      text: text.trim(),
      timestamp: Date.now()
    };
    
    // Add to our own state immediately
    setChatMessages(prev => [...prev, newMessage]);
    
    // Broadcast to opponent (will arrive at opponent and be mirrored to 'Player 2')
    if (isOnline && roomCode) {
      // Create a mirrored version for the opponent
      const opponentMessage: ChatMessage = {
        ...newMessage,
        sender: "Player 2" // To the opponent, WE are Player 2
      };
      socket.emit('chatMessage', { roomCode, ...opponentMessage });
    }
  };

  // Logika Bot Sederhana
  useEffect(() => {
    if (currentScreen !== "game-board") return;
    if (currentTurn !== "Player 2") return;
    if (botHasActed.current) return;
    if (isOnline) return;

    const playBotBlockCards = (targetValue: number) => {
      setActiveCards((prev) => {
        let botHand = prev.filter(c => c.location === "bot_hand" && c.type === "Character");
        if (botHand.length === 0) return prev;

        const sortedCards = [...botHand].sort((a, b) => b.stats.block - a.stats.block);

        let selectedCards = [];
        let currentSum = 0;

        for (const card of sortedCards) {
          if (selectedCards.length < 3) {
            selectedCards.push(card);
            currentSum += card.stats.block;
            if (currentSum >= targetValue) break;
          }
        }

        if (selectedCards.length > 0) {
          return prev.map(c =>
            selectedCards.some(sc => sc.instanceId === c.instanceId)
              ? { ...c, location: "bot_block" }
              : c
          );
        }

        return prev;
      });
    };

    const playBotCard = (
      location: string,
      targetStat?: "receive" | "block" | "serve" | "toss" | "attack",
      targetValue?: number,
    ) => {
      setActiveCards((prev) => {
        if (
          location !== "bot_block" &&
          prev.some((c) => c.location === location && !c.isGuts)
        ) {
          return prev;
        }

        let botHand = prev.filter(c => c.location === "bot_hand" && c.type === "Character");
        if (botHand.length === 0) return prev;

        let chosenCard;

        if (targetStat) {
          const sortedCards = [...botHand].sort((a, b) => b.stats[targetStat] - a.stats[targetStat]);

          if (targetValue !== undefined) {
            const betterCards = sortedCards.filter(
              (c) => c.stats[targetStat] >= targetValue,
            );
            if (betterCards.length > 0) {
              chosenCard = betterCards[Math.floor(Math.random() * betterCards.length)];
            } else {
              chosenCard = sortedCards[0];
            }
          } else {
            chosenCard = sortedCards[0];
          }
        } else {
          chosenCard = botHand[Math.floor(Math.random() * botHand.length)];
        }

        const randomCard = chosenCard;
        if (randomCard) {
          const cardToMove = prev.find((c) => c.instanceId === randomCard.instanceId);
          if (!cardToMove) return prev;
          const otherCards = prev.filter((c) => c.instanceId !== randomCard.instanceId);
          return [...otherCards, { ...cardToMove, location }];
        }
        return prev;
      });
    };

    let timer: NodeJS.Timeout;

    botHasActed.current = true;
    if (currentPhase === "Serve Phase") {
      timer = setTimeout(() => {
        playBotCard("bot_serve", "serve");
        setTimeout(() => nextPhaseRef.current(), 1500);
      }, 1000);
    } else if (currentPhase === "Receive Phase") {
      timer = setTimeout(() => {
        playBotCard("bot_receive", "receive", points.incomingAttackType === "BlockReturn" ? 1 : points.incomingAttack);
        performDraw(1, "Player 2");
        addLog("Player 2 melakukan Receive & Draw 1 kartu");
        setTimeout(() => nextPhaseRef.current(), 1500);
      }, 1000);
    } else if (currentPhase === "Toss Phase") {
      timer = setTimeout(() => {
        playBotCard("bot_toss", "toss");
        setTimeout(() => nextPhaseRef.current(), 1500);
      }, 1000);
    } else if (currentPhase === "Attack Phase") {
      timer = setTimeout(() => {
        playBotCard("bot_attack", "attack");
        setTimeout(() => nextPhaseRef.current(), 1500);
      }, 1000);
    } else if (currentPhase === "Block Phase") {
      timer = setTimeout(() => {
        playBotBlockCards(points.incomingAttack);
        setTimeout(() => nextPhaseRef.current(), 1500);
      }, 1000);
    }

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase, currentTurn, currentScreen]);

  const performDraw = (amount: number, player: Turn = "Player 1") => {
    const isP1 = player === "Player 1";
    const currentDeck = isP1 ? playerDeck : botDeck;
    const handLoc = isP1 ? "hand" : "bot_hand";

    if (currentDeck.length === 0) return;

    const deck = [...currentDeck];
    const newlyDrawn: CardInstance[] = [];
    let drawn = 0;

    while (deck.length > 0 && drawn < amount) {
      const c = deck.shift();
      if (c) {
        newlyDrawn.push({
          ...c,
          location: handLoc,
          instanceId: Math.random().toString(36).substring(2, 11),
        });
        drawn++;
      }
    }

    if (isP1) {
      setPlayerDeck(deck);
    } else {
      setBotDeck(deck);
    }

    if (newlyDrawn.length > 0) {
      setActiveCards((cards) => [...cards, ...newlyDrawn]);
      if (isP1) {
        playSound("draw");
      }
    }
  };

  const handleSetWin = (winner: Turn) => {
    const loser = winner === "Player 1" ? "Player 2" : "Player 1";
    const loserSetLoc = loser === "Player 1" ? "set" : "bot_set";

    const loserSetCards = activeCards.filter((c) => c.location === loserSetLoc);

    if (loserSetCards.length === 0) {
      showToast(`Pemain ${winner} Menang Mutlak! Set Area Lawan Habis!`);
      setMatchWinner(winner);
      setCurrentPhase("End Phase");
      return;
    }

    const p1Score = winner === "Player 1" ? player1Sets + 1 : player1Sets;
    const p2Score = winner === "Player 2" ? player2Sets + 1 : player2Sets;

    if (winner === "Player 1") setPlayer1Sets(p1Score);
    else setPlayer2Sets(p2Score);

    if (p1Score >= 3 || p2Score >= 3) {
      showToast(`Pertandingan Selesai! ${winner} memenangkan permainan!`);
      setMatchWinner(winner);
      setCurrentPhase("End Phase");
      return;
    }

    showToast(`Set dimenangkan oleh ${winner}! Memulai set baru...`);

    const p1HandSize = activeCards.filter((c) => c.location === "hand" && !c.isGuts).length;
    const p1ToDraw = Math.max(0, 6 - p1HandSize);

    const p2HandSize = activeCards.filter((c) => c.location === "bot_hand" && !c.isGuts).length;
    const p2ToDraw = Math.max(0, 6 - p2HandSize);

    const newlyDrawnP1 = playerDeck.slice(0, p1ToDraw).map(card => ({
      ...card,
      location: "hand",
      instanceId: Math.random().toString(36).substring(2, 11)
    }));
    const newPlayerDeck = playerDeck.slice(p1ToDraw);

    const newlyDrawnP2 = botDeck.slice(0, p2ToDraw).map(card => ({
      ...card,
      location: "bot_hand",
      instanceId: Math.random().toString(36).substring(2, 11)
    }));
    const newBotDeck = botDeck.slice(p2ToDraw);

    setPlayerDeck(newPlayerDeck);
    setBotDeck(newBotDeck);

    setActiveCards((prevCards) => {
      let cards = prevCards.map((card) =>
        [
          "serve",
          "receive",
          "toss",
          "attack",
          "block",
          "bot_serve",
          "bot_receive",
          "bot_toss",
          "bot_attack",
          "bot_block",
          "action",
          "bot_action",
        ].includes(card.location) && !card.isGuts
          ? {
            ...card,
            location: card.location.includes("block") ? (card.location.startsWith("bot_") ? "bot_drop" : "drop") : card.location,
            isGuts: !card.location.includes("block"),
            isEffectActive: false,
          }
          : card,
      );

      cards = [...cards, ...newlyDrawnP1, ...newlyDrawnP2];

      const setCards = cards.filter((c) => c.location === loserSetLoc);
      if (setCards.length > 0) {
        const cardToTake = setCards[0];
        const cardIndex = cards.findIndex(
          (c) => c.instanceId === cardToTake.instanceId,
        );
        if (cardIndex !== -1) {
          cards[cardIndex] = {
            ...cards[cardIndex],
            location: loser === "Player 1" ? "hand" : "bot_hand",
            isGuts: false,
          };
        }
      }

      return cards;
    });

    addLog(`Set baru dimulai! ${winner} memulai dengan Serve.`);
    setCurrentTurn(winner);
    setCurrentPhase("Serve Phase");
    setIsBlockRebound(false);
    setIsOpponentBlockDisabled(false); // Reset efek kuncian blok di akhir giliran
  };

  const handleActivateHandEffect = () => {
    // Penjelasan Logika "Hand Effect":
    // 1. Pastikan kartu yang dipilih ada di tangan dan efeknya adalah 'onHandActivate'
    if (!selectedCard || !('location' in selectedCard) || selectedCard.location !== 'hand') return;
    if (selectedCard.effectTrigger !== 'onHandActivate') return;

    // 2. Buang kartu tersebut dari tangan ke drop area (sebagai cost/bayaran efek)
    setActiveCards(prev => prev.map(c =>
      c.instanceId === selectedCard.instanceId ? { ...c, location: 'drop' } : c
    ));

    // 3. Tambahkan efeknya (misalnya buffDefense +2) ke kartu pertahanan (Receive atau Block) yang sedang aktif di arena
    if (selectedCard.effectType === 'buffDefense' && selectedCard.effectValue) {
      setActiveCards(prev => {
        const activeDefCard = prev.find(c => (c.location === 'receive' || c.location === 'block') && !c.isGuts);
        if (activeDefCard) {
          return prev.map(c =>
            c.instanceId === activeDefCard.instanceId
              ? {
                ...c,
                stats: {
                  ...c.stats,
                  receive: c.stats.receive + selectedCard.effectValue!,
                  block: c.stats.block + selectedCard.effectValue!
                }
              }
              : c
          );
        }
        return prev;
      });
      addLog(`Efek Tangan Aktif! ${selectedCard.name} dibuang untuk menambah Defense sebesar ${selectedCard.effectValue}!`);
    }

    // 4. Kosongkan pilihan kartu agar UI bersih kembali
    setSelectedCard(null);
  };

  const isPlayValid = () => {
    if (matchWinner !== null) return false;
    if (currentTurn !== "Player 1") return false;

    if (currentPhase === "Serve Phase") {
      return activeCards.some((c) => c.location === "serve" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Receive Phase") {
      return activeCards.some((c) => c.location === "receive" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Toss Phase") {
      return activeCards.some((c) => c.location === "toss" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Attack Phase") {
      return activeCards.some((c) => c.location === "attack" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Block Phase") {
      return activeCards.some((c) => c.location === "block" && !c.isGuts && c.type !== "Action");
    }

    return false;
  };

  const resolveDefenseAndIncoming = () => {
    const opponent = currentTurn === "Player 1" ? "Player 2" : "Player 1";

    setActiveCards((prev) =>
      prev.map((card) => {
        if (card.isGuts) return card;
        if (
          card.location === "drop" ||
          card.location === "bot_drop" ||
          card.location === "permanent_drop" ||
          card.location === "bot_permanent_drop" ||
          card.location === "hand" ||
          card.location === "bot_hand" ||
          card.location === "set" ||
          card.location === "bot_set"
        )
          return card;

        const isOpponentLoc =
          opponent === "Player 2"
            ? card.location.startsWith("bot_")
            : !card.location.startsWith("bot_");

        const isCurrentPlayerLoc =
          currentTurn === "Player 2"
            ? card.location.startsWith("bot_")
            : !card.location.startsWith("bot_");

        if (isOpponentLoc) {
          if (card.location.includes("block")) {
            return {
              ...card,
              location: card.location.startsWith("bot_") ? "bot_drop" : "drop",
              isEffectActive: false,
            };
          }
          return { ...card, isGuts: true, isEffectActive: false };
        }

        if (isCurrentPlayerLoc) {
          if (card.location.includes("block")) {
            return {
              ...card,
              location: card.location.startsWith("bot_") ? "bot_drop" : "drop",
              isEffectActive: false,
            };
          }
          if (card.location.includes("receive") || card.location.includes("action")) {
            return { ...card, isGuts: true, isEffectActive: false };
          }
        }

        // Paksa ubah properti isEffectActive pada SEMUA kartu lain (toss, attack, dll) di lapangan menjadi false 
        // sehingga kartu resmi "mati" (karena sudah dimainkan dan melewatinya).
        if (!card.location.includes("hand") && !card.location.includes("set") && !card.location.includes("drop")) {
          return { ...card, isEffectActive: false };
        }

        return card;
      }),
    );

    // Reset efek kuncian blok di akhir reli/giliran
    setIsOpponentBlockDisabled(false);
    setIsOpponentLiDisabled(false);
    setIsBokutoRestricted(false);
  };

  nextPhaseRef.current = () => {
    nextPhase();
  };

  const handleDeclareBreak = () => {
    const opponent = currentTurn === "Player 1" ? "Player 2" : "Player 1";

    if (points.totalDefense >= points.incomingAttack && points.incomingAttack > 0) {
      const confirm = window.confirm("Pertahanan saat ini masih cukup kuat! Yakin tetap ingin Declare Break?");
      if (!confirm) return;
    }

    showToast(
      `BREAK Dideklarasikan! Poin untuk ${opponent}!`,
    );
    handleSetWin(opponent);
  };

  const requestDefenseChoice = (nextTurn: Turn, isRebound: boolean = false) => {
    setCurrentTurn(nextTurn);
    setCurrentPhase("Defense Choice Phase");
  };

  useEffect(() => {
    if (currentPhase !== "Defense Choice Phase") return;

    if (currentTurn === "Player 2" && !isOnline) {
      // Offline Bot otomatis memilih Block (50%) atau Receive (50%), tapi jika Rebound, wajib Receive
      const timer = setTimeout(() => {
        const chooseBlock = isBlockRebound ? false : Math.random() > 0.5;
        if (chooseBlock) {
          setCurrentPhase("Block Phase");
          addLog(`Player 2 memilih untuk Block.`);
        } else {
          setCurrentPhase("Receive Phase");
          addLog(`Player 2 memilih untuk Receive.`);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    if (currentTurn === "Player 1") {
      const receiveOption = {
        label: "Receive",
        action: () => {
          setCurrentPhase("Receive Phase");
          setPendingChoice(null);
          addLog(`${currentTurn} memilih untuk Receive.`);
          if (!hasDrawnThisTurn) {
            setHasDrawnThisTurn(true);
            setTimeout(() => performDraw(1, "Player 1"), 0);
            addLog("Player 1 melakukan Receive & Draw 1 kartu");
          }
        }
      };

      const blockOption = {
        label: "Block",
        action: () => {
          setCurrentPhase("Block Phase");
          setPendingChoice(null);
          addLog(`${currentTurn} memilih untuk Block.`);
        }
      };

      setPendingChoice({
        title: isBlockRebound ? "Bola Memantul (Rebound)! Anda harus Receive:" : "Pilih Cara Bertahan:",
        options: isBlockRebound ? [receiveOption] : [blockOption, receiveOption],
        onCancel: () => { }
      });
    }
  }, [currentPhase, currentTurn, isBlockRebound, isOnline, hasDrawnThisTurn]);

  const nextPhase = () => {
    setHasDrawnThisTurn(false);
    const opponent = currentTurn === "Player 1" ? "Player 2" : "Player 1";

    const reqZone =
      currentPhase === "Serve Phase"
        ? currentTurn === "Player 1"
          ? "serve"
          : "bot_serve"
        : currentPhase === "Receive Phase"
        ? currentTurn === "Player 1"
          ? "receive"
          : "bot_receive"
        : currentPhase === "Toss Phase"
        ? currentTurn === "Player 1"
          ? "toss"
          : "bot_toss"
        : currentPhase === "Attack Phase"
        ? currentTurn === "Player 1"
          ? "attack"
          : "bot_attack"
        : currentPhase === "Block Phase"
        ? currentTurn === "Player 1"
          ? "block"
          : "bot_block"
        : null;

    if (reqZone) {
      const hasCardInZone = activeCards.some(
        (c) => c.location === reqZone && !c.isGuts && c.type !== "Action"
      );
      if (!hasCardInZone) {
        if (currentTurn === "Player 1") {
          showToast("Kamu belum memainkan kartu di area fase ini!");
        } else {
          addLog(`${currentTurn} tidak memainkan kartu di ${currentPhase}! BREAK! Poin Set untuk ${opponent}.`);
          showToast(`BREAK! Poin untuk ${opponent}! ${currentTurn} tidak memainkan kartu di ${currentPhase}.`);
          handleSetWin(opponent);
        }
        return;
      }
    }

    if (currentPhase === "Serve Phase") {
      addLog(`${currentTurn} mengakhiri Serve Phase (Power: ${points.outgoingAttack})`);
      setCurrentTurn(opponent);
      setCurrentPhase("Receive Phase");

      if (opponent === "Player 1") {
        setHasDrawnThisTurn(true);
        setTimeout(() => performDraw(1, "Player 1"), 0);
        addLog("Player 1 mendapat giliran Receive & Draw 1 kartu");
      }
      return;
    }

    if (currentPhase === "Receive Phase") {
      setCurrentPhase("Toss Phase");
      addLog(`${currentTurn} masuk ke Toss Phase.`);
      return;
    }

    if (currentPhase === "Toss Phase") {
      setCurrentPhase("Attack Phase");
      addLog(`${currentTurn} masuk ke Attack Phase.`);
      return;
    }

    if (currentPhase === "Attack Phase" || currentPhase === "Block Phase") {
      // Resolusi Serangan atau Pertahanan
      if (points.totalDefense < points.incomingAttack) {
        if (currentTurn === "Player 1") {
          const confirm = window.confirm("Pertahananmu tidak cukup menahan serangan lawan. Yakin ingin mengakhiri giliran? (Kamu akan kalah di reli ini)");
          if (!confirm) return;
        }

        addLog(`${currentTurn} gagal menahan serangan! (Defense: ${points.totalDefense} vs Incoming: ${points.incomingAttack}). BREAK! Poin Set untuk ${opponent}.`);
        showToast(`BREAK! Poin untuk ${opponent}! Serangan (${points.incomingAttack}) menembus Pertahanan (${points.totalDefense}).`);
        handleSetWin(opponent);
        return;
      }

      if (currentPhase === "Attack Phase" && points.outgoingAttack === 0) {
        if (currentTurn === "Player 1") {
          const confirm = window.confirm("Kamu tidak melakukan serangan balik. Yakin ingin mengakhiri giliran? (Kamu akan kalah di reli ini)");
          if (!confirm) return;
        }
        addLog(`${currentTurn} gagal melakukan serangan balik! BREAK! Poin Set untuk ${opponent}.`);
        showToast(`BREAK! Poin untuk ${opponent}! ${currentTurn} gagal mengembalikan bola.`);
        handleSetWin(opponent);
        return;
      }

      if (currentPhase === "Block Phase") {
        addLog(`Blok Sukses! Reli berlanjut.`);
        showToast(`Blok Sukses! Bola memantul kembali ke ${opponent}.`);
        setIsBlockRebound(true);
        requestDefenseChoice(opponent, true);
      } else {
        addLog(`Receive & Serangan Balik Sukses! Reli berlanjut.`);
        showToast(`Serangan berhasil dibalas! Bola kembali ke ${opponent}.`);
        setIsBlockRebound(false);
        requestDefenseChoice(opponent, false);
      }

      resolveDefenseAndIncoming();
    }
  };

  const startGame = (overrideDeckType?: string, opponentDeckType?: string, opponentDeckCards?: string[]) => {
    const deckTypeToUse = (typeof overrideDeckType === "string" ? overrideDeckType : null) || selectedDeckType;
    let newDeck: CardInstance[] = [];
    let poolKartu: CardData[] = [];

    const getPoolForDeck = (deckName: string | null, customCards?: string[]) => {
      if (!deckName) return cardDatabase.filter((c) => c.id.startsWith("HVD-02"));
      
      // Jika ini deck kustom lawan, gunakan daftar kartu yang dikirim via jaringan
      if (customCards && customCards.length > 0) {
        return customCards.map(cardId => cardDatabase.find(c => c.id === cardId)!).filter(Boolean);
      }
      
      const customDeck = customDecks.find(d => d.id === deckName);
      if (customDeck) {
        return customDeck.cards.map(cardId => cardDatabase.find(c => c.id === cardId)!).filter(Boolean);
      }
      
      return getStarterDeckCards(deckName, cardDatabase);
    };

    poolKartu = getPoolForDeck(deckTypeToUse);

    // If it's a custom deck, check validity
    const isCustomDeck = customDecks.some(d => d.id === deckTypeToUse);
    if (isCustomDeck && poolKartu.length !== 40) {
      showToast("Custom Deck harus berisi tepat 40 kartu!");
      return;
    }

    poolKartu.forEach((card) => {
      newDeck.push({
        ...card,
        instanceId: Math.random().toString(36).substring(2, 11),
        location: "deck",
      });
    });

    // Fallback if empty for some reason
    if (newDeck.length === 0) {
      const fallbackDeck = getStarterDeckCards("Rivals Starter Deck", cardDatabase);
      fallbackDeck.forEach(card => {
        newDeck.push({
          ...card,
          instanceId: Math.random().toString(36).substring(2, 11),
          location: "deck",
        });
      });
    }

    newDeck = newDeck.sort(() => Math.random() - 0.5);

    // Build opponent/bot deck using opponentDeckType if provided (online), else Rivals
    let botPool = getPoolForDeck(opponentDeckType || "Rivals Starter Deck", opponentDeckCards);
    let botNewDeck: any[] = [];
    botPool.forEach((card) => {
      botNewDeck.push({
        ...card,
        instanceId: Math.random().toString(36).substring(2, 11),
        location: "deck",
      });
    });
    botNewDeck = botNewDeck.sort(() => Math.random() - 0.5);

    const handCards = newDeck
      .slice(0, 6)
      .map((c) => ({ ...c, location: "hand" }));
    const p1SetCards = newDeck
      .slice(6, 8)
      .map((c) => ({ ...c, location: "set" }));
    const remainingDeck = newDeck
      .slice(8)
      .map((c) => ({ ...c, location: "deck" }));

    const botHandCards = botNewDeck
      .slice(0, 6)
      .map((c: any) => ({ ...c, location: "bot_hand" }));
    const botSetCards2 = botNewDeck
      .slice(6, 8)
      .map((c: any) => ({ ...c, location: "bot_set" }));
    const remainingBotDeck = botNewDeck
      .slice(8)
      .map((c: any) => ({ ...c, location: "bot_deck" }));

    setPlayerDeck(remainingDeck);
    setBotDeck(remainingBotDeck);
    setActiveCards([...handCards, ...p1SetCards, ...botHandCards, ...botSetCards2]);
    setCurrentTurn("Player 1");
    setCurrentPhase("Serve Phase");
    setPlayer1Sets(0);
    setPlayer2Sets(0);
    setGameLogs([]);
    setHasDrawnThisTurn(false);
    setIsBlockRebound(false);
    setMatchWinner(null);
    addLog("Game Dimulai!");

    if (isOnline && isHost) {
      socket.emit('initGame', {
        roomCode,
        hostDeck: remainingDeck,
        guestDeck: remainingBotDeck,
        activeCards: [...handCards, ...p1SetCards, ...botHandCards, ...botSetCards2],
      });
    }

    setCurrentScreen("game-board");
  };

  const addToBuilderDeck = (card: CardData) => {
    if (builderDeck.length >= 40) {
      showToast("Deck sudah penuh! Maksimal 40 kartu.");
      return;
    }

    const copiesInDeck = builderDeck.filter((c) => c.name === card.name).length;
    if (copiesInDeck >= 4) {
      showToast(`Maksimal 4 kopi untuk kartu ${card.name}.`);
      return;
    }

    setBuilderDeck([...builderDeck, card]);
  };

  const removeFromBuilderDeck = (indexToRemove: number) => {
    setBuilderDeck(builderDeck.filter((_, index) => index !== indexToRemove));
  };

  const resolveCardEffect = (card: CardInstance, playerType: Turn, zoneId: string) => {
    if (!card.effectType || !card.effectTrigger || !card.isEffectActive) return;

    // Matikan efek setelah digunakan dan tandai telah digunakan
    setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: false, hasUsedEffect: true } : c));
    setSelectedCard(null);

    const triggerMap: Record<string, string> = {
      "onPlayAttack": playerType === "Player 1" ? "attack" : "bot_attack",
      "onPlayBlock": playerType === "Player 1" ? "block" : "bot_block",
      "onPlayToss": playerType === "Player 1" ? "toss" : "bot_toss",
      "onPlayServe": playerType === "Player 1" ? "serve" : "bot_serve",
      "onPlayReceive": playerType === "Player 1" ? "receive" : "bot_receive",
      "onPlayEvent": playerType === "Player 1" ? "action" : "bot_action",
    };

    if (card.effectTrigger === "onPlayAny") {
      // Allow any zone
    } else if (card.effectTrigger === "onPlayReceiveOrToss") {
      const allowed = playerType === "Player 1" ? ["receive", "toss"] : ["bot_receive", "bot_toss"];
      if (!allowed.includes(zoneId)) return;
    } else {
      if (triggerMap[card.effectTrigger] !== zoneId) return;
    }

    switch (card.effectType) {
      case "drawCard":
        if (card.effectValue) {
          setTimeout(() => performDraw(card.effectValue!, playerType), 0);
          addLog(`Efek Kartu Aktif! ${playerType} melakukan Draw ${card.effectValue} kartu ekstra!`);
        }
        break;

      case "addPower":
        if (card.effectValue) {
          setActiveCards((prevCards) =>
            prevCards.map((c) =>
              c.instanceId === card.instanceId
                ? {
                  ...c,
                  stats: {
                    serve: c.stats.serve + card.effectValue!,
                    receive: c.stats.receive + card.effectValue!,
                    toss: c.stats.toss + card.effectValue!,
                    attack: c.stats.attack + card.effectValue!,
                    block: c.stats.block + card.effectValue!,
                  }
                }
                : c
            )
          );
          addLog(`Efek Kartu Aktif! Power ${card.name} bertambah ${card.effectValue}!`);
        }
        break;

      case "addPowerIfGuts":
        if (card.effectValue && card.effectCostValue) {
          const gutsCount = activeCards.filter(c => c.isGuts && c.location === zoneId).length;
          if (gutsCount >= card.effectCostValue) {
            setActiveCards((prevCards) =>
              prevCards.map((c) =>
                c.instanceId === card.instanceId
                  ? {
                    ...c,
                    stats: {
                      serve: c.stats.serve + card.effectValue!,
                      receive: c.stats.receive + card.effectValue!,
                      toss: c.stats.toss + card.effectValue!,
                      attack: c.stats.attack + card.effectValue!,
                      block: c.stats.block + card.effectValue!,
                    }
                  }
                  : c
              )
            );
            addLog(`Efek Kartu Aktif! Memiliki ${gutsCount} Guts, Power ${card.name} bertambah +${card.effectValue}!`);
            showToast(`Power ${card.name} +${card.effectValue}!`);
          } else {
            showToast(`Guts tidak cukup! Membutuhkan minimal ${card.effectCostValue} Guts.`);
          }
        }
        break;

      case "actionCountingOnYou":
        // Eksekusi fungsi penarikan (Draw) 1 kartu
        setTimeout(() => performDraw(1, playerType), 0);
        // Tambahkan +1 ke Total Defense (karena dimainkan di Receive phase, ini nambah stats receive secara manual)
        setActiveCards((prevCards) => {
          const receiveCard = prevCards.find(c => c.location === (playerType === "Player 1" ? "receive" : "bot_receive") && !c.isGuts);
          if (receiveCard) {
            return prevCards.map(c =>
              c.instanceId === receiveCard.instanceId
                ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 1 } }
                : c
            );
          }
          return prevCards;
        });
        addLog(`Efek Kartu Action Aktif! ${playerType} Draw 1 kartu dan Receive Point +1!`);
        break;

      case "actionDeadOn":
        // Tambahkan +1 ke Total Attack
        setActiveCards((prevCards) => {
          const attackCard = prevCards.find(c => c.location === (playerType === "Player 1" ? "attack" : "bot_attack") && !c.isGuts);
          if (attackCard) {
            return prevCards.map(c =>
              c.instanceId === attackCard.instanceId
                ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } }
                : c
            );
          }
          return prevCards;
        });

        const tossCardName = activeCards.find(c => c.location === (playerType === "Player 1" ? "toss" : "bot_toss") && !c.isGuts)?.name;
        const attackCardName = activeCards.find(c => c.location === (playerType === "Player 1" ? "attack" : "bot_attack") && !c.isGuts)?.name;

        if (tossCardName?.includes("Kageyama") && attackCardName?.includes("Hinata")) {
          setIsOpponentBlockDisabled(true);
          addLog(`KOMBO SAKTI AKTIF! Blok lawan dinonaktifkan untuk giliran ini!`);
          showToast(`KOMBO KAGEYAMA & HINATA! Blok lawan dinonaktifkan!`);
        } else {
          addLog(`Efek Kartu Action Aktif! Attack Point +1!`);
        }
        break;

      case "actionOikawaToss":
        const eventCardsInGuts = activeCards.filter(c => c.isGuts && (c.location.includes("action") || c.location.includes("bot_action")) && c.type === "Action");
        if (eventCardsInGuts.length === 0) {
          showToast("Tidak ada kartu Event di tumpukan Guts!");
          break;
        }
        setPendingCardSelection({
          title: "Pilih Kartu Action untuk diambil dari Guts",
          cards: eventCardsInGuts,
          onSelect: (selected) => {
            setActiveCards(prev => prev.map(c => c.instanceId === selected.instanceId ? { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand", isGuts: false } : c));
            addLog(`Efek Oikawa Aktif! Mengambil ${selected.name} dari Guts ke tangan.`);
          }
        });
        break;

      case "actionNekomaReceive":
        setTimeout(() => performDraw(1, playerType), 0);

        setPendingChoice({
          title: "Pilih peningkatan Receive Point",
          options: [
            {
              label: "Set poin menjadi 5",
              action: () => {
                setActiveCards(prevCards => {
                  const receiveLoc = playerType === "Player 1" ? "receive" : "bot_receive";
                  const receiveCard = prevCards.find(c => c.location === receiveLoc && !c.isGuts);
                  if (receiveCard && receiveCard.school === "Nekoma") {
                    return prevCards.map(c => c.instanceId === receiveCard.instanceId ? { ...c, stats: { ...c.stats, receive: 5 } } : c);
                  }
                  return prevCards;
                });
                addLog(`Efek Action Nekoma Aktif! Draw 1 kartu dan merubah poin receive karakter Nekoma menjadi 5.`);
                setPendingChoice(null);
              }
            },
            {
              label: "Set poin dari 5+ menjadi 7",
              action: () => {
                setActiveCards(prevCards => {
                  const receiveLoc = playerType === "Player 1" ? "receive" : "bot_receive";
                  const receiveCard = prevCards.find(c => c.location === receiveLoc && !c.isGuts);
                  if (receiveCard && receiveCard.school === "Nekoma" && receiveCard.stats.receive >= 5) {
                    return prevCards.map(c => c.instanceId === receiveCard.instanceId ? { ...c, stats: { ...c.stats, receive: 7 } } : c);
                  } else {
                    showToast("Karakter tidak memenuhi syarat (Poin dasar harus 5 atau lebih).");
                    return prevCards;
                  }
                });
                addLog(`Efek Action Nekoma Aktif! Draw 1 kartu dan merubah poin receive karakter Nekoma menjadi 7.`);
                setPendingChoice(null);
              }
            }
          ],
          onCancel: () => setPendingChoice(null)
        });
        break;

      case "actionOikawaEvent":
        setTimeout(() => performDraw(1, playerType), 0);

        setPendingChoice({
          title: "Pilih stat Oikawa yang mau ditingkatkan",
          options: [
            {
              label: "Tingkatkan Serve Point",
              action: () => {
                setActiveCards(prevCards => {
                  const serveLoc = playerType === "Player 1" ? "serve" : "bot_serve";
                  const tossLoc = playerType === "Player 1" ? "toss" : "bot_toss";
                  const oikawaCard = prevCards.find(c => (c.location === serveLoc || c.location === tossLoc) && !c.isGuts && c.name.includes("Oikawa"));
                  if (oikawaCard) {
                    return prevCards.map(c => c.instanceId === oikawaCard.instanceId ? { ...c, stats: { ...c.stats, serve: c.stats.serve + 1 } } : c);
                  }
                  return prevCards;
                });
                addLog(`Efek Action Aoba Aktif! Draw 1 kartu dan poin Serve Oikawa bertambah +1.`);
                setPendingChoice(null);
              }
            },
            {
              label: "Tingkatkan Toss Point",
              action: () => {
                setActiveCards(prevCards => {
                  const serveLoc = playerType === "Player 1" ? "serve" : "bot_serve";
                  const tossLoc = playerType === "Player 1" ? "toss" : "bot_toss";
                  const oikawaCard = prevCards.find(c => (c.location === serveLoc || c.location === tossLoc) && !c.isGuts && c.name.includes("Oikawa"));
                  if (oikawaCard) {
                    return prevCards.map(c => c.instanceId === oikawaCard.instanceId ? { ...c, stats: { ...c.stats, toss: c.stats.toss + 1 } } : c);
                  }
                  return prevCards;
                });
                addLog(`Efek Action Aoba Aktif! Draw 1 kartu dan poin Toss Oikawa bertambah +1.`);
                setPendingChoice(null);
              }
            }
          ],
          onCancel: () => setPendingChoice(null)
        });
        break;

      case "actionIllGoAhead": {
        const receiveLoc = playerType === "Player 1" ? "receive" : "bot_receive";
        const receiveCard = activeCards.find(c => c.location === receiveLoc && !c.isGuts);

        if (receiveCard && receiveCard.school === "Karasuno") {
          setActiveCards((prevCards) =>
            prevCards.map((c) =>
              c.instanceId === receiveCard.instanceId
                ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 2 } }
                : c
            )
          );

          if (receiveCard.name.includes("Nishinoya")) {
            setTimeout(() => performDraw(1, playerType), 0);
            addLog(`Efek I'll Go Ahead Aktif! Receive Point Karasuno +2 & Draw 1 kartu (Yū Nishinoya)!`);
            showToast(`Receive +2 & Draw 1 Kartu! (Yū Nishinoya)`);
          } else {
            addLog(`Efek I'll Go Ahead Aktif! Receive Point Karasuno +2!`);
            showToast(`Receive Point Karasuno +2!`);
          }
        } else {
          showToast("Tidak ada karakter Receive Karasuno di area!");
        }
        break;
      }

      case "actionDeadOnHVD03":
        setActiveCards((prevCards) => {
          const attackCard = prevCards.find(c => c.location === (playerType === "Player 1" ? "attack" : "bot_attack") && !c.isGuts);
          if (attackCard && attackCard.school === "Karasuno") {
            return prevCards.map(c =>
              c.instanceId === attackCard.instanceId
                ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } }
                : c
            );
          }
          return prevCards;
        });

        const tossName03 = activeCards.find(c => c.location === (playerType === "Player 1" ? "toss" : "bot_toss") && !c.isGuts)?.name;
        const attackName03 = activeCards.find(c => c.location === (playerType === "Player 1" ? "attack" : "bot_attack") && !c.isGuts)?.name;

        if (tossName03?.includes("Kageyama") && attackName03?.includes("Hinata")) {
          setTimeout(() => performDraw(1, playerType), 0);
          addLog(`Efek Dead On!! (HVD-03) Aktif! Attack Point +1 & Draw 1 kartu (Kombo Kageyama & Hinata)!`);
          showToast(`Attack +1 & Draw 1 Kartu! (Kombo Kageyama & Hinata)`);
        } else {
          addLog(`Efek Dead On!! (HVD-03) Aktif! Attack Point Karasuno +1!`);
        }
        break;

      case "oikawaHVD04":
        const isItsAllRight = activeCards.some(c => c.location === (playerType === "Player 1" ? "action" : "bot_action") && c.name === "It's all right");
        if (isItsAllRight) {
          setPendingChoice({
            title: "Pilih stat Oikawa yang mau ditingkatkan",
            options: [
              {
                label: "Tingkatkan Serve Point +1",
                action: () => {
                  setActiveCards(prevCards => prevCards.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, serve: c.stats.serve + 1 } } : c));
                  addLog(`Efek Oikawa Aktif! Serve Point bertambah +1.`);
                  setPendingChoice(null);
                }
              },
              {
                label: "Tingkatkan Toss Point +1",
                action: () => {
                  setActiveCards(prevCards => prevCards.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, toss: c.stats.toss + 1 } } : c));
                  addLog(`Efek Oikawa Aktif! Toss Point bertambah +1.`);
                  setPendingChoice(null);
                }
              }
            ],
            onCancel: () => setPendingChoice(null)
          });
        } else {
          showToast("Kartu Action 'It's all right' tidak ditemukan di arena!");
          // Kembalikan status efek agar bisa dicoba lagi nanti
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "iwaizumiHVD04":
        const tossIwa = activeCards.find(c => c.location === (playerType === "Player 1" ? "toss" : "bot_toss") && !c.isGuts);
        if (tossIwa && tossIwa.school === "Aoba Jōsai") {
          const gutsIwa = activeCards.filter(c => c.isGuts && c.location === zoneId).length;
          if (gutsIwa >= 3) {
            setIsOpponentLiDisabled(true);
            addLog(`Efek Iwaizumi Aktif! Lawan tidak bisa menggunakan karakter Li di Receive Area untuk giliran ini.`);
            showToast("Efek aktif! Lawan tidak bisa menggunakan Libero!");
          } else {
            showToast("Guts tidak cukup (Minimal 3)!");
          }
        } else {
          showToast("Karakter Toss bukan dari Aoba Jōsai!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "kunimiHVD04":
        const handCount = activeCards.filter(c => c.location === (playerType === "Player 1" ? "hand" : "bot_hand")).length;
        if (handCount < 3) {
          const toDraw = 3 - handCount;
          setTimeout(() => performDraw(toDraw, playerType), 0);
          addLog(`Efek Kunimi Aktif! Draw ${toDraw} kartu.`);
          showToast(`Draw ${toDraw} Kartu!`);
        } else {
          addLog("Efek Kunimi gagal karena kartu di tangan sudah 3 atau lebih.");
          showToast("Kartu di tangan sudah 3 atau lebih.");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "drawCardIfGuts":
        const gutsCountWatari = activeCards.filter(c => c.isGuts && c.location === zoneId).length;
        if (gutsCountWatari >= (card.effectCostValue || 0)) {
          setTimeout(() => performDraw(card.effectValue || 1, playerType), 0);
          addLog(`Efek Aktif! Draw ${card.effectValue} kartu.`);
        } else {
          showToast(`Guts tidak cukup (Minimal ${card.effectCostValue})!`);
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "actionItsAllRight":
        const oikawaCount = activeCards.filter(c => (c.location === (playerType === "Player 1" ? "serve" : "bot_serve") || c.location === (playerType === "Player 1" ? "toss" : "bot_toss")) && c.name.includes("Oikawa") && !c.isGuts).length;
        if (oikawaCount > 0) {
          setPendingChoice({
            title: "Pilih stat Oikawa yang mau ditingkatkan",
            options: [
              {
                label: "Tingkatkan Serve Point +1",
                action: () => {
                  setActiveCards(prevCards => prevCards.map(c => ((c.location === (playerType === "Player 1" ? "serve" : "bot_serve") || c.location === (playerType === "Player 1" ? "toss" : "bot_toss")) && c.name.includes("Oikawa") && !c.isGuts) ? { ...c, stats: { ...c.stats, serve: c.stats.serve + 1 } } : c));
                  addLog(`Efek Action Aktif! Serve Point Oikawa bertambah +1.`);
                  const actionCount = activeCards.filter(c => c.location === (playerType === "Player 1" ? "action" : "bot_action")).length;
                  if (actionCount >= 2) {
                    setTimeout(() => performDraw(1, playerType), 0);
                    addLog(`Draw 1 kartu karena ada 2 atau lebih kartu di Action area.`);
                  }
                  setPendingChoice(null);
                }
              },
              {
                label: "Tingkatkan Toss Point +1",
                action: () => {
                  setActiveCards(prevCards => prevCards.map(c => ((c.location === (playerType === "Player 1" ? "serve" : "bot_serve") || c.location === (playerType === "Player 1" ? "toss" : "bot_toss")) && c.name.includes("Oikawa") && !c.isGuts) ? { ...c, stats: { ...c.stats, toss: c.stats.toss + 1 } } : c));
                  addLog(`Efek Action Aktif! Toss Point Oikawa bertambah +1.`);
                  const actionCount = activeCards.filter(c => c.location === (playerType === "Player 1" ? "action" : "bot_action")).length;
                  if (actionCount >= 2) {
                    setTimeout(() => performDraw(1, playerType), 0);
                    addLog(`Draw 1 kartu karena ada 2 atau lebih kartu di Action area.`);
                  }
                  setPendingChoice(null);
                }
              }
            ],
            onCancel: () => setPendingChoice(null)
          });
        } else {
          showToast("Tidak ada Tōru Oikawa di area Serve atau Toss!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "actionIBelieveInYouGuys":
        const recCard = activeCards.find(c => c.location === (playerType === "Player 1" ? "receive" : "bot_receive") && !c.isGuts);
        if (recCard && recCard.school === "Aoba Jōsai") {
          setTimeout(() => performDraw(1, playerType), 0);
          const handCnt = activeCards.filter(c => c.location === (playerType === "Player 1" ? "hand" : "bot_hand")).length;
          const boost = handCnt <= 3 ? 2 : 1;
          setActiveCards(prevCards => prevCards.map(c => c.instanceId === recCard.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + boost } } : c));
          addLog(`Efek I believe in you guys Aktif! Draw 1 kartu dan Receive Point bertambah +${boost}.`);
        } else {
          showToast("Karakter Receive bukan dari Aoba Jōsai!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "kurooHVD05":
        const isGetItActive = activeCards.some(c => c.location === (playerType === "Player 1" ? "action" : "bot_action") && c.name === "Get it! I have to stop it, get it!");
        if (isGetItActive) {
          setActiveCards(prevCards => prevCards.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, block: c.stats.block + 1 } } : c));
          setTimeout(() => performDraw(1, playerType), 0);
          addLog("Efek Kuroo Aktif! Block +1 dan Draw 1 kartu.");
        } else {
          showToast("Kartu Action 'Get it! I have to stop it, get it!' tidak ada di arena!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "levHVD05":
        const levGuts = activeCards.filter(c => c.isGuts && c.location === (playerType === "Player 1" ? "attack" : "bot_attack")).length;
        if (levGuts >= 3) {
          setActiveCards(prevCards => prevCards.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } } : c));
          addLog("Efek Lev Aktif! Attack +1 karena ada 3+ Guts.");
          const handCards = activeCards.filter(c => c.location === (playerType === "Player 1" ? "hand" : "bot_hand"));
          if (handCards.length > 0) {
            const confirm = window.confirm("Buang 1 kartu dari tangan ke Drop Area untuk mendapat tambahan +1 Attack?");
            if (confirm) {
              setPendingEffectCard({ card, playerType, zoneId });
              setIsDiscardingForEffect(true);
              showToast("Pilih 1 kartu di tangan untuk dibuang!");
            }
          }
        } else {
          showToast("Guts kurang dari 3!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "actionGetIt":
        const validNekoma = activeCards.filter(c => 
          c.school === "Nekoma" && !c.isGuts && 
          ((playerType === "Player 1" ? (c.location === "receive" || c.location === "block") : (c.location === "bot_receive" || c.location === "bot_block")))
        );
        if (validNekoma.length > 0) {
          setPendingCardSelection({
            title: "Pilih Karakter Nekoma untuk +2 Receive/Block",
            cards: validNekoma,
            onSelect: (selected) => {
              setActiveCards(prevCards => prevCards.map(c => {
                if (c.instanceId === selected.instanceId) {
                  const statToBoost = c.location.includes("block") ? "block" : "receive";
                  return { ...c, stats: { ...c.stats, [statToBoost]: c.stats[statToBoost] + 2 } };
                }
                return c;
              }));
              addLog(`Efek Get it! Aktif! Stat ${selected.name} bertambah +2.`);
              if (selected.name.includes("Kuroo") && selected.location.includes("block")) {
                setTimeout(() => performDraw(1, playerType), 0);
                addLog("Draw 1 kartu karena Kuroo di Block area!");
              }
            }
          });
        } else {
          showToast("Tidak ada karakter Nekoma di Receive atau Block area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "bokutoHVD05":
        const bokutoGuts = activeCards.filter(c => c.isGuts && c.location === (playerType === "Player 1" ? "attack" : "bot_attack")).length;
        if (bokutoGuts >= 3) {
          setActiveCards(prevCards => prevCards.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 2 } } : c));
          addLog("Efek Bokuto Aktif! Attack +2. Membuang 3 kartu teratas deck.");
          
          const targetDeck = playerType === "Player 1" ? playerDeck : botDeck;
          const cardsToMill = targetDeck.slice(0, 3);
          const hasAction = cardsToMill.some(c => c.type === "Action");
          
          if (hasAction) {
            setIsBokutoRestricted(true);
            showToast("Kartu Action terbuang dari deck! Kōtarō Bokuto tidak bisa dimainkan set ini.");
            addLog("Bokuto restricted karena kartu Action terbuang!");
          }
          
          if (playerType === "Player 1") {
            setPlayerDeck(prev => prev.slice(3));
          } else {
            setBotDeck(prev => prev.slice(3));
          }
          
          setActiveCards(prevCards => [
            ...prevCards,
            ...cardsToMill.map(c => ({ ...c, location: playerType === "Player 1" ? "drop" : "bot_drop" }))
          ]);
        } else {
          showToast("Guts kurang dari 3!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "akaashiHVD05":
        const akaashiGuts = activeCards.filter(c => c.isGuts && c.location === (playerType === "Player 1" ? "toss" : "bot_toss")).length;
        if (akaashiGuts >= 3) {
          const targetDeck = playerType === "Player 1" ? playerDeck : botDeck;
          const bokutoInDeck = targetDeck.find(c => c.name.includes("Bokuto"));
          if (bokutoInDeck) {
            if (playerType === "Player 1") {
              setPlayerDeck(prev => prev.filter(c => c.instanceId !== bokutoInDeck.instanceId).sort(() => Math.random() - 0.5));
            } else {
              setBotDeck(prev => prev.filter(c => c.instanceId !== bokutoInDeck.instanceId).sort(() => Math.random() - 0.5));
            }
            setActiveCards(prevCards => [...prevCards, { ...bokutoInDeck, location: playerType === "Player 1" ? "hand" : "bot_hand" }]);
            addLog("Efek Akaashi Aktif! Menambahkan 1 Kōtarō Bokuto dari deck ke tangan lalu mengocok deck.");
            showToast("Bokuto ditambahkan ke tangan!");
          } else {
            showToast("Tidak ada Kōtarō Bokuto di dalam deck!");
          }
        } else {
          showToast("Guts kurang dari 3!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;

      case "actionAfterAll":
        const atkLoc = playerType === "Player 1" ? "attack" : "bot_attack";
        const fukurodaniAtk = activeCards.find(c => c.location === atkLoc && c.school === "Fukurōdani" && !c.isGuts);
        if (fukurodaniAtk) {
          const tossLoc = playerType === "Player 1" ? "toss" : "bot_toss";
          const isAkaashiToss = activeCards.some(c => c.location === tossLoc && c.name.includes("Akaashi") && !c.isGuts);
          const isBokutoAtk = fukurodaniAtk.name.includes("Bokuto");
          const bonus = (isAkaashiToss && isBokutoAtk) ? 2 : 1;
          
          setActiveCards(prevCards => prevCards.map(c => c.instanceId === fukurodaniAtk.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + bonus } } : c));
          addLog(`Efek After all, I'm the strongest Aktif! Attack +${bonus}.`);
        } else {
          showToast("Karakter Attack bukan dari Fukurōdani!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
    }
  };

  const handleZoneClick = (zoneId: string) => {
    if (!selectedCard || !('location' in selectedCard) || (selectedCard as CardInstance).location !== "hand") {
      return;
    }

    if (pendingChoice) {
      showToast("Pilih dulu respon pertahanan Anda (Block atau Receive) sebelum memainkan kartu!");
      return;
    }

    if (!isPlayableZone(zoneId)) {
      showToast("Kamu tidak bisa menaruh kartu di area ini pada fase sekarang!");
      return;
    }

    const cardToDrop = selectedCard as CardInstance;

    if (
      currentTurn === "Player 2" &&
      zoneId !== "hand" &&
      !zoneId.includes("bot")
    ) {
      showToast(`Sekarang giliran Player 2!`);
      return;
    }

    if (
      currentPhase === "Serve Phase" &&
      zoneId !== "serve" &&
      zoneId !== "hand" &&
      zoneId !== "drop" &&
      zoneId !== "action"
    ) {
      showToast("Hanya bisa menaruh kartu di Serve Area atau Action Area saat awal permainan!");
      return;
    }

    if (currentPhase !== "Serve Phase" && zoneId === "serve") {
      showToast("Kotak Serve Area KUNCI! Hanya boleh diisi saat kamu menjadi server utama (awal set).");
      return;
    }

    if (zoneId !== "hand" && zoneId !== "drop") {
      if (cardToDrop.type === "Action" && zoneId !== "action") {
        showToast("Kartu Action HANYA boleh ditaruh di kotak Event Area!");
        return;
      }
      if (cardToDrop.type === "Character" && zoneId === "action") {
        showToast("Kartu Character TIDAK BOLEH ditaruh di Event Area!");
        return;
      }
    }

    if (zoneId === "block" && points.incomingAttackType === "Serve") {
      showToast(
        "Kamu tidak bisa memblokir Serve! Kamu harus menggunakan kartu di kotak Receive.",
      );
      return;
    }

    if (zoneId === "block" && points.incomingAttackType === "BlockReturn") {
      showToast("Blok tidak bisa digunakan untuk menahan pantulan blok (Block Rebound)! Gunakan Receive.");
      return;
    }

    if (zoneId === "receive" && isOpponentLiDisabled) {
      if (selectedCard && 'location' in selectedCard) {
        const cardInst = selectedCard as CardInstance;
        if (cardInst.position === "Li") {
          showToast("Karakter Li (Libero) tidak dapat diletakkan di Receive Area untuk giliran ini karena efek lawan!");
          return;
        }
      }
    }

    if (cardToDrop.name.includes("Bokuto") && isBokutoRestricted) {
      showToast("Kōtarō Bokuto tidak bisa dimainkan lagi set ini karena efek HVD-05-006!");
      return;
    }

    if (zoneId === "block" && isOpponentBlockDisabled) {
      showToast("Blokir dinonaktifkan oleh efek kombo Dead On!!");
      return;
    }

    if ((zoneId === "toss" || zoneId === "attack") && points.incomingAttack > 0) {
      if (points.defenseType === "block") {
        showToast("Kamu menggunakan Block! Tidak bisa melakukan Toss atau Attack.");
        return;
      }
      if (points.totalDefense < points.incomingAttack) {
        showToast("Poin Receive tidak cukup untuk menahan serangan! Anda belum bisa melakukan Toss dan Attack.");
        return;
      }
    }

    if (zoneId === "receive" || zoneId === "block") {
      const hasReceive = activeCards.some(c => c.location === "receive" && !c.isGuts);
      const hasBlock = activeCards.some(c => c.location === "block" && !c.isGuts);

      if (zoneId === "receive" && hasBlock) {
        showToast("Kamu sudah memilih untuk Block! Tidak bisa menggunakan Receive bersamaan.");
        return;
      }
      if (zoneId === "block" && hasReceive) {
        showToast("Kamu sudah memilih untuk Receive! Tidak bisa menggunakan Block bersamaan.");
        return;
      }
    }

    if (zoneId === "block") {
      const blockCount = activeCards.filter(
        (c) => c.location === "block" && !c.isGuts,
      ).length;
      if (blockCount >= 3) {
        showToast("Maksimal hanya 3 karakter di Block Area!");
        return;
      }
    }

    if (zoneId !== "block" && zoneId !== "hand" && zoneId !== "drop" && zoneId !== "action" && zoneId !== "bot_action") {
      const activeInZone = activeCards.filter(
        (c) => c.location === zoneId && !c.isGuts,
      ).length;
      if (activeInZone >= 1) {
        const isAlreadyThere = activeCards.some(
          (c) => c.instanceId === cardToDrop.instanceId && c.location === zoneId,
        );
        if (!isAlreadyThere) {
          showToast(`Area ${zoneId} sudah terisi!`);
          return;
        }
      }
    }

    // --- Logika Fase untuk Kartu Action ---
    // Penjelasan Logika: Mengecek apakah kartu memiliki syarat fase (phaseRestriction).
    if (cardToDrop.phaseRestriction && zoneId === "action") {
      const { phaseRestriction } = cardToDrop;
      const hasAttack = activeCards.some(c => c.location === "attack" && !c.isGuts);
      const hasReceive = activeCards.some(c => c.location === "receive" && !c.isGuts);
      const hasServe = activeCards.some(c => c.location === "serve" && !c.isGuts);
      const hasToss = activeCards.some(c => c.location === "toss" && !c.isGuts);
      const hasBlock = activeCards.some(c => c.location === "block" && !c.isGuts);

      const restrictions = phaseRestriction.split(",");
      const currentPhaseName = currentPhase.replace(" Phase", ""); // "Serve", "Receive", dll.

      if (!restrictions.includes(currentPhaseName)) {
        showToast(`Kartu ini hanya bisa dimainkan pada Fase: ${restrictions.join(" atau ")}!`);
        return;
      }

      if (currentPhaseName === "Serve" && !hasServe) {
        showToast(`Kamu harus menaruh kartu Character di Serve Area terlebih dahulu!`);
        return;
      }
      if (currentPhaseName === "Receive" && !hasReceive) {
        showToast(`Kamu harus menaruh kartu Character di Receive Area terlebih dahulu!`);
        return;
      }
      if (currentPhaseName === "Toss" && !hasToss) {
        showToast(`Kamu harus menaruh kartu Character di Toss Area terlebih dahulu!`);
        return;
      }
      if (currentPhaseName === "Attack" && !hasAttack) {
        showToast(`Kamu harus menaruh kartu Character di Attack Area terlebih dahulu!`);
        return;
      }
      if (currentPhaseName === "Block" && !hasBlock) {
        showToast(`Kamu harus menaruh kartu Character di Block Area terlebih dahulu!`);
        return;
      }
    }

    // --- Logika Aturan "Double Touch" ---
    // Penjelasan Logika: Di dalam voli, pemain yang sama tidak boleh menyentuh bola dua kali berturut-turut.
    // Jika menaruh di Toss Area, pastikan karakternya tidak sama dengan di Receive Area.
    // Jika menaruh di Attack Area, pastikan karakternya tidak sama dengan di Toss Area.
    if (zoneId === "toss") {
      const receiveCard = activeCards.find(c => c.location === "receive" && !c.isGuts);
      if (receiveCard && receiveCard.name === cardToDrop.name) {
        showToast("Pelanggaran Double Touch! Karakter yang sama tidak boleh melakukan Receive lalu Toss.");
        return;
      }
    }

    if (zoneId === "attack") {
      const tossCard = activeCards.find(c => c.location === "toss" && !c.isGuts);
      if (tossCard && tossCard.name === cardToDrop.name) {
        showToast("Pelanggaran Double Touch! Karakter yang sama tidak boleh melakukan Toss lalu Attack.");
        return;
      }
    }

    const cardId = cardToDrop.instanceId;
    if (cardId) {
      setActiveCards((prevCards) => {
        const cardToMove = prevCards.find((card) => card.instanceId === cardId);
        if (!cardToMove) return prevCards;
        const otherCards = prevCards.filter((card) => card.instanceId !== cardId);
        return [...otherCards, { ...cardToMove, location: zoneId, isEffectActive: true }];
      });

      playSound("play");
      setSelectedCard(null);

      // --- Efek Pasif: Kenma Kozume ---
      if (zoneId === "attack" && cardToDrop.type !== "Action" && cardToDrop.stats.attack >= 3) {
        // Cek apakah Kenma Kozume ada di Toss Area dan efeknya aktif
        const tossCard = activeCards.find(c => c.location === "toss" && !c.isGuts && c.name.includes("Kenma") && c.isEffectActive);
        if (tossCard) {
          const attackLoc = currentTurn === "Player 1" ? "attack" : "bot_attack";
          const gutsCharacters = activeCards.filter(c => c.isGuts && c.type !== "Action" && c.location === attackLoc);
          if (gutsCharacters.length > 0) {
            setPendingCardSelection({
              title: "Efek Kenma: Pilih Karakter dari Guts untuk menyerang",
              cards: gutsCharacters,
              onSelect: (selectedGuts) => {
                setActiveCards(prev => prev.map(c => {
                  if (c.instanceId === selectedGuts.instanceId) {
                    return { ...c, location: "attack", isGuts: false };
                  }
                  if (c.instanceId === cardId) {
                    return { ...c, location: "attack", isGuts: true, isEffectActive: false };
                  }
                  if (c.instanceId === tossCard.instanceId) {
                    return { ...c, isEffectActive: false };
                  }
                  return c;
                }));
                addLog(`Efek Kenma Aktif! Penyerang diganti dengan ${selectedGuts.name} dari Guts. Karakter awal menjadi Guts.`);
              }
            });
          }
        }
      }
    }
  };

  const handleUseEffect = () => {
    if (isDiscardingForEffect) {
      setPendingEffectCard(null);
      setIsDiscardingForEffect(false);
      return;
    }

    if (!selectedCard || !('location' in selectedCard)) return;
    const card = selectedCard as CardInstance;

    if (!card.isEffectActive) return;

    const playerType = currentTurn;
    const zoneId = card.location;

    if (card.effectCostType) {
      if (card.effectCostType === 'payGuts') {
        // Kartu guts dibuang dari area kartu tersebut berada ke drop area
        const allCardsInZone = activeCards.filter(c => c.location === zoneId);
        const gutsCards = allCardsInZone.filter(c => c.isGuts);

        if (gutsCards.length >= (card.effectCostValue || 0)) {
          const gutsToPay = gutsCards.slice(gutsCards.length - card.effectCostValue!, gutsCards.length);
          const gutsIds = gutsToPay.map(c => c.instanceId);

          setActiveCards(prev => prev.map(c => gutsIds.includes(c.instanceId) ? { ...c, location: playerType === "Player 1" ? "drop" : "bot_drop", isGuts: false } : c));

          resolveCardEffect(card, playerType, zoneId);
        } else {
          showToast("Guts tidak cukup!");
        }
      } else if (card.effectCostType === 'discardCard') {
        setIsDiscardingForEffect(true);
        setPendingEffectCard({ card, playerType, zoneId });
        showToast("Pilih 1 kartu di tanganmu untuk dibuang!");
      }
    } else {
      resolveCardEffect(card, playerType, zoneId);
    }
  };

  const handleSelectCardInGameBoard = (card: CardData | CardInstance | null) => {
    if (isDiscardingForEffect && card && 'location' in card && card.location === "hand" && pendingEffectCard) {
      const cardInst = card as CardInstance;
      setActiveCards((prev) =>
        prev.map((c) =>
          c.instanceId === cardInst.instanceId ? { ...c, location: "drop" } : c,
        ),
      );
      resolveCardEffect(pendingEffectCard.card, pendingEffectCard.playerType, pendingEffectCard.zoneId);
      setIsDiscardingForEffect(false);
      setPendingEffectCard(null);
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const isPlayableZone = (zoneId: string) => {
    if (currentTurn !== "Player 1") return false;

    if (pendingChoice) {
      return zoneId === "receive" || zoneId === "block";
    }

    if (currentPhase === "Serve Phase") {
      return zoneId === "serve" || zoneId === "action";
    }

    if (currentPhase === "Receive Phase") {
      return zoneId === "receive" || zoneId === "action";
    }

    if (currentPhase === "Toss Phase") {
      return zoneId === "toss" || zoneId === "action";
    }

    if (currentPhase === "Attack Phase") {
      return zoneId === "attack" || zoneId === "action";
    }

    if (currentPhase === "Block Phase") {
      const blockCount = activeCards.filter(c => c.location === "block" && !c.isGuts).length;
      return (zoneId === "block" && blockCount < 3) || zoneId === "action";
    }

    return false;
  };

  const handleNavigate = (screen: Screen) => {
    if (screen === "menu") {
      if (isOnline && roomCode) {
        socket.emit('leaveRoom', roomCode);
      }
      setIsOnline(false);
      setRoomCode("");
      setIsHost(false);
      setIsOpponentDisconnected(false);
      sessionStorage.removeItem('hqvgc_roomCode');
      setMatchWinner(null);
      setPlayer1Sets(0);
      setPlayer2Sets(0);
      setActiveCards([]);
    }
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    if (currentScreen === "menu") {
      return <MenuScreen onNavigate={handleNavigate} />;
    }

    if (currentScreen === "deck-selection") {
      return (
        <DeckSelectionScreen
          selectedDeckType={selectedDeckType}
          onSelectDeck={(deck) => setSelectedDeckType(deck)}
          onStartGame={startGame}
          onNavigate={handleNavigate}
          customDecks={customDecks}
        />
      );
    }

    if (currentScreen === "deck-builder") {
      return (
        <DeckBuilderScreen
          builderDeck={builderDeck}
          deckBuilderSearch={deckBuilderSearch}
          deckBuilderFilter={deckBuilderFilter}
          onSearchChange={(val) => setDeckBuilderSearch(val)}
          onFilterChange={(val) => setDeckBuilderFilter(val)}
          onAddToBuilderDeck={addToBuilderDeck}
          onRemoveFromBuilderDeck={removeFromBuilderDeck}
          onNavigate={handleNavigate}
          customDecks={customDecks}
          setCustomDecks={setCustomDecks}
          setBuilderDeck={setBuilderDeck}
        />
      );
    }

    if (currentScreen === "online-lobby") {
      return (
        <OnlineLobbyScreen
          onNavigate={handleNavigate}
          playerName={playerName}
          setPlayerName={setPlayerName}
          onJoinRoom={(code, hostFlag, isReconnect) => {
            setRoomCode(code);
            setIsOnline(true);
            sessionStorage.setItem('hqvgc_roomCode', code);
            sessionStorage.setItem('hqvgc_playerName', playerName);
            if (!isReconnect) {
              setIsHost(hostFlag);
              setCurrentScreen("online-room");
            } else {
              // If reconnecting, we let the FULL_SYNC handle everything else
              isSyncing.current = true;
              setCurrentScreen("game-board");
            }
          }}
        />
      );
    }

    if (currentScreen === "online-room") {
      return (
        <OnlineRoomScreen
          onNavigate={handleNavigate}
          playerName={playerName}
          roomCode={roomCode}
          onReady={(deckId, opponentDeckId, opponentDeckCards) => {
            setSelectedDeckType(deckId);
            if (isHost) {
              startGame(deckId, opponentDeckId || undefined, opponentDeckCards);
            }
          }}
          onOpponentNameChange={(name) => setOpponentName(name)}
          customDecks={customDecks}
        />
      );
    }

    return (
      <GameBoardScreen
        playerDeck={playerDeck}
        botDeck={botDeck}
        activeCards={activeCards}
        currentTurn={currentTurn}
        currentPhase={currentPhase}
        selectedCard={selectedCard}
        pendingEffectCard={pendingEffectCard}
        isDiscardingForEffect={isDiscardingForEffect}
        gameLogs={gameLogs}
        points={points}
        isPlayValid={isPlayValid()}
        isDiscardingForEffectState={isDiscardingForEffect}
        onSelectCard={handleSelectCardInGameBoard}
        onZoneClick={handleZoneClick}
        onUseEffect={handleUseEffect}
        onNextPhase={nextPhase}
        onDeclareBreak={handleDeclareBreak}
        onNavigate={handleNavigate}
        isPlayableZone={isPlayableZone}
        isOpponentDisconnected={isOpponentDisconnected}
        onActivateHandEffect={handleActivateHandEffect}
        pendingChoice={pendingChoice}
        playerName={playerName}
        opponentName={opponentName}
        chatMessages={chatMessages}
        onSendMessage={sendChatMessage}
        matchWinner={matchWinner}
        onReturnToMenu={() => {
          setMatchWinner(null);
          handleNavigate("menu");
          setPlayer1Sets(0);
          setPlayer2Sets(0);
          setActiveCards([]);
        }}
      />
    );
  };

  return (
    <>
      {pendingCardSelection && (
        <CardSelectionModal
          title={pendingCardSelection.title}
          cards={pendingCardSelection.cards}
          onSelect={(selected) => {
            pendingCardSelection.onSelect(selected);
            setPendingCardSelection(null);
          }}
          onCancel={() => setPendingCardSelection(null)}
        />
      )}


      {toastMessage && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 z-[9999] bg-black border-2 border-orange-500 text-orange-500 font-bold px-4 py-2 md:px-6 md:py-3 rounded-lg shadow-2xl transition-all duration-300 text-[10px] md:text-base w-[90%] max-w-[400px] md:w-auto text-center">
          {toastMessage}
        </div>
      )}
      {renderScreen()}
    </>
  );
}
