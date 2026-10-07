export type DisplayLanguage = 'fa' | 'en';

export const displayLanguageStorageKey = 'nora:display-language:v1';
export const displayLanguageChangedEvent = 'nora:display-language-changed';
export const displayLanguageCookieName = 'nora-display-language';

export function parseDisplayLanguage(value: unknown): DisplayLanguage | null {
  return value === 'en' || value === 'fa' ? value : null;
}

export function readDisplayLanguage(
  storage: Pick<Storage, 'getItem'> | null,
): DisplayLanguage | null {
  try {
    return parseDisplayLanguage(storage?.getItem(displayLanguageStorageKey));
  } catch {
    return null;
  }
}

export function persistDisplayLanguage(
  language: DisplayLanguage,
  storage: Pick<Storage, 'setItem'> | null,
): void {
  try {
    storage?.setItem(displayLanguageStorageKey, language);
  } catch {
    // Blocked browser storage must not prevent switching languages.
  }
  if (typeof document !== 'undefined') {
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${displayLanguageCookieName}=${language}; Path=/; SameSite=Lax; Max-Age=31536000${secure}`;
    } catch {
      // A privacy policy may disable cookies independently of local storage.
    }
  }
}

export function languageFromCookies(
  cookie: string | null | undefined,
): DisplayLanguage {
  const raw = cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${displayLanguageCookieName}=`));
  return (
    parseDisplayLanguage(raw?.slice(displayLanguageCookieName.length + 1)) ??
    'fa'
  );
}

export function browserDisplayLanguage(): DisplayLanguage {
  return (
    readDisplayLanguage(browserLanguageStorage()) ??
    languageFromCookies(
      typeof document === 'undefined' ? undefined : document.cookie,
    )
  );
}

export function browserLanguageStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
