import React from 'react';
import { AppError, ErrorSeverity } from '@/utils/errorHandling';
import { Button } from '@/components/common/Button';
import { AlertCircle, RefreshCw, Home, Mail, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorFallbackProps {
  error: AppError;
  resetError?: () => void;
  showDetails?: boolean;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  showDetails = false,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  const handleContactSupport = () => {
    const subject = encodeURIComponent(`Error Report: ${error.category}`);
    const body = encodeURIComponent(
      `Error Details:\n\n` +
      `Message: ${error.message}\n` +
      `Technical: ${error.technicalMessage}\n` +
      `Category: ${error.category}\n` +
      `Time: ${error.timestamp.toISOString()}\n` +
      `Code: ${error.code || 'N/A'}\n\n` +
      `Please describe what you were doing when this error occurred:\n\n`
    );
    window.location.href = `mailto:support@yourcompany.com?subject=${subject}&body=${body}`;
  };

  // Color schemes based on severity
  const severityStyles = {
    [ErrorSeverity.INFO]: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-900',
    },
    [ErrorSeverity.WARNING]: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      textColor: 'text-yellow-900',
    },
    [ErrorSeverity.ERROR]: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      textColor: 'text-red-900',
    },
    [ErrorSeverity.CRITICAL]: {
      bg: 'bg-red-100',
      border: 'border-red-300',
      iconBg: 'bg-red-200',
      iconColor: 'text-red-700',
      textColor: 'text-red-950',
    },
  };

  const styles = severityStyles[error.severity];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-2xl w-full">
        {/* Error Card */}
        <div className={`${styles.bg} border ${styles.border} rounded-lg shadow-lg p-8`}>
          {/* Icon and Title */}
          <div className="flex items-start gap-4 mb-6">
            <div className={`${styles.iconBg} p-3 rounded-full flex-shrink-0`}>
              <AlertCircle className={styles.iconColor} size={32} />
            </div>
            <div className="flex-1">
              <h1 className={`text-2xl font-bold ${styles.textColor} mb-2`}>
                {error.severity === ErrorSeverity.CRITICAL
                  ? 'Critical Error'
                  : error.severity === ErrorSeverity.ERROR
                  ? 'Something Went Wrong'
                  : error.severity === ErrorSeverity.WARNING
                  ? 'Warning'
                  : 'Notice'}
              </h1>
              <p className={`text-base ${styles.textColor}`}>{error.message}</p>
            </div>
          </div>

          {/* Retryable Notice */}
          {error.retryable && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800">
                ✓ This error may be temporary. Try refreshing the page or retrying your action.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {resetError && (
              <Button
                onClick={resetError}
                variant="primary"
                size="lg"
                className="flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Try Again
              </Button>
            )}

            <Button
              onClick={handleReload}
              variant="secondary"
              size="lg"
              className="flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Reload Page
            </Button>

            <Button
              onClick={handleGoHome}
              variant="secondary"
              size="lg"
              className="flex items-center gap-2"
            >
              <Home size={18} />
              Go to Dashboard
            </Button>

            {error.severity === ErrorSeverity.CRITICAL && (
              <Button
                onClick={handleContactSupport}
                variant="secondary"
                size="lg"
                className="flex items-center gap-2"
              >
                <Mail size={18} />
                Contact Support
              </Button>
            )}
          </div>

          {/* Technical Details Toggle */}
          {(showDetails || error.severity === ErrorSeverity.CRITICAL) && (
            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <span>Technical Details</span>
                {showTechnicalDetails ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </button>

              {showTechnicalDetails && (
                <div className="mt-4 bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-400">Category:</span>{' '}
                      <span className="text-yellow-400">{error.category}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Severity:</span>{' '}
                      <span className="text-red-400">{error.severity}</span>
                    </div>
                    {error.code && (
                      <div>
                        <span className="text-gray-400">Code:</span>{' '}
                        <span className="text-blue-400">{error.code}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400">Time:</span>{' '}
                      <span className="text-green-400">
                        {error.timestamp.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Retryable:</span>{' '}
                      <span className={error.retryable ? 'text-green-400' : 'text-red-400'}>
                        {error.retryable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {error.technicalMessage && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="text-gray-400 mb-2">Technical Message:</div>
                        <div className="text-red-300">{error.technicalMessage}</div>
                      </div>
                    )}
                    {error.context && Object.keys(error.context).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="text-gray-400 mb-2">Context:</div>
                        <pre className="text-purple-300 whitespace-pre-wrap">
                          {JSON.stringify(error.context, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            If this problem persists, please contact support with the error details above.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact error display for inline use
 */
export const InlineErrorFallback: React.FC<{
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
}> = ({ error, onRetry, onDismiss }) => {
  const severityStyles = {
    [ErrorSeverity.INFO]: 'bg-blue-50 border-blue-200 text-blue-900',
    [ErrorSeverity.WARNING]: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    [ErrorSeverity.ERROR]: 'bg-red-50 border-red-200 text-red-900',
    [ErrorSeverity.CRITICAL]: 'bg-red-100 border-red-300 text-red-950',
  };

  return (
    <div className={`border rounded-lg p-4 ${severityStyles[error.severity]}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="text-sm font-medium">{error.message}</p>
          {error.retryable && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs font-medium underline mt-2 hover:no-underline"
            >
              Try again
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-700 flex-shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};