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
import { socket, connectSocket } from "./network/supabase";

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

  // Mencegah penempatan ganda (Double-play) di area yang sama dalam 1 giliran
  const [playedZonesThisTurn, setPlayedZonesThisTurn] = useState<string[]>([]);

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

  const recentLogsRef = useRef<Set<string>>(new Set());

  const addLog = (message: string) => {
    if (recentLogsRef.current.has(message)) return;
    recentLogsRef.current.add(message);
    setTimeout(() => {
      recentLogsRef.current.delete(message);
    }, 100);
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
          playSound("play");
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
          playSound("play");
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
      playSound("draw");
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

    // 3. Cari kartu pertahanan (Receive atau Block) yang valid (misalnya Karasuno)
    if (selectedCard.effectType === 'buffDefense' && selectedCard.effectValue) {
      const validDefCards = activeCards.filter(c => (c.location === 'receive' || c.location === 'block') && !c.isGuts && (c.location.startsWith(currentTurn === "Player 1" ? "" : "bot_")) && !c.location.startsWith(currentTurn === "Player 1" ? "bot_" : ""));
      
      const processStatChoice = (targetCard: CardInstance) => {
        setPendingChoice({
          title: `Pilih stat untuk ${targetCard.name}`,
          options: [
            {
              label: `+${selectedCard.effectValue} Receive`,
              action: () => {
                setActiveCards(prev => prev.map(c => c.instanceId === targetCard.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + selectedCard.effectValue! } } : c));
                addLog(`Efek Tangan Aktif! ${selectedCard.name} menambah Receive ${targetCard.name} sebesar ${selectedCard.effectValue}!`);
                setPendingChoice(null);
              }
            },
            {
              label: `+${selectedCard.effectValue} Block`,
              action: () => {
                setActiveCards(prev => prev.map(c => c.instanceId === targetCard.instanceId ? { ...c, stats: { ...c.stats, block: c.stats.block + selectedCard.effectValue! } } : c));
                addLog(`Efek Tangan Aktif! ${selectedCard.name} menambah Block ${targetCard.name} sebesar ${selectedCard.effectValue}!`);
                setPendingChoice(null);
              }
            }
          ],
          onCancel: () => setPendingChoice(null)
        });
      };

      if (validDefCards.length > 1) {
        setPendingCardSelection({
          title: "Pilih Karakter untuk ditingkatkan",
          cards: validDefCards,
          onSelect: (selected) => {
            processStatChoice(selected);
          }
        });
      } else if (validDefCards.length === 1) {
        processStatChoice(validDefCards[0]);
      } else {
        showToast("Tidak ada karakter bertahan yang valid!");
      }
    }

    // 4. Kosongkan pilihan kartu agar UI bersih kembali
    setSelectedCard(null);
  };

  const isPlayValid = () => {
    if (matchWinner !== null) return false;
    if (currentTurn !== "Player 1") return false;

    if (currentPhase === "Serve Phase") {
      return playedZonesThisTurn.includes("serve") && activeCards.some((c) => c.location === "serve" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Receive Phase") {
      return playedZonesThisTurn.includes("receive") && activeCards.some((c) => c.location === "receive" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Toss Phase") {
      return playedZonesThisTurn.includes("toss") && activeCards.some((c) => c.location === "toss" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Attack Phase") {
      return playedZonesThisTurn.includes("attack") && activeCards.some((c) => c.location === "attack" && !c.isGuts && c.type !== "Action");
    }
    if (currentPhase === "Block Phase") {
      return playedZonesThisTurn.includes("block") && activeCards.some((c) => c.location === "block" && !c.isGuts && c.type !== "Action");
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
          // Do not convert other opponent cards to guts automatically
          return { ...card, isEffectActive: false };
        }

        if (isCurrentPlayerLoc) {
          if (card.location.includes("block")) {
            return {
              ...card,
              location: card.location.startsWith("bot_") ? "bot_drop" : "drop",
              isEffectActive: false,
            };
          }
          // Do not convert other player cards to guts automatically
          return { ...card, isEffectActive: false };
        }

        // Paksa ubah properti isEffectActive pada SEMUA kartu lain (toss, attack, dll) di lapangan menjadi false 
        // sehingga efek sekali jalan tidak aktif lagi, namun mereka tetap berstatus !isGuts.
        if (!card.location.includes("hand") && !card.location.includes("set") && !card.location.includes("drop") && !card.location.includes("deck")) {
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

  const evaluateEndAttackPhaseTriggers = (attackingTurn: Turn) => {
    setActiveCards(prevCards => {
       let updatedCards = [...prevCards];
       let triggered = false;

       // 1. Kageyama 008 (At the end of the attack phase, if this is a Toss char, +1 Attack to Hinata <=3)
       const kageyama008 = updatedCards.find(c => c.location === (attackingTurn === "Player 1" ? "toss" : "bot_toss") && !c.isGuts && c.name.includes("Kageyama") && c.id === "HV-01-008");
       if (kageyama008) {
         const atkLoc = attackingTurn === "Player 1" ? "attack" : "bot_attack";
         const hinataAtk = updatedCards.find(c => c.location === atkLoc && !c.isGuts && c.name.includes("Hinata") && c.stats.attack <= 3);
         if (hinataAtk) {
           updatedCards = updatedCards.map(c => c.instanceId === hinataAtk.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } } : c);
           triggered = true;
           setTimeout(() => addLog(`End Attack Phase: Efek Kageyama 008 Aktif! Hinata +1 Attack!`), 100);
         }
       }
       return triggered ? updatedCards : prevCards;
    });
  };

  const requestDefenseChoice = (nextTurn: Turn, isRebound: boolean = false) => {
    evaluateEndAttackPhaseTriggers(currentTurn);
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
    setPlayedZonesThisTurn([]);
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

  useEffect(() => {
    setPlayedZonesThisTurn([]);
  }, [currentTurn]);

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
      // --- RESTORED MANUAL GUTS TRIGGERS ---
      case "hv01_028_azumaneNishinoya": {
        const serveLoc = playerType === "Player 1" ? "serve" : "bot_serve";
        const receiveLoc = playerType === "Player 1" ? "receive" : "bot_receive";
        // Check if there is Nishinoya in Receive
        const nishinoya = activeCards.find(c => c.location === receiveLoc && !c.isGuts && c.name.includes("Nishinoya"));
        // Check if Asahi (the clicked card) is in the Serve area. The user said: "guts yang dibayar adalah guts dari serve area".
        // In the game engine, playing the effect costs Guts, but the effect also reads if Asahi is in Serve.
        if (card.location === serveLoc) {
          if (nishinoya) {
            setActiveCards(prev => prev.map(c => c.instanceId === nishinoya.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 1 } } : (c.instanceId === card.instanceId ? { ...c, location: "hand", isGuts: false, isEffectActive: false, hasUsedEffect: false } : c)));
            addLog(`Efek Asahi Azumane Aktif! Nishinoya mendapat +1 Receive, dan Asahi kembali ke tangan.`);
            showToast("Asahi kembali ke tangan! Nishinoya +1 Rec.");
          } else {
            showToast("Tidak ada Yū Nishinoya di Receive area!");
            setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
          }
        } else {
          showToast("Asahi Azumane harus berada di Serve area untuk efek ini!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }
      // --- RESTORED MANUAL GUTS TRIGGERS ---
      case "hv01_016_tanakaBuff": {
        // Reads the last guts in Attack area
        const attackLoc = playerType === "Player 1" ? "attack" : "bot_attack";
        const attackGuts = activeCards.filter(c => c.location === attackLoc && c.isGuts);
        const lastAttackGuts = attackGuts.length > 0 ? attackGuts[attackGuts.length - 1] : null;
        
        if (lastAttackGuts && lastAttackGuts.name.includes("Hinata")) {
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 3 } } : c));
          addLog(`Efek Tanaka Aktif! Tanaka mendapat +3 Attack!`);
          showToast("Tanaka +3 Attack!");
        } else {
          showToast("Tanaka harus menimpa Shōyō Hinata!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }
      case "hv01_039_watariDraw": {
        const myActive = activeCards.filter(c => !c.location.startsWith(playerType === "Player 1" ? "bot_" : "bot_") && !c.isGuts);
        const allAoba = myActive.every(c => c.school === "Aoba Jōsai");
        if (allAoba) {
          setTimeout(() => performDraw(1, playerType), 0);
          addLog(`Efek Watari Aktif! Draw 1 kartu.`);
          showToast("Watari: Draw 1 kartu!");
        } else {
          showToast("Tidak semua karakter dari Aoba Jōsai!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }
      case "hv01_041_oikawaTossBoost": {
        const atkLoc = playerType === "Player 1" ? "attack" : "bot_attack";
        const aobaAtk = activeCards.find(c => c.location === atkLoc && !c.isGuts && c.school === "Aoba Jōsai");
        if (aobaAtk) {
          setActiveCards(prev => prev.map(c => c.instanceId === aobaAtk.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } } : c));
          addLog(`Efek Oikawa Toss Aktif! ${aobaAtk.name} Attack +1!`);
          showToast(`${aobaAtk.name} Attack +1!`);
        } else {
          showToast("Tidak ada karakter Aoba Jōsai di Attack area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }
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
        const isItsAllRight = activeCards.some(c => c.location === (playerType === "Player 1" ? "action" : "bot_action") && c.name === "It's all right" && !c.isGuts);
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
        const isGetItActive = activeCards.some(c => c.location === (playerType === "Player 1" ? "action" : "bot_action") && c.name === "Get it! I have to stop it, get it!" && !c.isGuts);
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

      // ============ HV-01 BOOSTER PACK EFFECTS ============

      case "hv01_001_hinataKageyama": {
        // If Toss character is Kageyama, Attack+2
        const tossLoc001 = playerType === "Player 1" ? "toss" : "bot_toss";
        const tossCard001 = activeCards.find(c => c.location === tossLoc001 && !c.isGuts && c.name.includes("Kageyama"));
        if (tossCard001) {
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 2 } } : c));
          addLog(`Efek HV-01 Hinata Aktif! Kageyama di Toss → Attack +2!`);
          showToast("Kombo Hinata-Kageyama! Attack +2!");
        } else {
          showToast("Karakter Toss bukan Tobio Kageyama!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }


      case "hv01_012_sugawaraReturnAction": {
        // If all characters are Karasuno, return 1 action card from action area to hand
        const allCharsKarasuno = activeCards.filter(c => !c.isGuts && c.type === "Character" && (c.location.startsWith(playerType === "Player 1" ? "" : "bot_")) && !c.location.includes("hand") && !c.location.includes("deck") && !c.location.includes("drop"))
          .filter(c => playerType === "Player 1" ? !c.location.startsWith("bot_") : c.location.startsWith("bot_"))
          .every(c => c.school === "Karasuno");
        
        if (!allCharsKarasuno) {
          showToast("Semua karakter harus dari Karasuno!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
          break;
        }
        
        const actionLoc = playerType === "Player 1" ? "action" : "bot_action";
        const actionCards012 = activeCards.filter(c => c.location === actionLoc && !c.isGuts);
        if (actionCards012.length > 0) {
          setPendingCardSelection({
            title: "Pilih kartu Action untuk dikembalikan ke tangan",
            cards: actionCards012,
            onSelect: (selected) => {
              setActiveCards(prev => prev.map(c => c.instanceId === selected.instanceId ? { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand" } : c));
              addLog(`Efek Sugawara Aktif! ${selected.name} dikembalikan dari Action area ke tangan.`);
            }
          });
        } else {
          showToast("Tidak ada kartu Action di Action area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_014_sugawaraRecoverDrop": {
        // Return Azumane or Nishinoya from drop to hand
        const dropLoc014 = playerType === "Player 1" ? "drop" : "bot_drop";
        const validDropCards = activeCards.filter(c => c.location === dropLoc014 && (c.name.includes("Azumane") || c.name.includes("Nishinoya")));
        if (validDropCards.length > 0) {
          setPendingCardSelection({
            title: "Pilih Azumane atau Nishinoya dari Drop area",
            cards: validDropCards,
            onSelect: (selected) => {
              setActiveCards(prev => prev.map(c => c.instanceId === selected.instanceId ? { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand" } : c));
              addLog(`Efek Sugawara Aktif! ${selected.name} dikembalikan dari Drop ke tangan.`);
            }
          });
        } else {
          showToast("Tidak ada Azumane atau Nishinoya di Drop area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_016_tanakaOnHinata": {
        // When Tanaka appears on Hinata (Hinata is guts in Attack), Attack+3
        const atkLoc016 = playerType === "Player 1" ? "attack" : "bot_attack";
        const hinataGuts016 = activeCards.find(c => c.isGuts && c.location === atkLoc016 && c.name.includes("Hinata"));
        if (hinataGuts016) {
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 3 } } : c));
          addLog(`Efek Tanaka Aktif! Menggantikan Hinata → Attack +3!`);
          showToast("Tanaka on Hinata! Attack +3!");
        } else {
          showToast("Hinata tidak ada sebagai Guts di Attack area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_023_yamaguchiTsukishima": {
        // If Attack character is Tsukishima, Receive+2
        const atkLoc023 = playerType === "Player 1" ? "attack" : "bot_attack";
        const tsukishimaAtk = activeCards.find(c => c.location === atkLoc023 && !c.isGuts && c.name.includes("Tsukishima"));
        if (tsukishimaAtk) {
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 2 } } : c));
          addLog(`Efek Yamaguchi Aktif! Tsukishima di Attack → Receive +2!`);
          showToast("Yamaguchi Receive +2!");
        } else {
          addLog(`Efek Yamaguchi tidak aktif: Tsukishima tidak ada di Attack area.`);
        }
        break;
      }

      case "hv01_024_nishinoyaAzumane": {
        // When Azumane enters Attack, add 1 to Attack, return Nishinoya to hand
        // This triggers from Nishinoya in Receive when Azumane is placed in Attack
        const atkLoc024 = playerType === "Player 1" ? "attack" : "bot_attack";
        const azumaneAtk = activeCards.find(c => c.location === atkLoc024 && !c.isGuts && c.name.includes("Azumane"));
        if (azumaneAtk) {
          setActiveCards(prev => prev.map(c => {
            if (c.instanceId === azumaneAtk.instanceId) return { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } };
            if (c.instanceId === card.instanceId) return { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand", isGuts: false, isEffectActive: false };
            return c;
          }));
          addLog(`Efek Nishinoya Aktif! Azumane Attack +1, Nishinoya kembali ke tangan!`);
          showToast("Nishinoya → Azumane Attack +1!");
        } else {
          showToast("Azumane tidak ada di Attack area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_026_nishinoyaBoostReceive": {
        // When Karasuno non-Nishinoya replaces this in Receive, that card gets Receive+2
        // This is a passive effect that triggers when a new card replaces Nishinoya
        // Since the card replacing is the NEW receive card, we boost the current receive card
        const recLoc026 = playerType === "Player 1" ? "receive" : "bot_receive";
        const newReceiveCard = activeCards.find(c => c.location === recLoc026 && !c.isGuts && c.school === "Karasuno" && !c.name.includes("Nishinoya"));
        if (newReceiveCard) {
          setActiveCards(prev => prev.map(c => c.instanceId === newReceiveCard.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 2 } } : c));
          addLog(`Efek Nishinoya Aktif! Karakter Karasuno pengganti mendapat Receive +2!`);
        } else {
          addLog(`Efek Nishinoya HV-01-026 tidak aktif.`);
            }
        break;
      }

      case "hv01_033_kindaichiDebuff":

      case "hv01_039_watari": {
        // All Aoba -> Receive+1 automatically, then pay 2 guts -> draw 1
        const fieldCards039 = activeCards.filter(c => !c.isGuts && c.type === "Character" && !c.location.includes("hand") && !c.location.includes("deck") && !c.location.includes("drop"))
          .filter(c => playerType === "Player 1" ? !c.location.startsWith("bot_") : c.location.startsWith("bot_"));
        const allAoba039 = fieldCards039.every(c => c.school === "Aoba Jōsai");
        
        if (allAoba039) {
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 1 } } : c));
          setTimeout(() => performDraw(1, playerType), 0);
          addLog(`Efek Watari Aktif! Receive +1 dan Draw 1 kartu!`);
          showToast("Watari Receive +1 & Draw 1!");
        } else {
          // Still get Receive+1 if all Aoba, otherwise nothing
          showToast("Tidak semua karakter dari Aoba Jōsai!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }


      case "hv01_045_shimadaBlockSetter": {
        // Enter Serve, opponent can't put S position in Toss next turn
        setIsOpponentLiDisabled(true); // Reuse Li disabled to block S position (simplified)
        addLog(`Efek Shimada Aktif! Lawan tidak bisa menaruh karakter S di Toss area giliran depan!`);
        showToast("Shimada: Setter lawan dikunci!");
        break;
      }

      // === HV-01 ACTION CARDS ===

      case "hv01_047_iveDoneIt": {
        // Draw Phase: Draw 1, then optionally pay 2 guts to draw 1 more
        setTimeout(() => performDraw(1, playerType), 0);
        addLog(`Efek I've done it Aktif! Draw 1 kartu.`);
        // Check if player has guts to pay for extra draw
        const allGuts047 = activeCards.filter(c => c.isGuts && (playerType === "Player 1" ? !c.location.startsWith("bot_") : c.location.startsWith("bot_")));
        if (allGuts047.length >= 2) {
          setPendingChoice({
            title: "Bayar 2 Guts untuk Draw 1 kartu tambahan?",
            options: [
              {
                label: "Ya, bayar 2 Guts",
                action: () => {
                  const gutsToPay = allGuts047.slice(0, 2);
                  setActiveCards(prev => prev.map(c => gutsToPay.some(g => g.instanceId === c.instanceId) ? { ...c, location: playerType === "Player 1" ? "drop" : "bot_drop", isGuts: false } : c));
                  setTimeout(() => performDraw(1, playerType), 100);
                  addLog(`Membayar 2 Guts → Draw 1 kartu tambahan!`);
                  setPendingChoice(null);
                }
              },
              {
                label: "Tidak",
                action: () => setPendingChoice(null)
              }
            ],
            onCancel: () => setPendingChoice(null)
          });
        }
        break;
      }

      case "hv01_048_illTakeTheBall": {
        // Toss Phase: Kageyama Toss+1, then optionally discard from hand to return Hinata from drop
        const tossLoc048 = playerType === "Player 1" ? "toss" : "bot_toss";
        const kageyamaToss048 = activeCards.find(c => c.location === tossLoc048 && !c.isGuts && c.name.includes("Kageyama"));
        if (kageyamaToss048) {
          setActiveCards(prev => prev.map(c => c.instanceId === kageyamaToss048.instanceId ? { ...c, stats: { ...c.stats, toss: c.stats.toss + 1 } } : c));
          addLog(`Efek I'll take the ball! Aktif! Kageyama Toss +1!`);
        }
        // Optionally discard to return Hinata from drop
        const dropLoc048 = playerType === "Player 1" ? "drop" : "bot_drop";
        const hinataDrop = activeCards.filter(c => c.location === dropLoc048 && c.name.includes("Hinata"));
        const handLoc048 = playerType === "Player 1" ? "hand" : "bot_hand";
        const handCards048 = activeCards.filter(c => c.location === handLoc048);
        if (hinataDrop.length > 0 && handCards048.length > 0) {
          setPendingChoice({
            title: "Buang 1 kartu dari tangan untuk mengembalikan Hinata dari Drop?",
            options: [
              {
                label: "Ya",
                action: () => {
                  setPendingEffectCard({ card: { ...card, effectType: "hv01_048_returnHinata" } as CardInstance, playerType, zoneId });
                  setIsDiscardingForEffect(true);
                  showToast("Pilih kartu di tangan untuk dibuang!");
                  setPendingChoice(null);
                }
              },
              {
                label: "Tidak",
                action: () => setPendingChoice(null)
              }
            ],
            onCancel: () => setPendingChoice(null)
          });
        }
        break;
      }

      case "hv01_048_returnHinata": {
        // After discarding, return Hinata from drop
        const dropLoc048r = playerType === "Player 1" ? "drop" : "bot_drop";
        const hinataDropCards = activeCards.filter(c => c.location === dropLoc048r && c.name.includes("Hinata"));
        if (hinataDropCards.length > 0) {
          if (hinataDropCards.length === 1) {
            setActiveCards(prev => prev.map(c => c.instanceId === hinataDropCards[0].instanceId ? { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand" } : c));
            addLog(`Hinata dikembalikan dari Drop ke tangan!`);
          } else {
            setPendingCardSelection({
              title: "Pilih Hinata untuk dikembalikan ke tangan",
              cards: hinataDropCards,
              onSelect: (selected) => {
                setActiveCards(prev => prev.map(c => c.instanceId === selected.instanceId ? { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand" } : c));
                addLog(`${selected.name} dikembalikan dari Drop ke tangan!`);
              }
            });
          }
        }
        break;
      }

      case "hv01_049_tossToMe": {
        // Toss Phase: Put Kageyama guts into Toss area, then optionally discard to return non-self action
        const tossLoc049 = playerType === "Player 1" ? "toss" : "bot_toss";
        const kageyamaGuts049 = activeCards.filter(c => c.isGuts && c.location === tossLoc049 && c.name.includes("Kageyama"));
        if (kageyamaGuts049.length > 0) {
          // Put guts Kageyama as active toss character (un-guts it)
          setActiveCards(prev => {
            const currentTossMain = prev.find(c => c.location === tossLoc049 && !c.isGuts);
            return prev.map(c => {
              if (c.instanceId === kageyamaGuts049[0].instanceId) return { ...c, isGuts: false };
              if (currentTossMain && c.instanceId === currentTossMain.instanceId) return { ...c, isGuts: true };
              return c;
            });
          });
          addLog(`Kageyama dari Guts menjadi karakter Toss aktif!`);
        }
        // Optionally discard to return action card
        const actionLoc049 = playerType === "Player 1" ? "action" : "bot_action";
        const actionCards049 = activeCards.filter(c => c.location === actionLoc049 && !c.name.includes("Toss to me"));
        const handLoc049 = playerType === "Player 1" ? "hand" : "bot_hand";
        const handCards049 = activeCards.filter(c => c.location === handLoc049);
        if (actionCards049.length > 0 && handCards049.length > 0) {
          setPendingChoice({
            title: "Buang 1 kartu dari tangan untuk mengambil kartu Action dari Action area?",
            options: [
              {
                label: "Ya",
                action: () => {
                  setPendingEffectCard({ card: { ...card, effectType: "hv01_049_returnAction" } as CardInstance, playerType, zoneId });
                  setIsDiscardingForEffect(true);
                  showToast("Pilih kartu di tangan untuk dibuang!");
                  setPendingChoice(null);
                }
              },
              {
                label: "Tidak",
                action: () => setPendingChoice(null)
              }
            ],
            onCancel: () => setPendingChoice(null)
          });
        }
        break;
      }

      case "hv01_049_returnAction": {
        const actionLoc049r = playerType === "Player 1" ? "action" : "bot_action";
        const actionCards049r = activeCards.filter(c => c.location === actionLoc049r && !c.name.includes("Toss to me"));
        if (actionCards049r.length > 0) {
          setPendingCardSelection({
            title: "Pilih kartu Action untuk dikembalikan ke tangan",
            cards: actionCards049r,
            onSelect: (selected) => {
              setActiveCards(prev => prev.map(c => c.instanceId === selected.instanceId ? { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand" } : c));
              addLog(`${selected.name} dikembalikan dari Action area ke tangan!`);
            }
          });
        }
        break;
      }

      case "hv01_050_callTheToss": {
        // Receive/Attack: Nishinoya/Azumane Receive+2 or Attack+1
        const recLoc050 = playerType === "Player 1" ? "receive" : "bot_receive";
        const atkLoc050 = playerType === "Player 1" ? "attack" : "bot_attack";
        const validTargets050 = activeCards.filter(c => 
          (c.location === recLoc050 || c.location === atkLoc050) && 
          !c.isGuts && 
          (c.name.includes("Nishinoya") || c.name.includes("Azumane"))
        );
        
        const processCallTheTossChoice = (targetCard: CardInstance) => {
          setPendingChoice({
            title: `Pilih stat untuk ${targetCard.name}`,
            options: [
              {
                label: `+2 Receive`,
                action: () => {
                  setActiveCards(prev => prev.map(c => c.instanceId === targetCard.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 2 } } : c));
                  addLog(`Efek Call The Toss Again Aktif! ${targetCard.name} Receive +2!`);
                  setPendingChoice(null);
                }
              },
              {
                label: `+1 Attack`,
                action: () => {
                  setActiveCards(prev => prev.map(c => c.instanceId === targetCard.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } } : c));
                  addLog(`Efek Call The Toss Again Aktif! ${targetCard.name} Attack +1!`);
                  setPendingChoice(null);
                }
              }
            ],
            onCancel: () => setPendingChoice(null)
          });
        };

        if (validTargets050.length > 1) {
          setPendingCardSelection({
            title: "Pilih Karakter Nishinoya/Azumane",
            cards: validTargets050,
            onSelect: (selected) => {
              processCallTheTossChoice(selected);
            }
          });
        } else if (validTargets050.length === 1) {
          processCallTheTossChoice(validTargets050[0]);
        } else {
          showToast("Tidak ada Nishinoya/Azumane di Receive atau Attack area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_051_dontQuitAce": {
        // Attack Phase: Draw 1, if Sugawara Toss + Azumane Attack -> Attack+1
        setTimeout(() => performDraw(1, playerType), 0);
        const tossLoc051 = playerType === "Player 1" ? "toss" : "bot_toss";
        const atkLoc051 = playerType === "Player 1" ? "attack" : "bot_attack";
        const sugawaraToss = activeCards.find(c => c.location === tossLoc051 && !c.isGuts && c.name.includes("Sugawara"));
        const azumaneAtk051 = activeCards.find(c => c.location === atkLoc051 && !c.isGuts && c.name.includes("Azumane"));
        if (sugawaraToss && azumaneAtk051) {
          setActiveCards(prev => prev.map(c => c.instanceId === azumaneAtk051.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } } : c));
          addLog(`Efek Don't Quit Ace Aktif! Draw 1 + Kombo Sugawara-Azumane: Attack +1!`);
          showToast("Sugawara → Azumane Attack +1!");
        } else {
          addLog(`Efek Don't Quit Ace: Draw 1 kartu.`);
        }
        break;
      }

      case "hv01_052_oneStep": {
        // Draw Phase: Draw 1, if hand ≤3 draw 1 more
        setTimeout(() => performDraw(1, playerType), 0);
        const handLoc052 = playerType === "Player 1" ? "hand" : "bot_hand";
        const handCount052 = activeCards.filter(c => c.location === handLoc052).length;
        if (handCount052 <= 3) {
          setTimeout(() => performDraw(1, playerType), 100);
          addLog(`Efek One Step Aktif! Draw 1 + Draw 1 tambahan (tangan ≤3)!`);
        } else {
          addLog(`Efek One Step: Draw 1 kartu.`);
        }
        break;
      }

      case "hv01_054_youGuysAreStrong": {
        // Attack Phase: Draw 1, Karasuno Attack characters with Attack≤4 get +1
        setTimeout(() => performDraw(1, playerType), 0);
        const atkLoc054 = playerType === "Player 1" ? "attack" : "bot_attack";
        setActiveCards(prev => prev.map(c => {
          if (c.location === atkLoc054 && !c.isGuts && c.school === "Karasuno" && c.stats.attack <= 4) {
            return { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } };
          }
          return c;
        }));
        addLog(`Efek You guys are strong Aktif! Draw 1 + Karasuno Attack (≤4) mendapat +1!`);
        break;
      }

      case "hv01_055_superiorClumsiness": {
        // Receive/Block Phase: Draw 1, then +2 to Tanaka or 1st Year Karasuno
        setTimeout(() => performDraw(1, playerType), 0);
        const recLoc055 = playerType === "Player 1" ? "receive" : "bot_receive";
        const blkLoc055 = playerType === "Player 1" ? "block" : "bot_block";
        const validTargets055 = activeCards.filter(c => 
          (c.location === recLoc055 || c.location === blkLoc055) && !c.isGuts && c.school === "Karasuno" &&
          (c.name.includes("Tanaka") || c.year === "First Year")
        );
        
        const processClumsinessChoice = (targetCard: CardInstance) => {
          setPendingChoice({
            title: `Pilih stat untuk ${targetCard.name}`,
            options: [
              {
                label: "+2 Receive",
                action: () => {
                  setActiveCards(prev => prev.map(c => c.instanceId === targetCard.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 2 } } : c));
                  addLog(`Efek Superior Clumsiness Aktif! Draw 1 + ${targetCard.name} Receive +2!`);
                  setPendingChoice(null);
                }
              },
              {
                label: "+2 Block",
                action: () => {
                  setActiveCards(prev => prev.map(c => c.instanceId === targetCard.instanceId ? { ...c, stats: { ...c.stats, block: c.stats.block + 2 } } : c));
                  addLog(`Efek Superior Clumsiness Aktif! Draw 1 + ${targetCard.name} Block +2!`);
                  setPendingChoice(null);
                }
              }
            ],
            onCancel: () => setPendingChoice(null)
          });
        };

        if (validTargets055.length > 1) {
          setPendingCardSelection({
            title: "Pilih Karakter untuk ditingkatkan",
            cards: validTargets055,
            onSelect: (selected) => {
              processClumsinessChoice(selected);
            }
          });
        } else if (validTargets055.length === 1) {
          processClumsinessChoice(validTargets055[0]);
        } else {
          addLog(`Efek Superior Clumsiness: Draw 1 kartu. (Tidak ada target valid untuk stat boost)`);
        }
        break;
      }

      case "hv01_056_strongestAlly": {
        // Draw Phase: Return Hinata or Kageyama from drop to hand
        const dropLoc056 = playerType === "Player 1" ? "drop" : "bot_drop";
        const validDrop056 = activeCards.filter(c => c.location === dropLoc056 && (c.name.includes("Hinata") || c.name.includes("Kageyama")));
        if (validDrop056.length > 0) {
          setPendingCardSelection({
            title: "Pilih Hinata atau Kageyama dari Drop area",
            cards: validDrop056,
            onSelect: (selected) => {
              setActiveCards(prev => prev.map(c => c.instanceId === selected.instanceId ? { ...c, location: playerType === "Player 1" ? "hand" : "bot_hand" } : c));
              addLog(`Efek This time I'm the strongest ally Aktif! ${selected.name} kembali ke tangan!`);
            }
          });
        } else {
          showToast("Tidak ada Hinata/Kageyama di Drop area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_057_teamCalled": {
        // Attack Phase: Put NA from drop to Attack, then optionally pay 1 guts -> Attack+1
        const dropLoc057 = playerType === "Player 1" ? "drop" : "bot_drop";
        const naInDrop = activeCards.filter(c => c.location === dropLoc057 && c.type === "Character" && c.school === "Neighborhood Association");
        if (naInDrop.length > 0) {
          setPendingCardSelection({
            title: "Pilih karakter Neighborhood Association dari Drop",
            cards: naInDrop,
            onSelect: (selected) => {
              const atkLoc057 = playerType === "Player 1" ? "attack" : "bot_attack";
              setActiveCards(prev => prev.map(c => c.instanceId === selected.instanceId ? { ...c, location: atkLoc057, isGuts: false, isEffectActive: true } : c));
              addLog(`${selected.name} dimainkan dari Drop ke Attack area!`);
              // Optionally pay 1 guts for +1
              setPendingChoice({
                title: `Bayar 1 Guts dari ${selected.name} untuk Attack +1?`,
                options: [
                  {
                    label: "Ya",
                    action: () => {
                      const gutsInAtk = activeCards.filter(c => c.isGuts && c.location === atkLoc057);
                      if (gutsInAtk.length >= 1) {
                        setActiveCards(prev => prev.map(c => {
                          if (c.instanceId === gutsInAtk[0].instanceId) return { ...c, location: playerType === "Player 1" ? "drop" : "bot_drop", isGuts: false };
                          if (c.instanceId === selected.instanceId) return { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } };
                          return c;
                        }));
                        addLog(`Membayar 1 Guts → ${selected.name} Attack +1!`);
                      }
                      setPendingChoice(null);
                    }
                  },
                  { label: "Tidak", action: () => setPendingChoice(null) }
                ],
                onCancel: () => setPendingChoice(null)
              });
            }
          });
        } else {
          showToast("Tidak ada karakter Neighborhood Association di Drop area!");
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_058_sawamuraKun": {
        // Attack Phase: Name a card, if opponent plays it next turn, they lose 1 guts
        const cardName058 = window.prompt("Sebutkan nama kartu Karasuno yang ingin dikunci:");
        if (cardName058 && cardName058.trim()) {
          addLog(`Efek Sawamura-kun Aktif! Kartu "${cardName058.trim()}" dikunci. Jika lawan memainkannya, 1 Guts akan dibuang!`);
          showToast(`Kartu "${cardName058.trim()}" dikunci!`);
          // Note: Full cross-turn enforcement would need a modifier state
        } else {
          setActiveCards(prev => prev.map(c => c.instanceId === card.instanceId ? { ...c, isEffectActive: true, hasUsedEffect: false } : c));
        }
        break;
      }

      case "hv01_059_nextTimeWeWin": {
        // Attack Phase: Draw 1, if Attack is Aoba -> opponent Attack -2 next turn
        setTimeout(() => performDraw(1, playerType), 0);
        const atkLoc059 = playerType === "Player 1" ? "attack" : "bot_attack";
        const aobaAtk059 = activeCards.find(c => c.location === atkLoc059 && !c.isGuts && c.school === "Aoba Jōsai");
        if (aobaAtk059) {
          addLog(`Efek Next time we will definitely win Aktif! Draw 1 + Debuff Attack -2 untuk lawan giliran depan!`);
          showToast("Draw 1 + Debuff aktif!");
        } else {
          addLog(`Efek Next time: Draw 1 kartu.`);
        }
        break;
      }
    }
  };

  const handleZoneClick = (zoneId: string) => {
    console.log("[DEBUG ZONE CLICK] zoneId:", zoneId);
    console.log("[DEBUG ZONE CLICK] selectedCard:", selectedCard);
    console.log("[DEBUG ZONE CLICK] activeCards length:", activeCards.length);
    const cardsInZone = activeCards.filter(c => c.location === zoneId);
    console.log(`[DEBUG ZONE CLICK] ALL cards in ${zoneId}:`, JSON.parse(JSON.stringify(cardsInZone)));
    const _replacedCard = activeCards.find(c => c.location === zoneId && !c.isGuts && c.type !== "Action" && zoneId !== "block");
    console.log("[DEBUG ZONE CLICK] replacedCard evaluated to:", _replacedCard);

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

    // Area terisi logic dihapus untuk memungkinkan Baton Pass / Menimpa kartu.

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

    if (zoneId !== "hand" && zoneId !== "drop" && zoneId !== "action") {
      if (playedZonesThisTurn.includes(zoneId)) {
        showToast("Kamu hanya bisa menaruh 1 kartu di area ini pada giliran ini!");
        return;
      }
    }

    const cardId = cardToDrop.instanceId;
    if (cardId) {
      if (zoneId !== "hand" && zoneId !== "drop" && zoneId !== "action") {
        setPlayedZonesThisTurn(prev => [...prev, zoneId]);
      }

      const replacedCard = activeCards.find(c => c.location === zoneId && !c.isGuts && c.type !== "Action" && zoneId !== "block");
      
      setActiveCards((prevCards) => {
        const cardToMove = prevCards.find((card) => card.instanceId === cardId);
        if (!cardToMove) return prevCards;
        
        return prevCards.map(c => {
          if (c.instanceId === cardId) {
            return { ...c, location: zoneId as any, isEffectActive: true };
          }
          if (replacedCard && c.instanceId === replacedCard.instanceId) {
             return { ...c, isGuts: true };
          }
          return c;
        });
      });

      playSound("play");
      setSelectedCard(null);

      
      // --- Auto Trigger Evaluator ---
      setTimeout(() => {
        setActiveCards(currentCards => {
          let updatedCards = [...currentCards];
          let updatedLog = "";
          let requiresChoice = null;
          let isOpBlockDisabled = isOpponentBlockDisabled;
          
          const placedCard = updatedCards.find(c => c.instanceId === cardId);
          if (!placedCard) return currentCards;
          
          // 1. Hinata 002 (Baton pass)
          if (replacedCard && replacedCard.id === "HV-01-002" && placedCard.school === "Karasuno" && placedCard.type === "Character" && placedCard.location.includes("attack")) {
            isOpBlockDisabled = true;
            updatedLog += (updatedLog ? "\n" : "") + "Efek HV-01 Hinata Aktif! Opponent Block Disabled!";
          }
          // 2. Kageyama 005 (When Hinata placed in Attack, Kageyama in Toss)
          if (placedCard.name.includes("Hinata") && placedCard.location.includes("attack")) {
            const kageyama = updatedCards.find(c => c.location.includes("toss") && !c.isGuts && c.id === "HV-01-005");
            if (kageyama) {
              updatedCards = updatedCards.map(c => c.instanceId === placedCard.instanceId ? { ...c, stats: { ...c.stats, attack: c.stats.attack + 1 } } : c);
              isOpBlockDisabled = true;
              updatedLog += (updatedLog ? "\n" : "") + "Efek Kageyama Quick Aktif! Hinata +1 Attack & Opponent Block Disabled!";
            }
          }

          // 4. Yamaguchi 023 (Placed in receive, Tsukishima in attack)
          if (placedCard.id === "HV-01-023" && placedCard.location.includes("receive")) {
             const attackLoc = placedCard.location.startsWith("bot_") ? "bot_attack" : "attack";
             const activeAttack = updatedCards.find(c => c.location === attackLoc && !c.isGuts);
             
             if (activeAttack && activeAttack.name.includes("Tsukishima")) {
               updatedCards = updatedCards.map(c => c.instanceId === placedCard.instanceId ? { ...c, stats: { ...c.stats, receive: c.stats.receive + 2 } } : c);
               updatedLog += (updatedLog ? "\n" : "") + "Efek Yamaguchi Aktif! Tsukishima ada di Attack Area, Yamaguchi +2 Receive!";
             }
          }
          // 5. Nishinoya 026 (Baton pass)
          if (replacedCard && replacedCard.id === "HV-01-026") {
             if (placedCard && placedCard.school && placedCard.school.trim() === "Karasuno" && placedCard.location === "receive" && placedCard.id !== "HV-01-026") {
                updatedCards = updatedCards.map(c => {
                   if (c.instanceId === placedCard.instanceId) {
                      return {
                         ...c,
                         stats: { ...c.stats, receive: (c.stats.receive || 0) + 2 }
                      };
                   }
                   return c;
                });
                updatedLog += (updatedLog ? "\n" : "") + "Efek Nishinoya (Guts) aktif! Karakter baru mendapat +2 Receive!";
             }
          }

          // 7. Kindaichi 033 & Hanamaki 036 (Baton pass on Aoba Josai)
          if (replacedCard && replacedCard.school === "Aoba Jōsai" && (placedCard.id === "HV-01-033" || placedCard.id === "HV-01-036") && placedCard.location.includes("attack")) {
            // Apply debuff marker (simply applying -2 to current opponent attack if exists, or using a global state)
            // For now, let's just log it. A continuous aura is complex without a global state flag.
            updatedLog += (updatedLog ? "\n" : "") + "Efek Kindaichi/Hanamaki: Attack lawan akan -2 (Marker diterapkan).";
            // We can add a property or effect marker to the activeCards.
          }

          // 10. Mori 046 (When Neighborhood Attack appears)
          if (placedCard.school === "Neighborhood Association" && placedCard.location.includes("attack")) {
            const mori = updatedCards.find(c => c.location.includes("receive") && !c.isGuts && c.id === "HV-01-046");
            if (mori) {
              setTimeout(() => performDraw(1, "Player 1"), 0);
              updatedLog += (updatedLog ? "\n" : "") + "Efek Mori aktif! Draw 1 kartu.";
            }
          }
          // 11. Oikawa 040 Aura (Opponent plays Attack)
          if (placedCard.location.includes("attack")) {
            const isBotPlay = placedCard.location.startsWith("bot_");
            const opponentServeLoc = isBotPlay ? "serve" : "bot_serve"; // Opposite of player
            const oikawa040 = updatedCards.find(c => c.location === opponentServeLoc && !c.isGuts && c.id === "HV-01-040");
            if (oikawa040) {
              updatedCards = updatedCards.map(c => c.instanceId === placedCard.instanceId ? { ...c, stats: { ...c.stats, attack: Math.max(0, c.stats.attack - 2) } } : c);
              updatedLog += (updatedLog ? "\n" : "") + "Efek Oikawa (Serve) Aktif! Karakter Attack lawan menerima -2 Attack!";
            }
          }
          
          if (updatedLog) setTimeout(() => addLog(updatedLog), 100);
          if (isOpBlockDisabled !== isOpponentBlockDisabled) setIsOpponentBlockDisabled(isOpBlockDisabled);
          if (requiresChoice) setTimeout(() => setPendingChoice(requiresChoice), 200);

          return updatedCards;
        });
      }, 0);
      
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
