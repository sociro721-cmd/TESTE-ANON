import { useEffect, useRef, useState, useCallback } from 'react';
import { AnonymousUser, PrivateConversationSummary } from '../types';
import { sounds } from '../utils/audio';

export function usePrivateConversations(currentUser?: AnonymousUser | null) {
  const [conversations, setConversations] = useState<PrivateConversationSummary[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const userId = currentUser?.id?.trim() || null;

  const fetchConversations = useCallback(() => {
    if (!userId) {
      setConversations([]);
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'private_list_conversations',
          user: {
            id: currentUser?.id,
            name: currentUser?.name,
            nick: (currentUser as any)?.nick,
            avatarUrl: (currentUser as any)?.avatarUrl,
            avatarColor: currentUser?.avatarColor,
            avatarIcon: currentUser?.avatarIcon,
          },
        })
      );
    }
  }, [userId, currentUser]);

  const markAsRead = useCallback(
    (conversationId: string) => {
      if (!userId) return;

      // Otimisticamente zera no estado local
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'private_mark_read',
            conversationId,
            user: {
              id: userId,
            },
          })
        );
      }
    },
    [userId]
  );

  useEffect(() => {
    isMountedRef.current = true;

    // Se NÃO houver usuário atual identificado, encerra tudo e zera estado
    if (!userId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setConversations([]);
      setIsConnected(false);
      return;
    }

    // Ao mudar de usuário ou inicializar, zera conversas do usuário anterior
    setConversations([]);

    function connect() {
      if (!isMountedRef.current || !userId) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current || !userId) {
          ws.close();
          return;
        }
        setIsConnected(true);

        // Ao abrir a conexão, solicita imediatamente a lista das conversas do usuário atual
        ws.send(
          JSON.stringify({
            type: 'private_list_conversations',
            user: {
              id: currentUser?.id,
              name: currentUser?.name,
              nick: (currentUser as any)?.nick,
              avatarUrl: (currentUser as any)?.avatarUrl,
              avatarColor: currentUser?.avatarColor,
              avatarIcon: currentUser?.avatarIcon,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'private_conversations_list' && Array.isArray(data.conversations)) {
            setConversations(data.conversations);
          } else if (data.type === 'private_new_message' && data.message) {
            // Toca som de notificação para nova mensagem privada recebida
            if (data.message.senderId !== userId) {
              sounds.playMessageReceived();
            }
          }
        } catch (err) {
          console.warn('[usePrivateConversations] Erro ao analisar mensagem WS:', err);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        // Reconexão suave após 3s apenas se o usuário ainda estiver autenticado
        if (userId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        console.warn('[usePrivateConversations] WebSocket error:', err);
      };
    }

    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [userId, currentUser?.name, (currentUser as any)?.nick, (currentUser as any)?.avatarUrl, currentUser?.avatarColor, currentUser?.avatarIcon]);

  const totalUnread = userId ? conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0) : 0;

  return {
    conversations: userId ? conversations : [],
    totalUnread,
    isConnected,
    fetchConversations,
    markAsRead,
  };
}
