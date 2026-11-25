import { api } from "./api";

export type RealtimeEvent = { type: "services" | "bookings" | "availability" };

export function subscribeRealtime(onEvent: (event: RealtimeEvent) => void): () => void {
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const schedule = () => {
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, 3000);
  };

  const connect = () => {
    try {
      socket = new WebSocket(`${api.baseUrl.replace(/^http/, "ws")}/ws`);
    } catch {
      schedule();
      return;
    }
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as RealtimeEvent;
        if (event?.type) onEvent(event);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      socket = null;
      schedule();
    };
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
