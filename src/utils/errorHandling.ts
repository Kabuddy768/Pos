/**
 * Error Handling Utilities
 * 
 * This file provides utilities for:
 * - Classifying different types of errors
 * - Converting technical errors to user-friendly messages
 * - Logging errors for debugging
 */

// Error categories for better handling
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  SERVER = 'server',
  UNKNOWN = 'unknown',
}

// Error severity levels
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Structured error object
export interface AppError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  technicalMessage?: string;
  code?: string;
  retryable: boolean;
  timestamp: Date;
  context?: Record<string, any>;
}

/**
 * Classify error based on error message, status code, or error type
 */
export function classifyError(error: any): ErrorCategory {
  // Network errors
  if (
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('NetworkError') ||
    error.code === 'NETWORK_ERROR'
  ) {
    return ErrorCategory.NETWORK;
  }

  // Authentication errors
  if (
    error.message?.includes('Invalid login credentials') ||
    error.message?.includes('not authenticated') ||
    error.message?.includes('session') ||
    error.status === 401 ||
    error.code === 'PGRST301'
  ) {
    return ErrorCategory.AUTHENTICATION;
  }

  // Authorization errors
  if (
    error.message?.includes('permission') ||
    error.message?.includes('not authorized') ||
    error.message?.includes('access denied') ||
    error.status === 403 ||
    error.code === 'PGRST301'
  ) {
    return ErrorCategory.AUTHORIZATION;
  }

  // Validation errors
  if (
    error.message?.includes('invalid') ||
    error.message?.includes('required') ||
    error.message?.includes('must be') ||
    error.message?.includes('validation') ||
    error.status === 400 ||
    error.code === '23514' // Postgres check constraint violation
  ) {
    return ErrorCategory.VALIDATION;
  }

  // Not found errors
  if (
    error.message?.includes('not found') ||
    error.status === 404 ||
    error.code === 'PGRST116'
  ) {
    return ErrorCategory.NOT_FOUND;
  }

  // Conflict errors (duplicate, concurrent modification)
  if (
    error.message?.includes('already exists') ||
    error.message?.includes('duplicate') ||
    error.message?.includes('conflict') ||
    error.status === 409 ||
    error.code === '23505' // Postgres unique violation
  ) {
    return ErrorCategory.CONFLICT;
  }

  // Server errors
  if (
    error.status >= 500 ||
    error.message?.includes('server error') ||
    error.message?.includes('internal error')
  ) {
    return ErrorCategory.SERVER;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Determine if an error is retryable
 */
export function isRetryable(category: ErrorCategory): boolean {
  return [
    ErrorCategory.NETWORK,
    ErrorCategory.SERVER,
  ].includes(category);
}

/**
 * Get error severity based on category
 */
export function getErrorSeverity(category: ErrorCategory): ErrorSeverity {
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
    case ErrorCategory.AUTHORIZATION:
      return ErrorSeverity.WARNING;
    case ErrorCategory.SERVER:
      return ErrorSeverity.CRITICAL;
    case ErrorCategory.VALIDATION:
    case ErrorCategory.NOT_FOUND:
    case ErrorCategory.CONFLICT:
      return ErrorSeverity.INFO;
    case ErrorCategory.NETWORK:
      return ErrorSeverity.WARNING;
    default:
      return ErrorSeverity.ERROR;
  }
}

/**
 * Convert technical error to user-friendly message
 */
export function getUserFriendlyMessage(error: any, category?: ErrorCategory): string {
  const errorCategory = category || classifyError(error);

  switch (errorCategory) {
    case ErrorCategory.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case ErrorCategory.AUTHENTICATION:
      return 'Your session has expired or credentials are invalid. Please log in again.';
    
    case ErrorCategory.AUTHORIZATION:
      return 'You do not have permission to perform this action.';
    
    case ErrorCategory.VALIDATION:
      // Try to extract specific validation message
      if (error.message?.includes('email')) {
        return 'Please enter a valid email address.';
      }
      if (error.message?.includes('password')) {
        return 'Password does not meet requirements.';
      }
      return error.message || 'The information provided is invalid. Please check and try again.';
    
    case ErrorCategory.NOT_FOUND:
      return 'The requested item was not found.';
    
    case ErrorCategory.CONFLICT:
      if (error.message?.includes('email')) {
        return 'This email address is already registered.';
      }
      if (error.message?.includes('sku')) {
        return 'A product with this SKU already exists.';
      }
      return 'This item already exists or conflicts with existing data.';
    
    case ErrorCategory.SERVER:
      return 'A server error occurred. Our team has been notified. Please try again later.';
    
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Create structured error object from any error
 */
export function createAppError(error: any, context?: Record<string, any>): AppError {
  const category = classifyError(error);
  const severity = getErrorSeverity(category);
  const retryable = isRetryable(category);

  return {
    category,
    severity,
    message: getUserFriendlyMessage(error, category),
    technicalMessage: error.message || String(error),
    code: error.code || error.status?.toString(),
    retryable,
    timestamp: new Date(),
    context,
  };
}

/**
 * Log error to console with formatting
 */
export function logError(appError: AppError): void {
  const emoji = {
    [ErrorSeverity.INFO]: 'ℹ️',
    [ErrorSeverity.WARNING]: '⚠️',
    [ErrorSeverity.ERROR]: '❌',
    [ErrorSeverity.CRITICAL]: '🚨',
  };

  const logMethod = {
    [ErrorSeverity.INFO]: console.info,
    [ErrorSeverity.WARNING]: console.warn,
    [ErrorSeverity.ERROR]: console.error,
    [ErrorSeverity.CRITICAL]: console.error,
  };

  const log = logMethod[appError.severity] || console.error;

  log(
    `${emoji[appError.severity]} [${appError.category.toUpperCase()}]`,
    appError.message,
    '\nTechnical:', appError.technicalMessage,
    '\nRetryable:', appError.retryable,
    '\nTimestamp:', appError.timestamp.toISOString(),
    appError.context ? '\nContext:' : '',
    appError.context || ''
  );
}

/**
 * Handle async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ data: T | null; error: AppError | null }> {
  try {
    const data = await operation();
    return { data, error: null };
  } catch (err) {
    const appError = createAppError(err, context);
    logError(appError);
    return { data: null, error: appError };
  }
}

/**
 * Retry async operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const appError = createAppError(error);

      // Don't retry if not retryable
      if (!appError.retryable || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if error is of specific category
 */
export function isErrorCategory(error: any, category: ErrorCategory): boolean {
  return classifyError(error) === category;
}

/**
 * Extract error message from various error formats
 */
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.error?.message) {
    return error.error.message;
  }

  if (error?.data?.message) {
    return error.data.message;
  }

  return 'An unknown error occurred';
}