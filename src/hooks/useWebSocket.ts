import { useEffect, useRef, useCallback, useState } from 'react';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { useAuthStore } from '@/stores/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export interface WsNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  payload: any;
}

export function getWsUrl(): string {
  const apiBase = (import.meta as any).env.VITE_API_URL ?? 'http://localhost:8080/api';
  const cleanBase = apiBase.replace(/\/$/, '');
  return cleanBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
}

export function useGlobalWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);
  
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();

  const warehouseId = user?.warehouseId;
  const isAdmin = user?.role === 'ROLE_ADMIN';
  const isManager = user?.role === 'ROLE_MANAGER';
  
  // ĐÃ THÊM: Chỉ Admin và Manager mới cần nhận thông báo Real-time
  const canReceiveAlerts = isAdmin || isManager;

  const subscribe = useCallback((client: Client) => {
    subscriptionsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
    subscriptionsRef.current = [];

    // 1. Kênh cá nhân (Bắt buộc cho mọi user hợp lệ)
    const topics: string[] = ['/user/queue/notifications'];

    // 2. Kênh tập thể
    if (isAdmin) {
      topics.push('/topic/admin/notifications');
    } else if (warehouseId) {
      topics.push(`/topic/warehouse/${warehouseId}/notifications`);
    }

    topics.forEach(topic => {
      const sub = client.subscribe(topic, (msg: IMessage) => {
        try {
          const notif = JSON.parse(msg.body) as WsNotification;
          
          toast(notif.message, {
            icon: notif.type === 'LOW_STOCK' ? '⚠️' : notif.type === 'NEW_ORDER' ? '🛒' : '🔔',
            duration: 5000,
          });

          qc.setQueryData(['notifications-count'], (old: number = 0) => old + 1);
          qc.setQueryData(['notifications-unread'], (old: any[] = []) => [notif, ...(old || [])]);

          if (notif.type === 'LOW_STOCK') {
            qc.invalidateQueries({ queryKey: ['low-stock'] });
          } else if (notif.type === 'NEW_ORDER') {
            qc.invalidateQueries({ queryKey: ['orders'] });
            qc.invalidateQueries({ queryKey: ['revenue'] });
          } else if (notif.type === 'SHIFT_PENDING_APPROVAL') {
            qc.invalidateQueries({ queryKey: ['pending-shifts'] });
          } else if (notif.type === 'TRANSFER_ARRIVED') {
            qc.invalidateQueries({ queryKey: ['transfers'] });
          }
          qc.invalidateQueries({ queryKey: ['dashboard-manager'] });
          qc.invalidateQueries({ queryKey: ['admin-dashboard'] });

        } catch {
          console.warn('[WS] Cannot parse message:', msg.body);
        }
      });
      subscriptionsRef.current.push(sub);
    });

    console.info(`[WS] Đã đăng ký ${topics.length} kênh Real-time`);
  }, [isAdmin, warehouseId, qc]);

  useEffect(() => {
    // ĐÃ SỬA: Chặn không cho Cashier mở kết nối WS
    if (!isAuthenticated || !canReceiveAlerts) return;

    const client = new Client({
      brokerURL: getWsUrl(),
      connectHeaders: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
      // ĐÃ THÊM: Đảm bảo khi đứt mạng kết nối lại sẽ luôn dùng token mới nhất
      beforeConnect: () => {
        const latestToken = localStorage.getItem('accessToken') ?? '';
        client.connectHeaders = { Authorization: `Bearer ${latestToken}` };
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setIsConnected(true);
        subscribe(client);
      },
      onDisconnect: () => setIsConnected(false),
    });

    client.activate();
    clientRef.current = client;

    return () => {
      setIsConnected(false);
      subscriptionsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
      subscriptionsRef.current = [];
      client.deactivate();
      clientRef.current = null;
    };
  }, [isAuthenticated, canReceiveAlerts, subscribe]);

  return { isConnected };
}