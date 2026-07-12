/**
 * Centralized logging and error tracking
 * 
 * In production, integrate with services like:
 * - Sentry for error tracking
 * - Firebase Crashlytics for crash reporting
 * - Custom analytics service
 */

interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

class Logger {
  private isDevelopment = __DEV__;
  private enableConsoleLogging = true;

  /**
   * Log debug information (development only)
   */
  debug(message: string, data?: any) {
    if (this.isDevelopment && this.enableConsoleLogging) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }

  /**
   * Log informational messages
   */
  info(message: string, data?: any) {
    if (this.enableConsoleLogging) {
      console.info(`[INFO] ${message}`, data || '');
    }
    // In production, send to analytics service
    this.sendToAnalytics('info', message, data);
  }

  /**
   * Log warnings
   */
  warn(message: string, data?: any) {
    if (this.enableConsoleLogging) {
      console.warn(`[WARN] ${message}`, data || '');
    }
    // In production, send to monitoring service
    this.sendToMonitoring('warn', message, data);
  }

  /**
   * Log errors
   */
  error(message: string, error?: Error | any, context?: any) {
    if (this.enableConsoleLogging) {
      console.error(`[ERROR] ${message}`, error, context || '');
    }
    // In production, send to error tracking service (e.g., Sentry)
    this.sendToErrorTracking(message, error, context);
  }

  /**
   * Log API requests (for debugging)
   */
  apiRequest(method: string, url: string, data?: any) {
    if (this.isDevelopment) {
      this.debug(`API ${method.toUpperCase()} ${url}`, data);
    }
  }

  /**
   * Log API responses (for debugging)
   */
  apiResponse(method: string, url: string, status: number, data?: any) {
    if (this.isDevelopment) {
      this.debug(`API ${method.toUpperCase()} ${url} - ${status}`, data);
    }
  }

  /**
   * Log API errors
   */
  apiError(method: string, url: string, error: any) {
    this.error(`API ${method.toUpperCase()} ${url} failed`, error);
  }

  /**
   * Track user actions for analytics
   */
  trackEvent(eventName: string, properties?: Record<string, any>) {
    this.info(`Event: ${eventName}`, properties);
    // In production, send to analytics service (e.g., Mixpanel, Firebase Analytics)
    this.sendToAnalytics('event', eventName, properties);
  }

  /**
   * Track screen views
   */
  trackScreen(screenName: string, properties?: Record<string, any>) {
    this.info(`Screen: ${screenName}`, properties);
    this.sendToAnalytics('screen', screenName, properties);
  }

  /**
   * Send to analytics service (placeholder)
   * Replace with actual implementation (Firebase Analytics, Mixpanel, etc.)
   */
  private sendToAnalytics(type: string, name: string, data?: any) {
    if (!this.isDevelopment) {
      // TODO: Implement analytics integration
      // Example: Analytics.logEvent(name, data);
    }
  }

  /**
   * Send to monitoring service (placeholder)
   * Replace with actual implementation
   */
  private sendToMonitoring(level: string, message: string, data?: any) {
    if (!this.isDevelopment) {
      // TODO: Implement monitoring integration
    }
  }

  /**
   * Send to error tracking service (placeholder)
   * Replace with actual implementation (Sentry, Bugsnag, etc.)
   */
  private sendToErrorTracking(message: string, error?: Error | any, context?: any) {
    if (!this.isDevelopment) {
      // TODO: Implement error tracking integration
      // Example with Sentry:
      // Sentry.captureException(error, {
      //   tags: { message },
      //   extra: context,
      // });
    }
  }

  /**
   * Set whether to enable console logging
   */
  setConsoleLogging(enabled: boolean) {
    this.enableConsoleLogging = enabled;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };
