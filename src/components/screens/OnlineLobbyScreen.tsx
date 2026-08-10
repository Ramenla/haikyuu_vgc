import React, { useState, useEffect } from "react";
import { Screen } from "../../types/game";
import { socket, connectSocket } from "../../network/socket";

interface OnlineLobbyScreenProps {
  onNavigate: (screen: Screen) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  onJoinRoom: (code: string, isHost: boolean, isReconnect?: boolean) => void;
}

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({
  onNavigate,
  playerName,
  setPlayerName,
  onJoinRoom,
}) => {
  const [roomInput, setRoomInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    connectSocket();
    
    const handleRoomCreated = (data: any) => {
      onJoinRoom(data.roomCode, true);
    };

    const handleRoomJoined = (data: any) => {
      onJoinRoom(data.roomCode, false, data.isReconnect);
    };

    const handleError = (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 3000);
    };

    socket.on('roomCreated', handleRoomCreated);
    socket.on('roomJoined', handleRoomJoined);
    socket.on('error', handleError);

    return () => {
      socket.off('roomCreated', handleRoomCreated);
      socket.off('roomJoined', handleRoomJoined);
      socket.off('error', handleError);
    };
  }, [onJoinRoom]);

  const getPlayerId = () => {
    let id = sessionStorage.getItem('hqvgc_playerId');
    if (!id) {
      id = 'P-' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('hqvgc_playerId', id);
    }
    return id;
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) return setErrorMsg("Name is required");
    socket.emit('createRoom', { playerName, playerId: getPlayerId() });
  };

  const handleJoin = (code: string) => {
    if (!playerName.trim()) return setErrorMsg("Name is required");
    if (!code) return setErrorMsg("Room code is required");
    socket.emit('joinRoom', { roomCode: code, playerName, playerId: getPlayerId() });
  };

  return (
    <div className="relative h-screen w-screen bg-black text-white flex flex-col items-center justify-center font-sans p-4 overflow-hidden">
      {/* Background Effect */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('/assets/PvP_bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
      </div>
      
      {/* Header */}
      <div className="z-10 flex flex-col items-center max-w-md w-full mx-auto mb-8">
        <h1 className="text-4xl font-black mb-2 text-orange-500 tracking-tight text-center">
          PvP ONLINE LOBBY
        </h1>
        
        <div className="bg-neutral-900 border border-gray-700 rounded-lg p-3 w-full flex items-center justify-between mt-4 relative">
          <div className="flex flex-col w-full">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Player Name</span>
            <input
              type="text"
              className="bg-transparent text-white font-bold border-b-2 border-transparent focus:border-orange-500 hover:border-gray-600 px-1 py-1 outline-none text-xl w-full mt-1 transition-colors placeholder-gray-600"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={12}
              placeholder="Enter name..."
            />
          </div>
          {errorMsg && (
            <div className="absolute -top-12 left-0 right-0 bg-red-600 text-white text-center text-sm font-bold py-2 rounded">
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="z-10 flex flex-col gap-4 w-full max-w-md mx-auto">
        <button 
          onClick={handleCreateRoom}
          className="w-full py-4 bg-orange-600 text-white hover:bg-orange-700 font-black text-xl uppercase tracking-widest transition-colors rounded shadow-sm"
        >
          Create Room
        </button>

        <div className="flex bg-neutral-900 border-2 border-gray-600 rounded overflow-hidden focus-within:border-orange-500 transition-colors mt-2">
          <input
            type="text"
            placeholder="ROOM CODE"
            className="bg-transparent text-white font-bold w-full px-3 outline-none uppercase placeholder-gray-600 text-sm py-3"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <button
            onClick={() => handleJoin(roomInput)}
            disabled={!roomInput}
            className={`px-8 font-bold text-sm transition-colors ${roomInput ? "bg-orange-600 hover:bg-orange-500 text-white" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
          >
            JOIN
          </button>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={() => onNavigate("menu")}
        className="relative z-10 mt-12 text-sm text-gray-500 hover:text-white uppercase tracking-widest font-bold transition-colors border-b border-transparent hover:border-white pb-1"
      >
        ← Back to Main Menu
      </button>
    </div>
  );
};
