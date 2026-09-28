export function getPublicApiBaseUrl(): string | null {
  const configuredValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredValue) {
    if (
      typeof window !== 'undefined' &&
      isLocalRuntimeHostname(window.location.hostname)
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
    isLocalRuntimeHostname(window.location.hostname)
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

function isLocalRuntimeHostname(hostname: string): boolean {
  if (isLocalHostname(hostname)) return true;

  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return false;

  const firstOctet = octets[0]!;
  const secondOctet = octets[1]!;
  return (
    firstOctet === 10 ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168)
  );
}
