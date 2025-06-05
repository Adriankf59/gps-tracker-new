import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PerformanceMetrics {
  componentName: string;
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  timestamp: number;
}

interface PerformanceMonitorProps {
  componentName: string;
  children: React.ReactNode;
  onMetrics?: (metrics: PerformanceMetrics) => void;
  enableLogging?: boolean;
}

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const startTimeRef = useRef<number>(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    startTimeRef.current = performance.now();
    
    return () => {
      const endTime = performance.now();
      const loadTime = endTime - startTimeRef.current;
      
      // Get memory usage if available
      let memoryUsage;
      if ('memory' in performance && (performance as any).memory) {
        memoryUsage = (performance as any).memory.usedJSHeapSize;
      }
      
      const performanceMetrics: PerformanceMetrics = {
        componentName,
        loadTime,
        renderTime: loadTime, // For simplicity, using same as loadTime
        memoryUsage,
        timestamp: Date.now()
      };
      
      setMetrics(performanceMetrics);
      
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 Performance [${componentName}]:`, {
          loadTime: `${loadTime.toFixed(2)}ms`,
          memoryUsage: memoryUsage ? `${(memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A'
        });
      }
    };
  }, [componentName]);

  return metrics;
};

// Performance Monitor Component
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  componentName,
  children,
  onMetrics,
  enableLogging = process.env.NODE_ENV === 'development'
}) => {
  const metrics = usePerformanceMonitor(componentName);

  useEffect(() => {
    if (metrics && onMetrics) {
      onMetrics(metrics);
    }
  }, [metrics, onMetrics]);

  return <>{children}</>;
};

// Analytics helper
export const trackUserInteraction = (
  action: string,
  category: string = 'interaction',
  label?: string,
  value?: number
) => {
  // Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      timestamp: Date.now()
    });
  }

  // Console logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 User Interaction:', {
      action,
      category,
      label,
      value,
      timestamp: new Date().toISOString()
    });
  }
};

// Error tracking
export const trackError = (
  error: Error,
  componentName: string,
  additionalInfo?: Record<string, any>
) => {
  // Log to console
  console.error(`❌ Error in ${componentName}:`, error, additionalInfo);

  // Send to analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'exception', {
      description: error.message,
      fatal: false,
      component: componentName,
      ...additionalInfo
    });
  }

  // Optional: Send to error tracking service (Sentry, LogRocket, etc.)
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     tags: { component: componentName },
  //     extra: additionalInfo
  //   });
  // }
};

// Performance analytics storage
class PerformanceAnalytics {
  private metrics: PerformanceMetrics[] = [];
  private maxEntries = 100;

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only recent entries
    if (this.metrics.length > this.maxEntries) {
      this.metrics = this.metrics.slice(-this.maxEntries);
    }
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('performance_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('Failed to store performance metrics:', error);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageLoadTime(componentName?: string): number {
    const filteredMetrics = componentName 
      ? this.metrics.filter(m => m.componentName === componentName)
      : this.metrics;
    
    if (filteredMetrics.length === 0) return 0;
    
    const total = filteredMetrics.reduce((sum, m) => sum + m.loadTime, 0);
    return total / filteredMetrics.length;
  }

  getSlowestComponents(limit: number = 5): { name: string; avgTime: number }[] {
    const componentTimes = new Map<string, number[]>();
    
    this.metrics.forEach(metric => {
      if (!componentTimes.has(metric.componentName)) {
        componentTimes.set(metric.componentName, []);
      }
      componentTimes.get(metric.componentName)!.push(metric.loadTime);
    });
    
    const averages = Array.from(componentTimes.entries()).map(([name, times]) => ({
      name,
      avgTime: times.reduce((sum, time) => sum + time, 0) / times.length
    }));
    
    return averages
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  clear() {
    this.metrics = [];
    try {
      localStorage.removeItem('performance_metrics');
    } catch (error) {
      console.warn('Failed to clear performance metrics:', error);
    }
  }

  // Load metrics from localStorage on initialization
  loadStoredMetrics() {
    try {
      const stored = localStorage.getItem('performance_metrics');
      if (stored) {
        this.metrics = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored performance metrics:', error);
    }
  }
}

// Global performance analytics instance
export const performanceAnalytics = new PerformanceAnalytics();

// Initialize stored metrics
if (typeof window !== 'undefined') {
  performanceAnalytics.loadStoredMetrics();
}

// Performance HOC untuk wrapping components
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const ComponentWithPerformanceMonitoring = (props: P) => {
    const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
    
    return (
      <PerformanceMonitor
        componentName={displayName}
        onMetrics={(metrics) => performanceAnalytics.addMetric(metrics)}
      >
        <WrappedComponent {...props} />
      </PerformanceMonitor>
    );
  };

  ComponentWithPerformanceMonitoring.displayName = `withPerformanceMonitoring(${displayName})`;
  
  return ComponentWithPerformanceMonitoring;
};

// Custom hook untuk component timing
export const useComponentTiming = (componentName: string) => {
  const [timing, setTiming] = useState<{
    startTime: number;
    endTime?: number;
    duration?: number;
  }>({ startTime: 0 });

  const startTiming = () => {
    setTiming({ startTime: performance.now() });
  };

  const endTiming = () => {
    const endTime = performance.now();
    const duration = endTime - timing.startTime;
    
    setTiming(prev => ({
      ...prev,
      endTime,
      duration
    }));

    // Track the timing
    trackUserInteraction('component_timing', 'performance', componentName, duration);
    
    return duration;
  };

  return { startTiming, endTiming, timing };
};

// React DevTools Profiler integration
export const ProfiledComponent: React.FC<{
  id: string;
  children: React.ReactNode;
  onRender?: (id: string, phase: string, actualDuration: number) => void;
}> = ({ id, children, onRender }) => {
  const handleRender = (
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    // Log profiling data
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Profile [${id}]:`, {
        phase,
        actualDuration: `${actualDuration.toFixed(2)}ms`,
        baseDuration: `${baseDuration.toFixed(2)}ms`,
        startTime: `${startTime.toFixed(2)}ms`,
        commitTime: `${commitTime.toFixed(2)}ms`
      });
    }

    onRender?.(id, phase, actualDuration);
  };

  // Only use Profiler in development
  if (process.env.NODE_ENV === 'development' && React.Profiler) {
    return (
      <React.Profiler id={id} onRender={handleRender}>
        {children}
      </React.Profiler>
    );
  }

  return <>{children}</>;
};