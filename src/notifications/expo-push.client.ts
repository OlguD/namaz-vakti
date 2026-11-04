import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { HttpClient } from '../common/http-client.js';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
}

export type PushTicket =
  { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

export type PushReceipt =
  { status: 'ok' } | { status: 'error'; message: string; details?: { error?: string } };

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[\w-]+\]$/;

export function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN.test(token);
}

/**
 * Expo push service: one HTTP API for both APNs and FCM, matching the Expo app.
 * Send returns tickets; delivery problems (e.g. uninstalled app) only show up in
 * receipts fetched ~15 minutes later.
 */
@Injectable()
export class ExpoPushClient {
  private readonly http: HttpClient;

  constructor(private readonly config: AppConfig) {
    this.http = new HttpClient({
      service: 'expo-push',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 15_000,
      retries: 2,
    });
  }

  /** At most 100 messages per call (Expo limit). */
  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const response = await this.http.json<{ data: PushTicket[] }>(
      'https://exp.host/--/api/v2/push/send',
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(messages),
      },
    );
    return response.data;
  }

  /** At most 1000 ids per call. */
  async receipts(ids: string[]): Promise<Record<string, PushReceipt>> {
    const response = await this.http.json<{ data: Record<string, PushReceipt> }>(
      'https://exp.host/--/api/v2/push/getReceipts',
      { method: 'POST', headers: this.headers(), body: JSON.stringify({ ids }) },
    );
    return response.data;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };
    const token = this.config.get('EXPO_ACCESS_TOKEN');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }
}
