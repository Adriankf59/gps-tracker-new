import { useEffect, useState } from 'react';

/**
 * Hook untuk mencegah hydration mismatch
 * dengan menunggu hingga component ter-mount di client
 */
export function useClientOnly() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
}

/**
 * Hook untuk handle animations yang aman untuk SSR
 */
export function useSSRSafeAnimation(delay: number = 100) {
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

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isMounted = useClientOnly();
  
  return isMounted ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook untuk dynamic imports yang aman untuk SSR
 */
export function useDynamicImport<T>(
  importFn: () => Promise<T>,
  dependencies: any[] = []
) {
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