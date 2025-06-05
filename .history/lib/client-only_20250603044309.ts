'use client';

import { useEffect, useState, ReactNode } from 'react';

// Hook untuk detect client-side mounting
export const useClientOnly = (): boolean => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
};

// Hook untuk SSR-safe animations
export const useSSRSafeAnimation = (delay: number = 100) => {
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
};

// Simple ClientOnly component
interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const ClientOnly = ({ children, fallback = null }: ClientOnlyProps) => {
  const isMounted = useClientOnly();
  
  if (!isMounted) {
    return fallback as JSX.Element;
  }
  
  return children as JSX.Element;
};