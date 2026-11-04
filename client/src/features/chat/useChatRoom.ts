import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/api/config';
import { getAccessToken, useSession } from '@/auth/session';
import { fetchHistory, markSeen, reloadMe } from './api';
import { dropLocal, mergeMessages, newestId, oldestId, removeAuthor, removeMessage, retryAfter, updateLocal } from './messages';
import type { Ack, ChatMessage, ChatRoom, ServerMessage } from './types';

export type Connection = 'connecting' | 'online' | 'offline';

/** Why the composer is blocked (beyond slow mode), from the server's answer. */
export type Blocker =
  | { kind: 'guest' }
  | { kind: 'verify' }
  | { kind: 'name' }
  | { kind: 'muted'; until: string | null }
  | { kind: 'banned' };

const PAGE = 50;
const SEND_TIMEOUT_MS = 10_000;

/**
 * One chat room: history, live updates over Socket.IO (`/chat` namespace),
 * optimistic sending with an offline queue, older-history paging and the
 * server's moderation answers (slow mode, mute, rejection…).
 */
export function useChatRoom(roomId: string, room: ChatRoom | undefined, opts: { onRestoreDraft: (text: string) => void }) {
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const myId = me?.id ?? null;
  const cached = qc.getQueryData<ServerMessage[]>(['chat-preview', roomId]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => mergeMessages([], cached ?? []));
  const [connection, setConnection] = useState<Connection>('connecting');
  const [loaded, setLoaded] = useState(!!cached);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  /** Blocker learned from a server answer (mute, ban, missing name…). */
  const [serverBlocker, setBlocker] = useState<Blocker | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesRef = useRef(messages);
  const myIdRef = useRef(myId);
  const restoreRef = useRef(opts.onRestoreDraft);
  const slowRef = useRef(room?.slowModeSeconds ?? 0);
  useLayoutEffect(() => {
    messagesRef.current = messages;
    myIdRef.current = myId;
    restoreRef.current = opts.onRestoreDraft;
    slowRef.current = room?.slowModeSeconds ?? 0;
  });
  const lastAnnounce = useRef(0);

  const apply = useCallback((fn: (l: ChatMessage[]) => ChatMessage[]) => {
    setMessages((l) => {
      const next = fn(l);
      messagesRef.current = next;
      return next;
    });
  }, []);

  // Mark what is on screen as read.
  useEffect(() => {
    markSeen(roomId, newestId(messages));
  }, [roomId, messages]);

  const handleError = useCallback(
    (error: { code: string; message: string; details?: unknown }, clientId: string, body: string) => {
      const restore = () => {
        apply((l) => dropLocal(l, clientId));
        restoreRef.current(body);
      };
      switch (error.code) {
        case 'SLOW_MODE':
          restore();
          setCooldownUntil(Date.now() + retryAfter(error.details, slowRef.current) * 1000);
          return;
        case 'MESSAGE_REJECTED': {
          const reason = (error.details as { reason?: string } | undefined)?.reason;
          apply((l) =>
            updateLocal(l, clientId, {
              status: 'rejected',
              error: reason === 'duplicate' ? 'Bu mesajı az önce gönderdiniz' : 'Mesajın topluluk kurallarına uymuyor',
            }),
          );
          return;
        }
        case 'CHAT_MUTED':
          restore();
          setBlocker({ kind: 'muted', until: (error.details as { until?: string } | undefined)?.until ?? null });
          return;
        case 'ACCOUNT_BANNED':
          restore();
          setBlocker({ kind: 'banned' });
          return;
        case 'DISPLAY_NAME_REQUIRED':
          restore();
          setBlocker({ kind: 'name' });
          return;
        case 'EMAIL_NOT_VERIFIED':
          restore();
          setBlocker({ kind: 'verify' });
          return;
        case 'FORBIDDEN':
        case 'REGISTRATION_REQUIRED':
        case 'UNAUTHENTICATED':
          restore();
          setBlocker({ kind: 'guest' });
          return;
        default:
          apply((l) => updateLocal(l, clientId, { status: 'failed', error: 'Gönderilemedi · tekrar denemek için dokunun' }));
      }
    },
    [apply],
  );

  const emitSend = useCallback(
    (clientId: string, body: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        apply((l) => updateLocal(l, clientId, { status: 'queued' }));
        return;
      }
      apply((l) => updateLocal(l, clientId, { status: 'sending', error: undefined }));
      socket.timeout(SEND_TIMEOUT_MS).emit('message:send', { roomId, body, clientMessageId: clientId }, (err: Error | null, ack?: Ack<ServerMessage>) => {
        if (err || !ack) {
          // Lost on the way: resend with the same clientMessageId once reconnected.
          apply((l) => updateLocal(l, clientId, { status: 'queued' }));
          return;
        }
        if (ack.ok) {
          apply((l) => mergeMessages(l, [ack.data], { myId: myIdRef.current, clientId }));
          if (slowRef.current > 0) setCooldownUntil(Date.now() + slowRef.current * 1000);
        } else {
          handleError(ack.error, clientId, body);
        }
      });
    },
    [apply, handleError, roomId],
  );

  const flushQueue = useCallback(() => {
    for (const m of messagesRef.current) {
      if (m.status === 'queued' && m.clientId) emitSend(m.clientId, m.body);
    }
  }, [emitSend]);

  // Socket lifecycle.
  useEffect(() => {
    let authRetries = 0;
    let alive = true;
    const socket: Socket = io(`${API_URL}/chat`, {
      transports: ['websocket'],
      autoConnect: false,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      auth: (cb) => {
        void getAccessToken()
          .then((token) => cb({ token: token ?? '' }))
          .catch(() => cb({ token: '' }));
      },
    });
    socketRef.current = socket;

    const join = () => {
      socket.timeout(SEND_TIMEOUT_MS).emit('room:join', { roomId }, (err: Error | null, ack?: Ack<ServerMessage[]>) => {
        if (!alive || err || !ack) return;
        if (ack.ok) {
          apply((l) => mergeMessages(l, ack.data, { myId: myIdRef.current }));
          if (ack.data.length < PAGE) setHasMore(false);
          setLoaded(true);
        }
      });
    };

    socket.on('connect', () => {
      authRetries = 0;
      setConnection('online');
      join();
      flushQueue();
    });
    socket.on('disconnect', () => alive && setConnection('offline'));
    socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
      if (!alive) return;
      setConnection('offline');
      // A rejected handshake (expired/revoked token) is not retried by
      // Socket.IO itself: refresh the session and try again a few times.
      if ((err.message === 'UNAUTHENTICATED' || err.data?.code === 'UNAUTHENTICATED') && authRetries < 3) {
        authRetries += 1;
        useSession.setState({ accessExpiresAt: 0 });
        setTimeout(() => alive && socket.connect(), 800 * authRetries);
      }
    });
    socket.on('message:new', (m: ServerMessage) => {
      if (m.roomId !== roomId) return;
      apply((l) => mergeMessages(l, [m], { myId: myIdRef.current }));
      if (m.author.id !== myIdRef.current && Date.now() - lastAnnounce.current > 4000) {
        lastAnnounce.current = Date.now();
        AccessibilityInfo.announceForAccessibilityWithOptions?.(`${m.author.displayName}: ${m.body}`, { queue: true });
      }
    });
    socket.on('message:removed', (p: { id: string; roomId: string }) => {
      if (p.roomId === roomId) apply((l) => removeMessage(l, String(p.id)));
    });
    socket.on('user:removed', (p: { userId: string }) => apply((l) => removeAuthor(l, p.userId)));

    socket.connect();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        if (!socket.connected) socket.connect();
      } else if (s === 'background') {
        socket.disconnect();
      }
    });

    return () => {
      alive = false;
      sub.remove();
      if (socket.connected) socket.emit('room:leave', { roomId });
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, apply, flushQueue]);

  // REST history as a first paint (and when the socket is slow to connect).
  useEffect(() => {
    let alive = true;
    fetchHistory(roomId, null, PAGE)
      .then((page) => {
        if (!alive) return;
        apply((l) => mergeMessages(l, page, { myId: myIdRef.current }));
        if (page.length < PAGE) setHasMore(false);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [roomId, apply]);

  // What the profile already tells us (guest, mute, unverified e-mail, no name).
  const profileBlocker = useMemo<Blocker | null>(() => {
    if (!me) return null;
    if (me.kind !== 'registered') return { kind: 'guest' };
    // The screen hides an expired mute (it ticks every second).
    if (me.chatMutedUntil) return { kind: 'muted', until: me.chatMutedUntil };
    if (!me.emailVerified) return { kind: 'verify' };
    if (!me.displayName) return { kind: 'name' };
    return null;
  }, [me]);
  const blocker: Blocker | null =
    serverBlocker?.kind === 'muted' || serverBlocker?.kind === 'banned' ? serverBlocker : (profileBlocker ?? serverBlocker);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    const before = oldestId(messagesRef.current);
    if (before == null) return;
    setLoadingOlder(true);
    try {
      const page = await fetchHistory(roomId, before, PAGE);
      apply((l) => mergeMessages(l, page, { myId: myIdRef.current }));
      if (page.length < PAGE) setHasMore(false);
    } catch {
      // stays retryable on the next scroll
    } finally {
      setLoadingOlder(false);
    }
  }, [apply, hasMore, loadingOlder, roomId]);

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!body || !me) return;
      const clientId = Crypto.randomUUID();
      const local: ChatMessage = {
        id: `local-${clientId}`,
        roomId,
        body,
        createdAt: new Date().toISOString(),
        author: { id: me.id, displayName: me.displayName ?? '' },
        status: socketRef.current?.connected ? 'sending' : 'queued',
        clientId,
      };
      apply((l) => [...l, local]);
      emitSend(clientId, body);
    },
    [apply, emitSend, me, roomId],
  );

  const retry = useCallback(
    (m: ChatMessage) => {
      if (m.clientId && (m.status === 'failed' || m.status === 'queued')) emitSend(m.clientId, m.body);
    },
    [emitSend],
  );

  const discard = useCallback((m: ChatMessage) => m.clientId && apply((l) => dropLocal(l, m.clientId!)), [apply]);
  const removeLocal = useCallback((id: string) => apply((l) => removeMessage(l, id)), [apply]);
  const hideAuthor = useCallback((userId: string) => apply((l) => removeAuthor(l, userId)), [apply]);

  /** After the user verified e-mail / set a name elsewhere: pick up new claims. */
  const refreshAccount = useCallback(async () => {
    setBlocker((b) => (b?.kind === 'muted' || b?.kind === 'banned' ? b : null));
    useSession.setState({ accessExpiresAt: 0 });
    await reloadMe().catch(() => undefined);
    socketRef.current?.disconnect().connect();
  }, []);

  return {
    messages,
    connection,
    loaded,
    loadingOlder,
    hasMore,
    cooldownUntil,
    blocker,
    setBlocker,
    send,
    retry,
    discard,
    loadOlder,
    removeLocal,
    hideAuthor,
    refreshAccount,
  };
}
