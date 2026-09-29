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

const SystemPreferencesContext = createContext<SystemPreferences>(defaults);

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
}: {
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(defaults);

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
    const timer = window.setTimeout(() => void load(), 0);
    const reload = () => void load();
    window.addEventListener(systemPreferencesChangedEvent, reload);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(systemPreferencesChangedEvent, reload);
    };
  }, [load]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = preferences.language;
    root.dir = preferences.direction;
    root.dataset.calendar = preferences.calendar;
    root.dataset.moneyUnit = preferences.moneyUnit;
    root.dataset.numberingSystem = preferences.numberingSystem;
    root.dataset.timezone = preferences.timezone;
  }, [preferences]);

  const value = useMemo(() => preferences, [preferences]);
  return (
    <SystemPreferencesContext.Provider value={value}>
      {children}
    </SystemPreferencesContext.Provider>
  );
}

export function useSystemPreferences() {
  return useContext(SystemPreferencesContext);
}
