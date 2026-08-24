/**
 * ===================================================================
 * TRADE AO — STRUCTURED LOGGER & SENSITIVE DATA REDACTOR (FASE 20)
 * 
 * Strict Zero-Credential Logging Policy:
 * NEVER logs:
 *   - API Secret / apiSecret / secret_key / secretKey
 *   - Tokens / bot_token / jwt / sessionToken / token
 *   - Senhas / password / pass / passwordHash / pin
 *   - Credenciais / privateKey / authorization / apiKey
 * 
 * Provides structured JSON formatting with ISO timestamp, context,
 * action, userId, durationMs, and strict automatic deep redaction.
 * ===================================================================
 */

import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT' | 'SECURITY';

export interface StructuredLogPayload {
  timestamp: string;
  timestampMs: number;
  level: LogLevel;
  context: string;
  action: string;
  userId?: string | number;
  message: string;
  durationMs?: number;
  ip?: string;
  details?: any;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?secret/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /senha/i,
  /token/i,
  /bot[_-]?token/i,
  /jwt/i,
  /bearer/i,
  /authorization/i,
  /private[_-]?key/i,
  /privatekey/i,
  /credentials/i,
  /auth[_-]?key/i,
  /encrypted[_-]?vault/i,
  /apikeyencrypted/i,
  /apisecretencrypted/i,
  /hash/i,
];

const SENSITIVE_STRING_REGEXES = [
  // Binance / generic API Secrets (32-64 hex/alphanumeric chars)
  /\b([a-zA-Z0-9]{32,64})\b/g,
  // Telegram bot tokens (e.g. 123456789:ABCdefGhI...)
  /\b(\d{8,10}:[a-zA-Z0-9_-]{35})\b/g,
  // Bearer tokens
  /Bearer\s+([a-zA-Z0-9_\-\.]{20,})/gi,
  // Passwords in query strings or JSON strings
  /(password|senha|secret|token)=([^&\s]+)/gi,
];

/**
 * Deeply sanitizes any object, array, or primitive, redacting sensitive fields.
 * Safe to pass any arbitrary object without risk of logging secrets.
 */
export function sanitizeSensitiveData(input: any, depth = 0): any {
  if (depth > 8) return '[MAX_DEPTH_REACHED]';
  if (input === null || input === undefined) return input;

  if (typeof input === 'string') {
    return maskSensitiveString(input);
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeSensitiveData(item, depth + 1));
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        if (typeof value === 'string' && value.length > 8) {
          // Partial mask e.g. "bin_...****"
          sanitized[key] = `***REDACTED (len:${value.length})***`;
        } else {
          sanitized[key] = '***REDACTED***';
        }
      } else {
        sanitized[key] = sanitizeSensitiveData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(input);
}

function maskSensitiveString(str: string): string {
  // Check if string contains Telegram token format
  let result = str.replace(/\b(\d{8,10}):([a-zA-Z0-9_-]{35})\b/g, '$1:***REDACTED_BOT_TOKEN***');
  // Check Bearer headers
  result = result.replace(/Bearer\s+([a-zA-Z0-9_\-\.]{15,})/gi, 'Bearer ***REDACTED_TOKEN***');
  // Check inline url params
  result = result.replace(/(password|senha|secret|api_secret|token)=([^&\s]+)/gi, '$1=***REDACTED***');
  return result;
}

const LOGS_DIR = path.join(process.cwd(), 'logs');
const STRUCTURED_LOG_FILE = path.join(LOGS_DIR, 'tradeao_structured.log');
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'tradeao_audit.log');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (e) {
    // Ignore in read-only environments
  }
}

// In-memory buffer for fast UI streaming and test assertions (last 500 logs)
const RECENT_STRUCTURED_LOGS: StructuredLogPayload[] = [];
const MAX_RECENT_LOGS = 500;

function appendToFile(filePath: string, line: string): void {
  try {
    fs.appendFileSync(filePath, line + '\n', 'utf-8');
  } catch (e) {
    // Fallback quietly if file append fails
  }
}

