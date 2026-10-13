import type {
  MarketingActor,
  MarketingDispatchIntent,
} from './marketing.application';
import type { CampaignChannel } from './marketing.domain';

export interface MarketingDispatchAdapterCapabilities {
  supportedChannels: readonly CampaignChannel[];
  supportsDeliveryReceipt: boolean;
  supportsOpenReceipt: boolean;
  supportsClickReceipt: boolean;
  maximumBatchSize: number;
  rateLimitPerMinute: number;
}

export interface MarketingDispatchAdapter {
  readonly adapterName: string;
  capabilities(): Promise<MarketingDispatchAdapterCapabilities>;
  enqueueIntent(
    intent: MarketingDispatchIntent,
    context: {
      actor: MarketingActor;
      idempotencyKey: string;
      requestFingerprint: string;
      traceId: string;
    },
  ): Promise<{
    status: 'AWAITING_INTEGRATION_ADAPTER' | 'ACCEPTED';
    providerReference: string | null;
  }>;
}

export interface MarketingTemplateRendererAdapter {
  render(input: {
    templateIntentReference: string;
    templateVersion: number;
    safeVariables: Readonly<Record<string, string>>;
    channel: CampaignChannel;
  }): Promise<{
    content: string;
    contentHash: string;
    containsRawPii: false;
  }>;
}

export interface MarketingRateLimitPort {
  claim(input: {
    campaignReference: string;
    channel: CampaignChannel;
    audienceReference: string;
    requestedAt: string;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number | null }>;
}

export interface MarketingIdempotencyPort {
  claim(input: {
    key: string;
    requestFingerprint: string;
    expiresAt: string;
  }): Promise<'CLAIMED' | 'REPLAY' | 'CONFLICT'>;
}
