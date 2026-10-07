'use client';

import { createContext, useCallback, useContext } from 'react';
import type { DisplayLanguage } from './language';
import { translateUiText } from './translate';

export const DisplayLocaleContext = createContext<DisplayLanguage>('fa');

export function useDisplayLanguage(): DisplayLanguage {
  return useContext(DisplayLocaleContext);
}

export function useUiTranslation() {
  const language = useDisplayLanguage();
  return useCallback((text: string) => translateUiText(text, language), [language]);
}
