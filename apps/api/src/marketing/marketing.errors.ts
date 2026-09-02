export type MarketingErrorCode =
  | 'MARKETING_VALIDATION_ERROR'
  | 'MARKETING_PERMISSION_DENIED'
  | 'MARKETING_INVALID_TRANSITION'
  | 'MARKETING_CONFLICT'
  | 'MARKETING_CONSENT_REQUIRED'
  | 'MARKETING_SUPPRESSED'
  | 'MARKETING_FREQUENCY_CAP_REACHED'
  | 'MARKETING_INTEGRATION_UNAVAILABLE'
  | 'MARKETING_ANALYTICS_UNAVAILABLE';

export class MarketingDomainError extends Error {
  constructor(
    public readonly code: MarketingErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'MarketingDomainError';
  }
}

export interface MarketingErrorContract {
  error: {
    code: MarketingErrorCode;
    message: string;
    details: Readonly<Record<string, unknown>>;
  };
  meta: {
    module: 'marketing';
    retryable: boolean;
  };
}

const retryableErrors = new Set<MarketingErrorCode>([
  'MARKETING_CONFLICT',
  'MARKETING_INTEGRATION_UNAVAILABLE',
  'MARKETING_ANALYTICS_UNAVAILABLE',
]);

export function toMarketingErrorContract(
  error: MarketingDomainError,
): MarketingErrorContract {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    meta: {
      module: 'marketing',
      retryable: retryableErrors.has(error.code),
    },
  };
}
