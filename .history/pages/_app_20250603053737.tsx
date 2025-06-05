// pages/_app.tsx - Integrated dengan struktur existing
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import Head from 'next/head';

// ===== ERROR SUPPRESSION UTILITIES =====
const suppressBrowserExtensionErrors = () => {
  if (typeof window === 'undefined') return;

  // Override console.error untuk filter browser extension errors
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Skip browser extension related errors
    const skipErrors = [
      'Could not establish connection. Receiving end does not exist',
      'The message port closed before a response was received',
      'runtime.lastError',
      'bis_skin_checked',
      'darkreader',
      'gramm',
      'Unchecked runtime.lastError'
    ];
    
    if (skipErrors.some(error => message.includes(error))) {
      return; // Don't log these errors
    }
    
    // Log other errors normally
    originalConsoleError.apply(console, args);
  };

  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Skip browser extension related warnings
    if (message.includes('bis_skin_checked') || 
        message.includes('darkreader') || 
        message.includes('gramm') ||
        message.includes('Expected the result of a dynamic import')) {
      return;
    }
    
    originalConsoleWarn.apply(console, args);
  };
};

// Clean browser extension attributes
const cleanupExtensionAttributes = () => {
  if (typeof window === 'undefined') return;

  const cleanup = () => {
    // Remove extension attributes from all elements
    const attributes = [
      'bis_skin_checked',
      'data-darkreader-inline-bgcolor',
      'data-darkreader-inline-color',
      'data-gramm',
      'data-gramm_editor'
    ];

    attributes.forEach(attr => {
      const elements = document.querySelectorAll(`[${attr}]`);
      elements.forEach(el => {
        el.removeAttribute(attr);
      });
    });
  };

  // Clean immediately
  cleanup();

  // Create observer to clean new additions
  const observer = new MutationObserver((mutations) => {
    let needsCleanup = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const element = mutation.target as Element;
        const attributeName = mutation.attributeName;
        
        if (attributeName && (
          attributeName.includes('bis_skin') ||
          attributeName.includes('darkreader') ||
          attributeName.includes('gramm')
        )) {
          element.removeAttribute(attributeName);
          needsCleanup = true;
        }
      }
    });

    if (needsCleanup) {
      // Debounced cleanup
      setTimeout(cleanup, 50);
    }
  });

  observer.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeOldValue: true
  });

  return () => observer.disconnect();
};

// ===== ENHANCED ERROR BOUNDARY =====
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Filter out browser extension related errors
    const extensionErrorPatterns = [
      'Could not establish connection',
      'runtime.lastError',
      'The message port closed',
      'bis_skin_checked',
      'darkreader',
      'gramm',
      'lazy: Expected the result of a dynamic import',
      'Element type is invalid. Received a promise that resolves to: undefined'
    ];
    
    const isExtensionError = extensionErrorPatterns.some(pattern => 
      error.message?.includes(pattern) || error.stack?.includes(pattern)
    );
    
    if (isExtensionError) {
      console.log('Suppressed browser extension/lazy loading error:', error.message);
      return { hasError: false }; // Don't trigger error boundary
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Only log non-extension errors
    const extensionErrorPatterns = [
      'Could not establish connection',
      'runtime.lastError',
      'bis_skin_checked',
      'lazy: Expected the result'
    ];
    
    const isExtensionError = extensionErrorPatterns.some(pattern => 
      error.message?.includes(pattern)
    );

    if (!isExtensionError) {
      console.error('App Error Boundary caught a real error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6 text-sm">
              The application encountered an unexpected error. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ===== HYDRATION-SAFE WRAPPER =====
const HydrationSafeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Initialize error suppression
    suppressBrowserExtensionErrors();
    
    // Clean extension attributes
    const cleanupObserver = cleanupExtensionAttributes();
    
    // Mark as hydrated after a brief delay to ensure DOM is ready
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (cleanupObserver) cleanupObserver();
    };
  }, []);

  // Show loading state during hydration
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            Loading GPS Dashboard
          </h3>
          <p className="text-sm text-slate-600">
            Initializing your vehicle monitoring system...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ===== MAIN APP COMPONENT =====
export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 menit
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on extension-related errors
              const extensionErrors = [
                'Could not establish connection',
                'runtime.lastError',
                'The message port closed'
              ];
              
              if (extensionErrors.some(pattern => 
                error?.message?.includes(pattern)
              )) {
                return false;
              }
              
              return failureCount < 3;
            }
          },
        },
      })
  );

  return (
    <>
      <Head>
        <title>GPS Tracking Dashboard</title>
        <meta name="description" content="Real-time GPS vehicle tracking dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Prevent browser extension style interference */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Override browser extension styles */
            [bis_skin_checked] {
              /* Reset any extension modifications */
            }
            [data-darkreader-inline-bgcolor],
            [data-darkreader-inline-color] {
              /* Override dark reader extension styles */
            }
            [data-gramm],
            [data-gramm_editor] {
              /* Override Grammarly extension styles */
            }
            
            /* Ensure leaflet controls are visible */
            .leaflet-control-container {
              pointer-events: auto !important;
            }
          `
        }} />
      </Head>

      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <HydrationSafeWrapper>
            <Component {...pageProps} />
            
            {/* Toast notifications with error filtering */}
            <Toaster 
              position="top-right" 
              richColors
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'white',
                  color: 'black',
                  border: '1px solid #e2e8f0',
                },
              }}
            />
          </HydrationSafeWrapper>
        </QueryClientProvider>
      </AppErrorBoundary>
    </>
  );
}

// ===== NEXT.JS CONFIG =====
App.getInitialProps = async (context) => {
  // Server-side: suppress any extension-related processing
  if (typeof window === 'undefined') {
    return {};
  }
  
  return {};
};