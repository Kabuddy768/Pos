import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createAppError, logError, AppError } from '@/utils/errorHandling';
import { ErrorFallback } from '@/components/common/ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Custom fallback component (optional)
  fallback?: (error: AppError, resetError: () => void) => ReactNode;
  // Callback when error is caught
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  // Reset the error when these props change
  resetKeys?: Array<string | number>;
  // Context information for debugging
  context?: Record<string, any>;
  // Custom error message
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   context={{ page: 'Dashboard' }}
 *   onError={(error) => console.log('Error caught:', error)}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    const appError = createAppError(error);
    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Create structured error with context
    const appError = createAppError(error, {
      ...this.props.context,
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Log the error
    logError(appError);

    // Log React component stack
    console.error('React Component Stack:', errorInfo.componentStack);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // TODO: Send to error reporting service (e.g., Sentry, LogRocket)
    // Example:
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: { componentStack: errorInfo.componentStack }
    //   }
    // });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { error } = this.state;
    const { resetKeys } = this.props;

    // Reset error state when resetKeys change
    if (error && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevResetKeys[index]
      );

      if (hasResetKeyChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.resetError);
      }

      // Use default ErrorFallback component
      return (
        <ErrorFallback
          error={error}
          resetError={this.resetError}
          showDetails={true}
        />
      );
    }

    return children;
  }
}

/**
 * Hook-based error boundary wrapper
 * For use in functional components that need error boundary features
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  // Set display name for better debugging
  const componentName = Component.displayName || Component.name || 'Component';
  WrappedComponent.displayName = `withErrorBoundary(${componentName})`;

  return WrappedComponent;
}

/**
 * Specialized Error Boundary for async operations
 * Automatically resets when the async operation succeeds
 */
export class AsyncErrorBoundary extends Component<
  ErrorBoundaryProps & { isLoading?: boolean },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { isLoading?: boolean }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = createAppError(error);
    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const appError = createAppError(error, {
      ...this.props.context,
      componentStack: errorInfo.componentStack,
      asyncOperation: true,
    });

    logError(appError);

    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps & { isLoading?: boolean }): void {
    // Reset error when loading starts (user retrying)
    if (!prevProps.isLoading && this.props.isLoading && this.state.hasError) {
      this.setState({
        hasError: false,
        error: null,
      });
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.resetError);
      }

      return (
        <ErrorFallback
          error={error}
          resetError={this.resetError}
          showDetails={true}
        />
      );
    }

    return children;
  }
}

/**
 * Error Boundary specifically for routes
 * Provides navigation-specific error handling
 */
export class RouteErrorBoundary extends Component<
  ErrorBoundaryProps & { routeName?: string },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { routeName?: string }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = createAppError(error);
    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const appError = createAppError(error, {
      ...this.props.context,
      route: this.props.routeName,
      componentStack: errorInfo.componentStack,
      routeError: true,
    });

    logError(appError);

    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, routeName } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.resetError);
      }

      // Add route context to error
      const routeError = {
        ...error,
        context: {
          ...error.context,
          route: routeName,
        },
      };

      return (
        <ErrorFallback
          error={routeError}
          resetError={this.resetError}
          showDetails={true}
        />
      );
    }

    return children;
  }
}

/**
 * Lightweight error boundary for small sections
 * Shows inline error instead of full-page fallback
 */
export class InlineErrorBoundary extends Component<
  ErrorBoundaryProps & { showInline?: boolean },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { showInline?: boolean }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = createAppError(error);
    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const appError = createAppError(error, {
      ...this.props.context,
      componentStack: errorInfo.componentStack,
      inlineError: true,
    });

    logError(appError);

    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, showInline = true } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.resetError);
      }

      if (showInline) {
        // Show compact inline error
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-red-600">⚠️</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-1">
                  {error.message}
                </p>
                <button
                  onClick={this.resetError}
                  className="text-xs text-red-700 underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <ErrorFallback
          error={error}
          resetError={this.resetError}
          showDetails={false}
        />
      );
    }

    return children;
  }
}