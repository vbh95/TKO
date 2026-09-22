import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef<Socket>(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket.connected) {
      socket.connect();
    }
    return () => {};
  }, []);

  const joinTournament = useCallback((tournamentId: number) => {
    socketRef.current.emit("join:tournament", tournamentId);
  }, []);

  const joinBoard = useCallback((tournamentId: number, boardNumber: number, shareToken?: string) => {
    socketRef.current.emit("join:board", { tournamentId, boardNumber, shareToken });
  }, []);

  const joinPublic = useCallback((shareToken: string) => {
    socketRef.current.emit("join:public", shareToken);
  }, []);

  const joinScorer = useCallback(() => {
    // The server authenticates the scorer socket from the HTTP-only board
    // session cookie. Never copy the access token into JavaScript/socket data.
    socketRef.current.emit("join:scorer");
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current.on(event, handler);
    return () => {
      socketRef.current.off(event, handler);
    };
  }, []);

  return {
    socket: socketRef.current,
    joinTournament,
    joinBoard,
    joinPublic,
    joinScorer,
    on,
  };
}
