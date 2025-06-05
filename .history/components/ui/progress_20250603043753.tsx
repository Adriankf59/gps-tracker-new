"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  className?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const [isMounted, setIsMounted] = React.useState(false);
    
    React.useEffect(() => {
      setIsMounted(true);
    }, []);
    
    // Prevent hydration mismatch by not rendering until mounted
    if (!isMounted) {
      return (
        <div
          ref={ref}
          className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800",
            className
          )}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          {...props}
        >
          <div className="h-full w-0 transition-all duration-300 ease-in-out rounded-full bg-slate-300" />
        </div>
      );
    }
    
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800",
          className
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        {...props}
      >
        <div
          className="h-full transition-all duration-300 ease-in-out rounded-full"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: percentage < 40 ? '#ef4444' : percentage < 80 ? '#eab308' : '#22c55e'
          }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }