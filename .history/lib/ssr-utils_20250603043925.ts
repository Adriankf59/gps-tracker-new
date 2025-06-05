import { useEffect, useState } from 'react';
import * as React from 'react';

/**
 * Hook untuk mencegah hydration mismatch
 * dengan menunggu hingga component ter-mount di client
 */
export function useClientOnly(): boolean {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
}

/**
 * Hook untuk handle animations yang aman untuk SSR
 */
export function useSSRSafeAnimation(delay: number = 100): { isMounted: boolean; isVisible: boolean } {
  const [isVisible, setIsVisible] = useState(false);
  const isMounted = useClientOnly();

  useEffect(() => {
    if (isMounted) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [isMounted, delay]);

  return { isMounted, isVisible };
}

/**
 * Component wrapper untuk conditional rendering yang aman untuk SSR
 */
interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps): React.ReactElement {
  const isMounted = useClientOnly();
  
  if (isMounted) {
    return React.createElement(React.Fragment, {}, children);
  }
  
  return React.createElement(React.Fragment, {}, fallback);
}

/**
 * Hook untuk dynamic imports yang aman untuk SSR
 */
export function useDynamicImport<T>(
  importFn: () => Promise<T>,
  dependencies: any[] = []
): { module: T | null; loading: boolean; error: Error | null; isMounted: boolean } {
  const [module, setModule] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useClientOnly();

  useEffect(() => {
    if (!isMounted) return;

    setLoading(true);
    setError(null);

    importFn()
      .then(setModule)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [isMounted, ...dependencies]);

  return { module, loading, error, isMounted };
}