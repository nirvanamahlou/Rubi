'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type PageBreadcrumb = {
  key: string;
  title: string;
  href?: string;
  onSelect?: () => void;
};

type PageTrail = {
  pathname: string;
  items: readonly PageBreadcrumb[];
};
type RegisterTrail = (
  pathname: string,
  items: readonly PageBreadcrumb[],
) => () => void;

const TrailContext = createContext<PageTrail | null>(null);
const RegisterContext = createContext<RegisterTrail | null>(null);

export function PageBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<PageTrail | null>(null);
  const register = useCallback<RegisterTrail>((pathname, items) => {
    const registration = { pathname, items };
    setTrail(registration);
    return () => {
      setTrail((current) => (current === registration ? null : current));
    };
  }, []);

  return (
    <RegisterContext.Provider value={register}>
      <TrailContext.Provider value={trail}>{children}</TrailContext.Provider>
    </RegisterContext.Provider>
  );
}

/** Local workspace views supply their real parent actions to the shell. */
export function usePageBreadcrumbs(
  pathname: string,
  items: readonly PageBreadcrumb[],
) {
  const register = useContext(RegisterContext);
  useEffect(() => register?.(pathname, items), [register, pathname, items]);
}

export function usePageBreadcrumbOverride(pathname: string) {
  const trail = useContext(TrailContext);
  return trail?.pathname === pathname ? trail.items : null;
}
