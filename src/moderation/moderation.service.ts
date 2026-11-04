import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { HttpClient } from '../common/http-client.js';
import { containsLink, containsProfanity } from './text-filter.js';

export type RejectionReason = 'profanity' | 'link' | 'flagged';

export type ModerationVerdict = { allowed: true } | { allowed: false; reason: RejectionReason };

interface OpenAiModerationResponse {
  results: Array<{ flagged: boolean; categories: Record<string, boolean> }>;
}

/**
 * Two layers: a fast local word/link filter that always runs, and an optional AI
 * classifier (OpenAI moderation, free endpoint) when OPENAI_API_KEY is set. The AI
 * layer fails open — an outage there must not take chat down.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly openAi?: HttpClient;

  constructor(private readonly config: AppConfig) {
    if (config.get('OPENAI_API_KEY')) {
      this.openAi = new HttpClient({
        service: 'openai-moderation',
        userAgent: config.get('OUTBOUND_USER_AGENT'),
        timeoutMs: 1_500,
        retries: 0,
        breakerThreshold: 3,
        breakerCooldownMs: 120_000,
      });
    }
  }

  async check(text: string): Promise<ModerationVerdict> {
    if (containsProfanity(text)) {
      return { allowed: false, reason: 'profanity' };
    }
    if (containsLink(text)) {
      return { allowed: false, reason: 'link' };
    }
    if (this.openAi && !this.openAi.circuitOpen) {
      try {
        const result = await this.openAi.json<OpenAiModerationResponse>(
          'https://api.openai.com/v1/moderations',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.config.get('OPENAI_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
          },
        );
        if (result.results.some((item) => item.flagged)) {
          return { allowed: false, reason: 'flagged' };
        }
      } catch (error) {
        this.logger.warn(`AI moderation skipped: ${(error as Error).message}`);
      }
    }
    return { allowed: true };
  }
}
