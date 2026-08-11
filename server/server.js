const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3002;

// In-memory state of active rooms
const rooms = {};
const socketMap = {};
const disconnectTimers = {};

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create Room
  socket.on('createRoom', ({ playerName, playerId }) => {
    if (!playerId) playerId = socket.id; // fallback

    let code = generateRoomCode();
    while (rooms[code]) {
      code = generateRoomCode();
    }

    rooms[code] = {
      players: {
        [playerId]: {
          socketId: socket.id,
          id: playerId,
          name: playerName,
          deckId: null,
          deckCards: [],
          isReady: false,
          isHost: true,
          connected: true
        }
      },
      status: 'waiting' // waiting, full, starting, playing
    };

    socketMap[socket.id] = { roomCode: code, playerId };
    socket.join(code);
    socket.emit('roomCreated', { roomCode: code, players: rooms[code].players });
    console.log(`Room ${code} created by ${playerName} (${playerId})`);
  });

  // Join Room
  socket.on('joinRoom', ({ roomCode, playerName, playerId }) => {
    const room = rooms[roomCode];
    if (!playerId) playerId = socket.id;

    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }

    // Handle Reconnection
    if (room.players[playerId]) {
      console.log(`Player ${playerName} (${playerId}) reconnecting to ${roomCode}`);
      if (disconnectTimers[playerId]) {
        clearTimeout(disconnectTimers[playerId]);
        delete disconnectTimers[playerId];
      }
      
      room.players[playerId].connected = true;
      room.players[playerId].socketId = socket.id;
      room.players[playerId].name = playerName; // update name just in case
      
      socketMap[socket.id] = { roomCode, playerId };
      socket.join(roomCode);
      
      socket.emit('roomJoined', { roomCode, players: room.players, isReconnect: true });
      socket.to(roomCode).emit('opponentRejoined', playerId);
      return;
    }

    // Normal Join
    if (Object.keys(room.players).length >= 2) {
      socket.emit('error', 'Room is full.');
      return;
    }

    room.players[playerId] = {
      socketId: socket.id,
      id: playerId,
      name: playerName,
      deckId: null,
      deckCards: [],
      isReady: false,
      isHost: false,
      connected: true
    };

    socketMap[socket.id] = { roomCode, playerId };
    socket.join(roomCode);
    
    socket.emit('roomJoined', { roomCode, players: room.players, isReconnect: false });
    
    // Broadcast to the other player
    socket.to(roomCode).emit('playerJoined', room.players[playerId]);
    
    console.log(`${playerName} (${playerId}) joined room ${roomCode}`);
  });

  // Update Deck
  socket.on('updateDeck', ({ roomCode, deckId, deckCards }) => {
    const info = socketMap[socket.id];
    if (info && rooms[info.roomCode] && rooms[info.roomCode].players[info.playerId]) {
      rooms[info.roomCode].players[info.playerId].deckId = deckId;
      rooms[info.roomCode].players[info.playerId].deckCards = deckCards || [];
      socket.to(info.roomCode).emit('opponentDeckUpdated', { deckId, deckCards: deckCards || [] });
    }
  });

  // Request room state
  socket.on('requestRoomState', (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
      socket.emit('roomState', room.players);
    }
  });

  // Toggle Ready Status
  socket.on('toggleReady', ({ roomCode, isReady }) => {
    const info = socketMap[socket.id];
    if (!info) return;
    
    const room = rooms[info.roomCode];
    if (room && room.players[info.playerId]) {
      room.players[info.playerId].isReady = isReady;
      socket.to(info.roomCode).emit('opponentReadyStatus', isReady);

      // Check if both players are ready
      const playerIds = Object.keys(room.players);
      if (playerIds.length === 2) {
        const allReady = playerIds.every(id => room.players[id].isReady);
        if (allReady) {
          room.status = 'starting';
          io.to(info.roomCode).emit('startCountdown');
        } else if (room.status === 'starting') {
          room.status = 'waiting';
          io.to(info.roomCode).emit('cancelCountdown');
        }
      }
    }
  });

  // Game Actions
  socket.on('initGame', (data) => {
    const room = rooms[data.roomCode];
    if (room) {
      room.status = 'playing';
      socket.to(data.roomCode).emit('gameStarted', data);
    }
  });

  socket.on('gameAction', ({ roomCode, action }) => {
    socket.to(roomCode).emit('opponentAction', action);
  });

  // Reconnecting player requests sync from opponent
  socket.on('requestSync', ({ roomCode }) => {
    socket.to(roomCode).emit('syncRequested');
  });

  socket.on('chatMessage', (messageData) => {
    const { roomCode } = messageData;
    if (roomCode) {
      socket.to(roomCode).emit('chatMessage', messageData);
    }
  });

  socket.on('leaveRoom', (roomCode) => {
    socket.leave(roomCode);
    const info = socketMap[socket.id];
    if (!info) return;

    const room = rooms[roomCode];
    if (room && room.players[info.playerId]) {
      delete room.players[info.playerId];
      delete socketMap[socket.id];
      socket.to(roomCode).emit('playerLeft', info.playerId);
      
      if (Object.keys(room.players).length === 0) {
        delete rooms[roomCode];
      } else {
        const remainingPlayerId = Object.keys(room.players)[0];
        room.players[remainingPlayerId].isHost = true;
        io.to(roomCode).emit('roomUpdated', room.players);
      }
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const info = socketMap[socket.id];
    if (!info) return; // not in any room

    const roomCode = info.roomCode;
    const playerId = info.playerId;
    const room = rooms[roomCode];

    if (room && room.players[playerId]) {
      room.players[playerId].connected = false;

      // If room is still waiting in lobby, just delete them immediately
      if (room.status === 'waiting' || room.status === 'starting') {
        delete room.players[playerId];
        delete socketMap[socket.id];
        socket.to(roomCode).emit('playerLeft', playerId);

        if (Object.keys(room.players).length === 0) {
          delete rooms[roomCode];
        } else {
          const remainingPlayerId = Object.keys(room.players)[0];
          room.players[remainingPlayerId].isHost = true;
          io.to(roomCode).emit('roomUpdated', room.players);
        }
      } else {
        // Game is playing, give them 60 seconds to reconnect
        console.log(`${playerId} disconnected from game ${roomCode}. Waiting 60s for reconnect...`);
        socket.to(roomCode).emit('opponentDisconnected', playerId);
        
        disconnectTimers[playerId] = setTimeout(() => {
          console.log(`${playerId} failed to reconnect to ${roomCode} in time. Kicking.`);
          if (rooms[roomCode] && rooms[roomCode].players[playerId]) {
            delete disconnectTimers[playerId];
            delete rooms[roomCode].players[playerId];
            socket.to(roomCode).emit('playerLeft', playerId);

            if (Object.keys(rooms[roomCode].players).length === 0) {
              delete rooms[roomCode];
            } else {
              const remainingPlayerId = Object.keys(rooms[roomCode].players)[0];
              rooms[roomCode].players[remainingPlayerId].isHost = true;
            }
          }
        }, 60000);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Socket.io Server running on port ${PORT}`);
});
