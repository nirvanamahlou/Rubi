'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { systemManagementApi } from '@/modules/system-management/api/client';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import {
  browserLanguageStorage,
  displayLanguageChangedEvent,
  displayLanguageStorageKey,
  persistDisplayLanguage,
  parseDisplayLanguage,
  readDisplayLanguage,
  type DisplayLanguage,
} from '@/i18n/language';

export const systemPreferencesChangedEvent = 'nora:system-preferences-changed';

export interface SystemPreferences {
  calendar: 'persian' | 'gregorian';
  direction: 'ltr' | 'rtl';
  language: 'en' | 'fa';
  locale: 'en-US' | 'fa-IR';
  moneyUnit: 'IRR' | 'TOMAN';
  numberingSystem: 'arabext' | 'latn';
  timezone: string;
}

const defaults: SystemPreferences = {
  calendar: 'persian',
  direction: 'rtl',
  language: 'fa',
  locale: 'fa-IR',
  moneyUnit: 'IRR',
  numberingSystem: 'arabext',
  timezone: 'Asia/Tehran',
};

const SystemPreferencesContext = createContext<
  SystemPreferences & { setLanguage: (language: DisplayLanguage) => void }
>({ ...defaults, setLanguage: () => undefined });

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function resolveSystemPreferences(
  localeValue: unknown,
  worktimeValue: unknown,
): SystemPreferences {
  const locale = record(localeValue);
  const worktime = record(worktimeValue);
  const english = locale.language === 'English';
  return {
    calendar: locale.calendar === 'میلادی' ? 'gregorian' : 'persian',
    direction: english ? 'ltr' : 'rtl',
    language: english ? 'en' : 'fa',
    locale: english ? 'en-US' : 'fa-IR',
    moneyUnit: locale.money === 'تومان' ? 'TOMAN' : 'IRR',
    numberingSystem: locale.numbers === 'لاتین' ? 'latn' : 'arabext',
    timezone:
      typeof worktime.timezone === 'string' && worktime.timezone.trim()
        ? worktime.timezone
        : defaults.timezone,
  };
}

export function SystemPreferencesProvider({
  children,
  initialLanguage = null,
}: {
  children: ReactNode;
  initialLanguage?: DisplayLanguage | null;
}) {
  const [preferences, setPreferences] = useState(defaults);
  const [personalLanguage, setPersonalLanguage] =
    useState<DisplayLanguage | null>(initialLanguage);
  const setLanguage = useCallback((language: DisplayLanguage) => {
    setPersonalLanguage(language);
    persistDisplayLanguage(language, browserLanguageStorage());
    window.dispatchEvent(
      new CustomEvent(displayLanguageChangedEvent, { detail: language }),
    );
  }, []);

  const load = useCallback(async () => {
    const locale = await systemManagementApi
      .resolveSetting('general', 'locale')
      .catch(() => null);
    const worktime = await systemManagementApi
      .resolveSetting('general', 'worktime')
      .catch(() => null);
    setPreferences(resolveSystemPreferences(locale?.value, worktime?.value));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPersonalLanguage(
        readDisplayLanguage(browserLanguageStorage()) ?? initialLanguage,
      );
      void load();
    }, 0);
    const reload = () => void load();
    const languageChanged = (event?: Event) =>
      setPersonalLanguage(
        parseDisplayLanguage(
          event instanceof CustomEvent ? event.detail : null,
        ) ??
          readDisplayLanguage(browserLanguageStorage()) ??
          initialLanguage,
      );
    const storageChanged = (event: StorageEvent) => {
      if (event.key === displayLanguageStorageKey || event.key === null)
        languageChanged();
    };
    window.addEventListener(systemPreferencesChangedEvent, reload);
    window.addEventListener(displayLanguageChangedEvent, languageChanged);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(systemPreferencesChangedEvent, reload);
      window.removeEventListener(displayLanguageChangedEvent, languageChanged);
      window.removeEventListener('storage', storageChanged);
    };
  }, [load, initialLanguage]);

  const value = useMemo(() => {
    const language = personalLanguage ?? preferences.language;
    const english = language === 'en';
    return {
      ...preferences,
      language,
      direction: english ? ('ltr' as const) : ('rtl' as const),
      locale: english ? ('en-US' as const) : ('fa-IR' as const),
      calendar: english ? ('gregorian' as const) : preferences.calendar,
      numberingSystem: english
        ? ('latn' as const)
        : preferences.numberingSystem,
      setLanguage,
    };
  }, [preferences, personalLanguage, setLanguage]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = value.language;
    root.dir = value.direction;
    root.dataset.calendar = value.calendar;
    root.dataset.moneyUnit = value.moneyUnit;
    root.dataset.numberingSystem = value.numberingSystem;
    root.dataset.timezone = value.timezone;
  }, [value]);

  return (
    <SystemPreferencesContext.Provider value={value}>
      <DisplayLocaleContext.Provider value={value.language}>
        {children}
      </DisplayLocaleContext.Provider>
    </SystemPreferencesContext.Provider>
  );
}

export function useSystemPreferences() {
  return useContext(SystemPreferencesContext);
}
