// utils/errorSuppression.js
// Standalone error suppression untuk browser extensions

(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Extension error patterns to suppress
  const EXTENSION_ERROR_PATTERNS = [
    'Could not establish connection. Receiving end does not exist',
    'The message port closed before a response was received',
    'Unchecked runtime.lastError',
    'runtime.lastError',
    'bis_skin_checked',
    'darkreader',
    'gramm',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'Extension context invalidated',
    'chrome.runtime.sendMessage',
    'Cannot access chrome',
    'grammarly',
    'adblock',
    'lastpass',
    'honey',
    'metamask'
  ];
  
  // Hydration error patterns to suppress
  const HYDRATION_ERROR_PATTERNS = [
    'Hydration failed',
    'hydration',
    'server rendered HTML didn\'t match',
    'Expected the result of a dynamic import',
    'Element type is invalid. Received a promise'
  ];
  
  function shouldSuppressError(message: any) {
    if (typeof message !== 'string') return false;
    
    const lowerMessage = message.toLowerCase();
    
    return EXTENSION_ERROR_PATTERNS.some(pattern => 
      lowerMessage.includes(pattern.toLowerCase())
    );
  }
  
  function shouldSuppressWarning(message: any) {
    if (typeof message !== 'string') return false;
    
    const lowerMessage = message.toLowerCase();
    
    return [...EXTENSION_ERROR_PATTERNS, ...HYDRATION_ERROR_PATTERNS].some(pattern => 
      lowerMessage.includes(pattern.toLowerCase())
    );
  }
  
  // Override console.error
  console.error = function(...args) {
    const message = args.join(' ');
    
    if (shouldSuppressError(message)) {
      return; // Suppress the error
    }
    
    // Call original console.error for legitimate errors
    originalError.apply(console, args);
  };
  
  // Override console.warn
  console.warn = function(...args) {
    const message = args.join(' ');
    
    if (shouldSuppressWarning(message)) {
      return; // Suppress the warning
    }
    
    // Call original console.warn for legitimate warnings
    originalWarn.apply(console, args);
  };
  
  // Suppress window errors from extensions
  const originalWindowError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (typeof message === 'string' && shouldSuppressError(message)) {
      return true; // Prevent error from being logged
    }
    
    if (originalWindowError) {
      return originalWindowError.call(this, message, source, lineno, colno, error);
    }
    
    return false;
  };
  
  // Suppress unhandled promise rejections from extensions
  const originalUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    const message = event.reason?.message || event.reason?.toString() || '';
    
    if (shouldSuppressError(message)) {
      event.preventDefault();
      return;
    }
    
    if (originalUnhandledRejection) {
      originalUnhandledRejection.call(window, event);
    }
  };
  
  // Clean up extension attributes from DOM
  function cleanupExtensionAttributes() {
    const attributesToRemove = [
      'bis_skin_checked',
      'data-darkreader-inline-bgcolor',
      'data-darkreader-inline-color',
      'data-gramm',
      'data-gramm_editor',
      'data-lastpass-icon-added'
    ];
    
    attributesToRemove.forEach(attr => {
      const elements = document.querySelectorAll(`[${attr}]`);
      elements.forEach(el => {
        try {
          el.removeAttribute(attr);
        } catch (e) {
          // Ignore errors when removing attributes
        }
      });
    });
  }
  
  // Run cleanup periodically
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupExtensionAttributes);
  } else {
    cleanupExtensionAttributes();
  }
  
  // Cleanup every 5 seconds
  setInterval(cleanupExtensionAttributes, 5000);
  
  // Create observer for dynamic attribute additions
  const observer = new MutationObserver(function(mutations) {
    let needsCleanup = false;
    
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes') {
        const attributeName = mutation.attributeName;
        if (attributeName && (
          attributeName.includes('bis_skin') ||
          attributeName.includes('darkreader') ||
          attributeName.includes('gramm') ||
          attributeName.includes('lastpass')
        )) {
          needsCleanup = true;
        }
      }
    });
    
    if (needsCleanup) {
      setTimeout(cleanupExtensionAttributes, 100);
    }
  });
  
  // Start observing
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeOldValue: true
    });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeOldValue: true
      });
    });
  }
  
  console.log('🛡️ Browser extension error suppression activated');
  
})();