export function getPublicApiBaseUrl(): string | null {
  const configuredValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredValue) {
    if (
      typeof window !== 'undefined' &&
      isLocalHostname(window.location.hostname)
    ) {
      try {
        const localApiUrl = new URL(configuredValue);
        if (isLocalHostname(localApiUrl.hostname)) {
          localApiUrl.hostname = window.location.hostname;
          return localApiUrl.toString().replace(/\/$/, '');
        }
      } catch {
        // Preserve configured relative API addresses.
      }
    }
    return configuredValue.replace(/\/$/, '');
  }

  if (
    typeof window !== 'undefined' &&
    isLocalHostname(window.location.hostname)
  ) {
    const localApiUrl = new URL(window.location.origin);
    localApiUrl.port = '4000';
    localApiUrl.pathname = '/api/v1';
    return localApiUrl.toString().replace(/\/$/, '');
  }

  return null;
}

export function getHealthEndpoint(): string | null {
  const apiBaseUrl = getPublicApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}/health` : null;
}

function isLocalHostname(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}
