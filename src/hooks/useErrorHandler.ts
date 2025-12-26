import { useCallback, useState } from 'react';
import {
  createAppError,
  logError,
  retryOperation,
  AppError,
  ErrorSeverity,
} from '@/utils/errorHandling';

interface UseErrorHandlerOptions {
  // Whether to show toast notifications for errors
  showToast?: boolean;
  // Custom error message override
  customMessage?: string;
  // Callback when error occurs
  onError?: (error: AppError) => void;
  // Context information for debugging
  context?: Record<string, any>;
}

interface UseErrorHandlerReturn {
  // Current error state
  error: AppError | null;
  // Whether there's currently an error
  hasError: boolean;
  // Clear the current error
  clearError: () => void;
  // Handle an error
  handleError: (error: any, options?: UseErrorHandlerOptions) => AppError;
  // Execute async operation with error handling
  executeAsync: <T>(
    operation: () => Promise<T>,
    options?: UseErrorHandlerOptions
  ) => Promise<T | null>;
  // Execute with retry logic
  executeWithRetry: <T>(
    operation: () => Promise<T>,
    options?: UseErrorHandlerOptions & {
      maxRetries?: number;
      onRetry?: (attempt: number) => void;
    }
  ) => Promise<T | null>;
}

/**
 * Custom hook for consistent error handling throughout the application
 * 
 * @example
 * ```tsx
 * const { handleError, executeAsync, error, clearError } = useErrorHandler();
 * 
 * const loadData = async () => {
 *   await executeAsync(async () => {
 *     const data = await fetchData();
 *     setData(data);
 *   }, { context: { action: 'loadData' } });
 * };
 * ```
 */
export function useErrorHandler(defaultOptions?: UseErrorHandlerOptions): UseErrorHandlerReturn {
  const [error, setError] = useState<AppError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const showToastNotification = useCallback((appError: AppError, customMessage?: string) => {
    // For now, we'll use browser alert/console
    // Later, you can integrate with a toast library like react-hot-toast or sonner
    const message = customMessage || appError.message;
    
    // Different styling based on severity
    const styles = {
      [ErrorSeverity.INFO]: { icon: 'ℹ️', color: '#3b82f6' },
      [ErrorSeverity.WARNING]: { icon: '⚠️', color: '#f59e0b' },
      [ErrorSeverity.ERROR]: { icon: '❌', color: '#ef4444' },
      [ErrorSeverity.CRITICAL]: { icon: '🚨', color: '#dc2626' },
    };

    const style = styles[appError.severity];
    
    // Log to console with styling
    console.group(`${style.icon} ${appError.severity.toUpperCase()}`);
    console.log('%c' + message, `color: ${style.color}; font-weight: bold;`);
    if (appError.retryable) {
      console.log('%cThis error is retryable', 'color: #10b981;');
    }
    console.groupEnd();

    // TODO: Replace with proper toast notification library
    // For now, you can optionally uncomment this for visual feedback during development:
    // alert(`${style.icon} ${message}`);
  }, []);

  const handleError = useCallback(
    (error: any, options?: UseErrorHandlerOptions): AppError => {
      const opts = { ...defaultOptions, ...options };
      const context = {
        ...defaultOptions?.context,
        ...options?.context,
      };

      // Create structured error
      const appError = createAppError(error, context);

      // Log error
      logError(appError);

      // Set error state
      setError(appError);

      // Show toast if enabled
      if (opts.showToast !== false) {
        showToastNotification(appError, opts.customMessage);
      }

      // Call custom error callback
      if (opts.onError) {
        opts.onError(appError);
      }

      return appError;
    },
    [defaultOptions, showToastNotification]
  );

  const executeAsync = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options?: UseErrorHandlerOptions
    ): Promise<T | null> => {
      try {
        clearError();
        const result = await operation();
        return result;
      } catch (err) {
        handleError(err, options);
        return null;
      }
    },
    [clearError, handleError]
  );

  const executeWithRetry = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options?: UseErrorHandlerOptions & {
        maxRetries?: number;
        onRetry?: (attempt: number) => void;
      }
    ): Promise<T | null> => {
      try {
        clearError();
        
        const result = await retryOperation(operation, {
          maxRetries: options?.maxRetries,
          onRetry: (attempt) => {
            console.warn(`Retrying operation (attempt ${attempt})...`);
            if (options?.onRetry) {
              options.onRetry(attempt);
            }
          },
        });
        
        return result;
      } catch (err) {
        handleError(err, {
          ...options,
          customMessage: options?.customMessage || 
            'Operation failed after multiple attempts. Please try again later.',
        });
        return null;
      }
    },
    [clearError, handleError]
  );

  return {
    error,
    hasError: error !== null,
    clearError,
    handleError,
    executeAsync,
    executeWithRetry,
  };
}

/**
 * Hook specifically for form validation errors
 */
export function useFormErrorHandler() {
  const { handleError, error, clearError } = useErrorHandler({
    showToast: false, // Forms usually show inline errors
  });

  const validateField = useCallback(
    (value: any, rules: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      custom?: (value: any) => boolean;
      message?: string;
    }): string | null => {
      if (rules.required && !value) {
        return rules.message || 'This field is required';
      }

      if (rules.minLength && value.length < rules.minLength) {
        return rules.message || `Minimum ${rules.minLength} characters required`;
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        return rules.message || `Maximum ${rules.maxLength} characters allowed`;
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        return rules.message || 'Invalid format';
      }

      if (rules.custom && !rules.custom(value)) {
        return rules.message || 'Invalid value';
      }

      return null;
    },
    []
  );

  return {
    error,
    handleError,
    clearError,
    validateField,
  };
}

/**
 * Hook for async operations with loading state
 */
export function useAsyncErrorHandler<T = any>() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const { error, hasError, clearError, handleError, executeAsync } = useErrorHandler();

  const execute = useCallback(
    async (
      operation: () => Promise<T>,
      options?: UseErrorHandlerOptions
    ): Promise<boolean> => {
      setLoading(true);
      setData(null);
      
      const result = await executeAsync(operation, options);
      
      setLoading(false);
      
      if (result !== null) {
        setData(result);
        return true;
      }
      
      return false;
    },
    [executeAsync]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setData(null);
    clearError();
  }, [clearError]);

  return {
    loading,
    data,
    error,
    hasError,
    execute,
    reset,
    clearError,
    handleError,
  };
}

/**
 * Hook for handling errors in Zustand stores
 */
export function useStoreErrorHandler() {
  const { handleError } = useErrorHandler({
    showToast: true,
  });

  const wrapStoreAction = useCallback(
    <T extends any[], R>(
      action: (...args: T) => Promise<R>,
      context?: Record<string, any>
    ) => {
      return async (...args: T): Promise<R | null> => {
        try {
          return await action(...args);
        } catch (error) {
          handleError(error, { context });
          return null;
        }
      };
    },
    [handleError]
  );

  return {
    handleError,
    wrapStoreAction,
  };
}
