const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';

export function getPublicApiBaseUrl(): string {
  const configuredValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return configuredValue && configuredValue.length > 0
    ? configuredValue.replace(/\/$/, '')
    : DEFAULT_API_BASE_URL;
}
