/**
 * Structured logging utility for CiKnight
 * Provides consistent logging with support for debug mode
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  [key: string]: any;
}

export class Logger {
  private debugMode: boolean;

  constructor() {
    this.debugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);

    let logMessage = `[${timestamp}] ${emoji} ${level}: ${message}`;

    if (context && Object.keys(context).length > 0) {
      logMessage += ` | ${JSON.stringify(context)}`;
    }

    return logMessage;
  }

  private getEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return '📝';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      default:
        return '📝';
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.debugMode) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, context));
  }

  /**
   * Log webhook-specific events with structured context
   */
  webhook(
    message: string,
    context: {
      event?: string;
      deliveryId?: string;
      action?: string;
      repoOwner?: string;
      repoName?: string;
      prNumber?: number;
      [key: string]: any;
    }
  ): void {
    this.info(`🔔 Webhook: ${message}`, context);
  }

  /**
   * Log security-related events
   */
  security(message: string, context?: LogContext): void {
    this.warn(`🔒 Security: ${message}`, context);
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.debugMode;
  }

  /**
   * Enable or disable debug mode programmatically
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

// Export a singleton instance
export const logger = new Logger();
