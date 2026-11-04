/** Shapes from the backend chat module (src/chat/*). */

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  /** 'tr' | 'en' | 'ar' | null (mixed). */
  language: string | null;
  slowModeSeconds: number;
}

/** MessageView — ids are bigint serials as strings, history is oldest first. */
export interface ServerMessage {
  id: string;
  roomId: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string };
}

export interface BlockedUser {
  id: string;
  displayName: string | null;
  blockedAt: string;
}

/** Report reasons accepted by POST /chat/messages/:id/report. */
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'misinformation' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Taciz' },
  { id: 'hate', label: 'Nefret söylemi' },
  { id: 'sexual', label: 'Uygunsuz içerik' },
  { id: 'violence', label: 'Şiddet' },
  { id: 'misinformation', label: 'Yanlış bilgi' },
  { id: 'other', label: 'Diğer' },
];

export const MAX_MESSAGE_LENGTH = 500;

/** Socket acknowledgements: `{ ok, data | error }`. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

export type MessageStatus = 'sent' | 'sending' | 'queued' | 'rejected' | 'failed';

/** A message as the UI keeps it: server messages plus our own optimistic ones. */
export interface ChatMessage extends ServerMessage {
  status: MessageStatus;
  /** Idempotency key for our own messages (resent on reconnect). */
  clientId?: string;
  /** Why a message was rejected (shown under the bubble). */
  error?: string;
}
