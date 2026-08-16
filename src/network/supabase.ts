import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxmmpqdiptyncztzmwhs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bW1wcWRpcHR5bmN6dHptd2hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NDkxOTMsImV4cCI6MjEwMjQyNTE5M30.v9pMSLaBBVEr0ST7gjeA-Qx9-VMdHXeU_D-sf4LlBPI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

class SocketEmulator {
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  public currentChannel: RealtimeChannel | null = null;
  public roomCode: string | null = null;
  public playerId: string = '';
  public players: any = {};

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  once(event: string, callback: (data: any) => void) {
    const onceWrapper = (data: any) => {
      callback(data);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  off(event: string, callback?: (data: any) => void) {
    if (!this.listeners[event]) return;
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      this.listeners[event] = [];
    }
  }

  trigger(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  // Intercept socket.emit
  emit(event: string, payload?: any) {
    if (event === 'createRoom') {
      const code = generateRoomCode();
      this.joinChannel(code, payload.playerName, payload.playerId, true);
    } 
    else if (event === 'joinRoom') {
      this.joinChannel(payload.roomCode, payload.playerName, payload.playerId, false);
    }
    else if (event === 'leaveRoom') {
      if (this.currentChannel) {
        this.currentChannel.unsubscribe();
        this.currentChannel = null;
      }
      this.roomCode = null;
      this.players = {};
    }
    else if (event === 'requestRoomState') {
      this.trigger('roomState', this.players);
      if (this.currentChannel) {
        this.currentChannel.send({ type: 'broadcast', event: 'requestFullState', payload: {} });
      }
    }
    else if (this.currentChannel) {
      // Broadcast to other players
      this.currentChannel.send({
        type: 'broadcast',
        event: event,
        payload: payload
      }).catch(err => console.error("Broadcast error:", err));

      // Self-update some local state if needed (like toggleReady)
      if (event === 'toggleReady') {
        if (this.players[this.playerId]) {
          this.players[this.playerId].isReady = payload.isReady;
          this.checkStartCountdown();
        }
      }
      if (event === 'updateDeck') {
        if (this.players[this.playerId]) {
          this.players[this.playerId].deckId = payload.deckId;
          this.players[this.playerId].deckCards = payload.deckCards;
        }
      }
    }
  }

  private joinChannel(code: string, playerName: string, playerId: string, isCreating: boolean) {
    if (this.currentChannel) {
      this.currentChannel.unsubscribe();
    }
    this.roomCode = code;
    this.playerId = playerId;
    this.players = {};

    this.currentChannel = supabase.channel(`room-${code}`, {
      config: {
        presence: { key: playerId },
        broadcast: { ack: true } // Need ack for reliability? Or just false
      }
    });

    const myPlayerData = {
      id: playerId,
      name: playerName,
      deckId: null,
      deckCards: [],
      isReady: false,
      isHost: isCreating,
      connected: true
    };

    this.currentChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.currentChannel!.presenceState();
        const playerIds = Object.keys(state);
        
        let hostId = null;
        const newPlayers: any = {};

        // Convert state back to players object
        playerIds.forEach((id, index) => {
          const pState = state[id][0] as any;
          newPlayers[id] = pState;
          if (pState.isHost) hostId = id;
        });

        // Ensure there is a host
        if (!hostId && playerIds.length > 0) {
           const firstId = playerIds[0];
           newPlayers[firstId].isHost = true;
        }

        this.players = newPlayers;

        // If I just joined and saw others, emit playerJoined for them?
        // Actually, trigger roomUpdated
        this.trigger('roomUpdated', this.players);
        this.checkStartCountdown();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== this.playerId) {
          this.trigger('playerJoined', newPresences[0]);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (key !== this.playerId) {
          this.trigger('opponentDisconnected', key);
          this.trigger('playerLeft', key);
          
          delete this.players[key];
          
          if (Object.keys(this.players).length > 0) {
            const remainingId = Object.keys(this.players)[0];
            if (this.players[remainingId]) {
               this.players[remainingId].isHost = true;
            }
            this.trigger('roomUpdated', this.players);
          }
        }
      })
      .on('broadcast', { event: 'requestFullState' }, () => {
        if (this.players[this.playerId]?.isHost) {
          this.currentChannel!.send({ type: 'broadcast', event: 'fullState', payload: this.players });
        }
      })
      .on('broadcast', { event: 'fullState' }, (payload) => {
        this.players = { ...this.players, ...payload.payload };
        this.trigger('roomState', this.players);
        this.trigger('roomUpdated', this.players);
      })
      .on('broadcast', { event: 'updateDeck' }, (payload) => {
        const data = payload.payload;
        if (this.players[payload.payload.playerId]) { // We didn't send playerId in updateDeck natively, wait, need to intercept it.
           // Since broadcast doesn't strictly have sender info unless we embed it, let's just trigger opponentDeckUpdated
        }
        this.trigger('opponentDeckUpdated', data);
      })
      .on('broadcast', { event: 'toggleReady' }, (payload) => {
        const data = payload.payload;
        // Find opponent
        const opponentId = Object.keys(this.players).find(id => id !== this.playerId);
        if (opponentId && this.players[opponentId]) {
          this.players[opponentId].isReady = data.isReady;
        }
        this.trigger('opponentReadyStatus', data.isReady);
        this.checkStartCountdown();
      })
      .on('broadcast', { event: 'initGame' }, (payload) => {
        this.trigger('gameStarted', payload.payload);
      })
      .on('broadcast', { event: 'gameAction' }, (payload) => {
        this.trigger('opponentAction', payload.payload.action); // Wait, payload is { roomCode, action }
      })
      .on('broadcast', { event: 'chatMessage' }, (payload) => {
        this.trigger('chatMessage', payload.payload);
      })
      .on('broadcast', { event: 'requestSync' }, (payload) => {
        this.trigger('syncRequested', payload.payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // If joining, check if room is full BEFORE tracking ourselves?
          // For simplicity, just join and see.
          const state = this.currentChannel!.presenceState();
          if (Object.keys(state).length >= 2 && !state[this.playerId]) {
            // Room is full
            this.trigger('error', 'Room is full.');
            this.currentChannel!.unsubscribe();
            return;
          }

          await this.currentChannel!.track(myPlayerData);

          if (isCreating) {
            this.trigger('roomCreated', { roomCode: code, players: this.players });
          } else {
            this.trigger('roomJoined', { roomCode: code, players: this.players, isReconnect: false });
          }
        }
        if (status === 'CLOSED') {
          // Disconnected
        }
      });
  }

  private checkStartCountdown() {
    const playerIds = Object.keys(this.players);
    if (playerIds.length === 2) {
      const allReady = playerIds.every(id => this.players[id].isReady);
      if (allReady) {
        this.trigger('startCountdown', null);
      } else {
        this.trigger('cancelCountdown', null);
      }
    }
  }
}

export const socket = new SocketEmulator();

export const connectSocket = () => {
  // Supabase connects automatically
};

export const disconnectSocket = () => {
  if (socket.currentChannel) {
    socket.currentChannel.unsubscribe();
    socket.currentChannel = null;
  }
};
