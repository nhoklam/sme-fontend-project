import { useEffect, useRef } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import { getWsUrl } from './useWebSocket';

export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

interface PaymentStatusPayload {
  type: string;
  code: string;
  status: PaymentStatus;
  reference?: string;
}

export function usePaymentStatusSocket(
  code: string | null,
  onStatusChange: (status: PaymentStatus, reference?: string) => void
) {
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => {
    if (!code) return;

    const accessToken = localStorage.getItem('accessToken') ?? '';
    const client = new Client({
      brokerURL: getWsUrl(),
      connectHeaders: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        client.subscribe(`/topic/payments/${code}`, (msg: IMessage) => {
          try {
            const payload = JSON.parse(msg.body) as PaymentStatusPayload;
            onStatusChangeRef.current(payload.status, payload.reference);
          } catch {
            console.warn('[WS] Cannot parse payment message:', msg.body);
          }
        });
      },
      debug: () => {},
    });

    client.activate();
    return () => { client.deactivate(); };
  }, [code]);
}