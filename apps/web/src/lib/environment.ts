export function getPublicApiBaseUrl(): string | null {
  const configuredValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return configuredValue ? configuredValue.replace(/\/$/, '') : null;
}

export function getHealthEndpoint(): string | null {
  const apiBaseUrl = getPublicApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}/health` : null;
}
