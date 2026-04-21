import { useEffect, useRef, useCallback, useState } from 'react';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';

// ── Types ────────────────────────────────────────────────────
export type WsEventType =
  | 'LOW_STOCK'
  | 'NEW_ORDER'
  | 'SHIFT_PENDING_APPROVAL'
  | 'TRANSFER_ARRIVED';

export interface WsPayload {
  type: WsEventType;
  [key: string]: unknown;
}

type TopicHandler = (payload: WsPayload) => void;

interface SubscriptionConfig {
  topic: string;
  handler: TopicHandler;
}

interface UseWebSocketOptions {
  warehouseId: string | undefined | null;
  onMessage: TopicHandler;
  enabled?: boolean;
}

// ── URL helpers ──────────────────────────────────────────────
// Tự động resolve WS URL từ API base URL
function getWsUrl(): string {
  const apiBase = (import.meta as any).env.VITE_API_URL ?? 'http://localhost:8080/api';
  // Xóa dấu slash ở cuối nếu có để tránh bị lỗi //ws
  const cleanBase = apiBase.replace(/\/$/, '');
  
  // Đổi http thành ws và nối thêm /ws vào cuối đường dẫn API
  // Kết quả: ws://localhost:8080/api/ws
  return cleanBase
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:') + '/ws';
}

// ── Hook ─────────────────────────────────────────────────────
/**
 * Hook quản lý kết nối STOMP WebSocket.
 * - Tự động kết nối khi mount, ngắt khi unmount.
 * - Chỉ subscribe topics khi có warehouseId.
 * - Reconnect tự động sau 5 giây nếu mất kết nối.
 */
export function useWebSocket({ warehouseId, onMessage, enabled = true }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef       = useRef<Client | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);
  
  // Dùng ref để handler luôn mới nhất, không gây reconnect
  const onMessageRef    = useRef<TopicHandler>(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const subscribe = useCallback((client: Client, wid: string) => {
    // Xoá subscription cũ nếu có
    subscriptionsRef.current.forEach(s => { try { s.unsubscribe(); } catch { /* ignore */ } });
    subscriptionsRef.current = [];

    const topics: string[] = [
      `/topic/warehouse/${wid}/low-stock`,
      `/topic/warehouse/${wid}/new-order`,
      `/topic/warehouse/${wid}/shift-alert`,
      `/topic/warehouse/${wid}/transfer`,
    ];

    topics.forEach(topic => {
      const sub = client.subscribe(topic, (msg: IMessage) => {
        try {
          const payload = JSON.parse(msg.body) as WsPayload;
          onMessageRef.current(payload);
        } catch {
          console.warn('[WS] Cannot parse message:', msg.body);
        }
      });
      subscriptionsRef.current.push(sub);
    });

    console.info(`[WS] Subscribed to ${topics.length} topics for warehouse ${wid}`);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // ADMIN không có warehouseId → không subscribe warehouse topics
    // Polling (refetchInterval) đã cover trường hợp này
    if (!warehouseId) {
      console.info('[WS] No warehouseId — skipping WebSocket (polling active)');
      return;
    }

    const accessToken = localStorage.getItem('accessToken') ?? '';

    const client = new Client({
      brokerURL: getWsUrl(),

      // Truyền JWT qua STOMP header để backend có thể authenticate
      connectHeaders: {
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },

      reconnectDelay: 5000,          // auto-reconnect sau 5 giây
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        setIsConnected(true);
        console.info('[WS] Connected');
        subscribe(client, warehouseId);
      },

      onDisconnect: () => {
        setIsConnected(false);
        console.info('[WS] Disconnected');
      },

      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame.headers?.message);
      },

      // Tắt log STOMP spam ở production
      debug: (import.meta as any).env.DEV ? (str: any) => console.debug('[STOMP]', str) : () => {},
    });

    client.activate();
    clientRef.current = client;

    return () => {
      setIsConnected(false);
      subscriptionsRef.current.forEach(s => { try { s.unsubscribe(); } catch { /* ignore */ } });
      subscriptionsRef.current = [];
      client.deactivate();
      clientRef.current = null;
      console.info('[WS] Cleanup — connection closed');
    };
  }, [warehouseId, enabled, subscribe]);

  return { isConnected };
}