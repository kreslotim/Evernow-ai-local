import { SentryWinstonTransport } from 'src/instrument';
import { createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, json, errors } = format;

// Enhanced custom format for structured logging
const customFormat = printf(
  ({ level, message, timestamp, stack, context, correlationId, userId, service, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: service || 'face-bot-service',
      message,
      ...(correlationId && { correlationId }),
      ...(userId && { userId }),
      ...(context && { context }),
      ...(stack && { stack }),
      ...meta,
    };

    return JSON.stringify(logEntry, null, 2);
  },
);

// Console format with colors for development
const consoleFormat = printf(({ level, message, timestamp, context, correlationId }) => {
  const contextStr = context ? `[${context}]` : '';
  const correlationStr = correlationId ? `[${correlationId}]` : '';
  return `${timestamp} ${contextStr}${correlationStr} [${level.toUpperCase()}]: ${message}`;
});

// File transport with rotation
const fileTransport = new transports.DailyRotateFile({
  filename: 'logs/face-bot-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'info',
});

// Error file transport for errors only
const errorFileTransport = new transports.DailyRotateFile({
  filename: 'logs/face-bot-errors-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
});

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), customFormat),
  defaultMeta: {
    service: 'face-bot-service',
  },
  transports: [
    new transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), consoleFormat),
    }),
    ...(process.env.NODE_ENV === 'production' ? [new SentryWinstonTransport()] : []),
    fileTransport,
    errorFileTransport,
  ],
});

// Enhanced logging methods with context
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  debug(message: string, meta?: Record<string, any>) {
    logger.debug(message, { context: this.context, ...meta });
  }

  info(message: string, meta?: Record<string, any>) {
    logger.info(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, any>) {
    logger.warn(message, { context: this.context, ...meta });
  }

  error(message: string, error?: Error, meta?: Record<string, any>) {
    const errorMeta = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...((error as any).cause && { cause: (error as any).cause }),
          },
        }
      : {};

    logger.error(message, {
      context: this.context,
      ...errorMeta,
      ...meta,
    });
  }

  // Special method for RabbitMQ message processing
  logMessageProcessing(message: string, messageData: any, correlationId?: string) {
    logger.info(message, {
      context: this.context,
      correlationId,
      messageData: {
        taskType: messageData.task_type,
        userId: messageData.user_id,
        chatId: messageData.chat_id,
      },
    });
  }
}

// Handle logger errors
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

// Create default logger instance
export const defaultLogger = new Logger('Application');
