import { io, Socket } from "socket.io-client";

// Define the server URL dynamically
const SERVER_URL = import.meta.env.PROD ? window.location.origin : "http://localhost:3002";

// Create a singleton socket instance
export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