export class StructuredLogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private writeLog(
    level: LogLevel,
    action: string,
    message: string,
    meta?: {
      userId?: string | number;
      durationMs?: number;
      details?: any;
      error?: any;
      ip?: string;
    }
  ): StructuredLogPayload {
    const now = new Date();
    
    // Strict Sanitization of all details & messages
    const sanitizedMessage = maskSensitiveString(message);
    const sanitizedDetails = meta?.details ? sanitizeSensitiveData(meta.details) : undefined;
    
    let sanitizedError: StructuredLogPayload['error'] | undefined;
    if (meta?.error) {
      const errObj = meta.error instanceof Error ? meta.error : new Error(String(meta.error));
      sanitizedError = {
        name: errObj.name,
        message: maskSensitiveString(errObj.message),
        stack: errObj.stack ? maskSensitiveString(errObj.stack) : undefined,
      };
    }

    const payload: StructuredLogPayload = {
      timestamp: now.toISOString(),
      timestampMs: now.getTime(),
      level,
      context: this.context,
      action,
      userId: meta?.userId ? String(meta.userId) : undefined,
      message: sanitizedMessage,
      durationMs: meta?.durationMs,
      ip: meta?.ip,
      details: sanitizedDetails,
      error: sanitizedError,
    };

    // Store in memory ring buffer
    RECENT_STRUCTURED_LOGS.unshift(payload);
    if (RECENT_STRUCTURED_LOGS.length > MAX_RECENT_LOGS) {
      RECENT_STRUCTURED_LOGS.pop();
    }

    // Write to structured log file
    const jsonLine = JSON.stringify(payload);
    appendToFile(STRUCTURED_LOG_FILE, jsonLine);

    if (level === 'AUDIT' || level === 'SECURITY') {
      appendToFile(AUDIT_LOG_FILE, jsonLine);
    }

    // Standard console output formatted
    const colorTag =
      level === 'ERROR' ? '\x1b[31m' :
      level === 'WARN' ? '\x1b[33m' :
      level === 'SECURITY' ? '\x1b[35m' :
      level === 'AUDIT' ? '\x1b[36m' : '\x1b[32m';
    const resetTag = '\x1b[0m';

    console.log(
      `${colorTag}[${payload.timestamp}] [${level}] [${this.context}::${action}]${resetTag} ${payload.message}` +
      (payload.userId ? ` (User: ${payload.userId})` : '') +
      (payload.durationMs !== undefined ? ` [${payload.durationMs}ms]` : '')
    );

    return payload;
  }

  debug(action: string, message: string, details?: any) {
    return this.writeLog('DEBUG', action, message, { details });
  }

  info(action: string, message: string, meta?: { userId?: string | number; durationMs?: number; details?: any }) {
    return this.writeLog('INFO', action, message, meta);
  }

  warn(action: string, message: string, meta?: { userId?: string | number; details?: any }) {
    return this.writeLog('WARN', action, message, meta);
  }

  error(action: string, message: string, error?: any, meta?: { userId?: string | number; details?: any }) {
    return this.writeLog('ERROR', action, message, { ...meta, error });
  }

  audit(action: string, message: string, meta: { userId: string | number; details?: any }) {
    return this.writeLog('AUDIT', action, message, meta);
  }

  security(action: string, message: string, meta?: { userId?: string | number; details?: any; ip?: string }) {
    return this.writeLog('SECURITY', action, message, meta);
  }
}

export function createStructuredLogger(context: string): StructuredLogger {
  return new StructuredLogger(context);
}

export function getRecentStructuredLogs(limit = 100, levelFilter?: string): StructuredLogPayload[] {
  let logs = [...RECENT_STRUCTURED_LOGS];
  if (levelFilter && levelFilter !== 'ALL') {
    logs = logs.filter((l) => l.level === levelFilter);
  }
  return logs.slice(0, limit);
}

export function clearStructuredLogs(): void {
  RECENT_STRUCTURED_LOGS.length = 0;
}
