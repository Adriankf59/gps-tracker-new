// Global analytics interface
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

// Analytics configuration
export interface AnalyticsConfig {
  enabled: boolean;
  trackingId?: string;
  userId?: string;
  debug?: boolean;
}

// Event types
export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  custom_parameters?: Record<string, any>;
}

export interface PageViewEvent {
  page_title: string;
  page_location: string;
  page_path: string;
  user_id?: string;
}

export interface UserEvent {
  user_id: string;
  user_properties?: Record<string, any>;
}

// Analytics class
class Analytics {
  private config: AnalyticsConfig = {
    enabled: false,
    debug: process.env.NODE_ENV === 'development'
  };

  private isInitialized = false;

  // Initialize analytics
  init(config: Partial<AnalyticsConfig>) {
    this.config = { ...this.config, ...config };
    
    if (!this.config.enabled || typeof window === 'undefined') {
      return;
    }

    // Initialize Google Analytics 4
    if (this.config.trackingId) {
      this.initializeGoogleAnalytics(this.config.trackingId);
    }

    this.isInitialized = true;
    
    if (this.config.debug) {
      console.log('📊 Analytics initialized:', this.config);
    }
  }

  // Initialize Google Analytics
  private initializeGoogleAnalytics(trackingId: string) {
    // Create dataLayer if it doesn't exist
    window.dataLayer = window.dataLayer || [];
    
    // Define gtag function
    window.gtag = function() {
      window.dataLayer!.push(arguments);
    };

    // Initialize with config
    window.gtag('js', new Date());
    window.gtag('config', trackingId, {
      debug_mode: this.config.debug,
      send_page_view: false // We'll handle page views manually
    });

    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
    document.head.appendChild(script);
  }

  // Track page view
  pageView(event: PageViewEvent) {
    if (!this.isEnabled()) return;

    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: event.page_title,
        page_location: event.page_location,
        page_path: event.page_path,
        user_id: event.user_id || this.config.userId
      });
    }

    this.log('Page View:', event);
  }

  // Track custom event
  track(event: AnalyticsEvent) {
    if (!this.isEnabled()) return;

    if (window.gtag) {
      window.gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        user_id: this.config.userId,
        ...event.custom_parameters
      });
    }

    this.log('Event:', event);
  }

  // Set user properties
  setUser(event: UserEvent) {
    if (!this.isEnabled()) return;

    this.config.userId = event.user_id;

    if (window.gtag) {
      window.gtag('config', this.config.trackingId, {
        user_id: event.user_id,
        custom_map: event.user_properties
      });
    }

    this.log('User Set:', event);
  }

  // Track timing
  timing(category: string, variable: string, value: number, label?: string) {
    this.track({
      action: 'timing_complete',
      category: 'timing',
      label: `${category}_${variable}${label ? `_${label}` : ''}`,
      value: Math.round(value),
      custom_parameters: {
        timing_category: category,
        timing_variable: variable,
        timing_value: value,
        timing_label: label
      }
    });
  }

  // Track error
  error(error: Error, context?: Record<string, any>) {
    if (!this.isEnabled()) return;

    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        error_name: error.name,
        error_stack: error.stack,
        ...context
      });
    }

    this.log('Error:', { error: error.message, context });
  }

  // Track conversion
  conversion(conversionId: string, value?: number, currency: string = 'USD') {
    if (!this.isEnabled()) return;

    if (window.gtag) {
      window.gtag('event', 'conversion', {
        send_to: conversionId,
        value: value,
        currency: currency
      });
    }

    this.log('Conversion:', { conversionId, value, currency });
  }

  // Check if analytics is enabled
  private isEnabled(): boolean {
    return this.config.enabled && this.isInitialized && typeof window !== 'undefined';
  }

  // Debug logging
  private log(type: string, data: any) {
    if (this.config.debug) {
      console.log(`📊 Analytics ${type}:`, data);
    }
  }

  // Get config
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  // Disable analytics
  disable() {
    this.config.enabled = false;
  }

  // Enable analytics
  enable() {
    this.config.enabled = true;
  }
}

// Global analytics instance
export const analytics = new Analytics();

// Convenience functions
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  analytics.track({ action, category, label, value });
};

export const trackPageView = (title: string, path: string) => {
  analytics.pageView({
    page_title: title,
    page_location: window.location.href,
    page_path: path
  });
};

export const trackTiming = (category: string, variable: string, value: number, label?: string) => {
  analytics.timing(category, variable, value, label);
};

export const trackError = (error: Error, context?: Record<string, any>) => {
  analytics.error(error, context);
};

export const setUser = (userId: string, properties?: Record<string, any>) => {
  analytics.setUser({ user_id: userId, user_properties: properties });
};

// React hook for analytics
export const useAnalytics = () => {
  return {
    track: trackEvent,
    pageView: trackPageView,
    timing: trackTiming,
    error: trackError,
    setUser,
    analytics
  };
};

// HOC for automatic page view tracking
export const withPageTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  pageTitle: string,
  pagePath?: string
) => {
  const ComponentWithPageTracking = (props: P) => {
    React.useEffect(() => {
      const path = pagePath || window.location.pathname;
      trackPageView(pageTitle, path);
    }, []);

    return <WrappedComponent {...props} />;
  };

  ComponentWithPageTracking.displayName = `withPageTracking(${pageTitle})`;
  
  return ComponentWithPageTracking;
};

// Performance tracking utilities
export const trackComponentPerformance = (componentName: string, loadTime: number) => {
  trackTiming('component', 'load_time', loadTime, componentName);
};

export const trackUserInteraction = (action: string, element: string, context?: string) => {
  trackEvent(action, 'user_interaction', `${element}${context ? `_${context}` : ''}`);
};

export const trackFeatureUsage = (feature: string, action: string = 'used') => {
  trackEvent(action, 'feature_usage', feature);
};

export const trackApiCall = (endpoint: string, method: string, duration: number, status: number) => {
  trackEvent('api_call', 'api', `${method}_${endpoint}`, duration);
  
  if (status >= 400) {
    trackEvent('api_error', 'api', `${method}_${endpoint}_${status}`);
  }
};

// Session tracking
export const trackSessionStart = () => {
  trackEvent('session_start', 'engagement');
};

export const trackSessionEnd = (duration: number) => {
  trackEvent('session_end', 'engagement', undefined, Math.round(duration / 1000));
};

// Business metrics
export const trackBusinessMetric = (metric: string, value: number, unit?: string) => {
  trackEvent('business_metric', 'metrics', `${metric}${unit ? `_${unit}` : ''}`, value);
};

// Initialize analytics on module load
if (typeof window !== 'undefined') {
  // Get tracking ID from environment or meta tag
  const trackingId = process.env.NEXT_PUBLIC_GA_TRACKING_ID || 
    document.querySelector('meta[name="ga-tracking-id"]')?.getAttribute('content');

  if (trackingId) {
    analytics.init({
      enabled: true,
      trackingId,
      debug: process.env.NODE_ENV === 'development'
    });
  }
}

export default analytics;