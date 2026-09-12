'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const HiddenContext = createContext(false);
const SuppressContext = createContext<(() => () => void) | null>(null);

/** Optional page-level control of the HR supplementary panel, not its permissions. */
export function HrConnectionsVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [suppressionCount, setSuppressionCount] = useState(0);
  const suppress = useCallback(() => {
    setSuppressionCount((count) => count + 1);
    return () => setSuppressionCount((count) => count - 1);
  }, []);
  return (
    <SuppressContext.Provider value={suppress}>
      <HiddenContext.Provider value={suppressionCount > 0}>
        {children}
      </HiddenContext.Provider>
    </SuppressContext.Provider>
  );
}

export function useSuppressHrConnections(hidden: boolean) {
  const suppress = useContext(SuppressContext);
  useEffect(() => {
    if (hidden && suppress) return suppress();
  }, [hidden, suppress]);
}

export function useHrConnectionsHidden() {
  return useContext(HiddenContext);
}
