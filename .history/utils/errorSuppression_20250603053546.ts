// utils/errorSuppression.ts
// Utility untuk menangani browser extension errors dan hydration issues

import { useEffect } from 'react';

// Suppress browser extension errors yang tidak relevan
export const suppressBrowserExtensionErrors = () => {
  if (typeof window === 'undefined') return;

  // Override console.error untuk filter browser extension errors
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Skip browser extension related errors
    const skipErrors = [
      'Could not establish connection. Receiving end does not exist',
      'The message port closed before a response was received',
      'runtime.lastError'
    ];
    
    if (skipErrors.some(error => message.includes(error))) {
      return; // Don't log these errors
    }
    
    // Log other errors normally
    originalConsoleError.apply(console, args);
  };

  // Suppress runtime.lastError specifically
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    const originalSendMessage = chrome.runtime.sendMessage;
    if (originalSendMessage) {
      chrome.runtime.sendMessage = function(...args) {
        try {
          return originalSendMessage.apply(this, args);
        } catch (error) {
          // Suppress the error silently
          return;
        }
      };
    }
  }
};

// Hook for handling hydration-safe rendering
export const useHydrationSafe = () => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
};

// Component wrapper untuk hydration-safe rendering
export const HydrationSafe: React.FC<{ 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ children, fallback = null }) => {
  const isHydrated = useHydrationSafe();
  
  if (!isHydrated) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

// Remove browser extension attributes dari DOM elements
export const cleanupBrowserExtensionAttributes = () => {
  if (typeof window === 'undefined') return;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const element = mutation.target as Element;
        
        // Remove common browser extension attributes
        const extensionAttributes = [
          'bis_skin_checked',
          'data-darkreader-inline-bgcolor',
          'data-darkreader-inline-color',
          'data-gramm',
          'data-gramm_editor',
          'spellcheck'
        ];
        
        extensionAttributes.forEach(attr => {
          if (element.hasAttribute(attr)) {
            element.removeAttribute(attr);
          }
        });
      }
    });
  });

  // Observe all DOM changes
  observer.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: [
      'bis_skin_checked',
      'data-darkreader-inline-bgcolor', 
      'data-darkreader-inline-color',
      'data-gramm',
      'data-gramm_editor'
    ]
  });

  return () => observer.disconnect();
};

// Initialize error suppression pada app startup
export const initializeErrorSuppression = () => {
  if (typeof window === 'undefined') return;

  // Suppress browser extension errors
  suppressBrowserExtensionErrors();
  
  // Cleanup extension attributes
  const cleanupObserver = cleanupBrowserExtensionAttributes();
  
  // Clean existing attributes on mount
  setTimeout(() => {
    const elements = document.querySelectorAll('[bis_skin_checked]');
    elements.forEach(el => {
      el.removeAttribute('bis_skin_checked');
    });
  }, 100);

  return cleanupObserver;
};

// Enhanced error boundary with extension error filtering
export class FilteredErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<any> },
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
      'bis_skin_checked'
    ];
    
    const isExtensionError = extensionErrorPatterns.some(pattern => 
      error.message?.includes(pattern) || error.stack?.includes(pattern)
    );
    
    if (isExtensionError) {
      return { hasError: false }; // Don't trigger error boundary for extension errors
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Filtered Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} />;
      }
      
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">An unexpected error occurred</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// React hook untuk initialize error suppression
export const useErrorSuppression = () => {
  useEffect(() => {
    const cleanup = initializeErrorSuppression();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, []);
};