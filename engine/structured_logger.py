"""
===================================================================
TRADE AO — STRUCTURED LOGGER & SENSITIVE DATA REDACTOR (FASE 20)
Python Structured Logging with Strict Zero-Credential Logging Policy

NEVER logs:
  - API Secret / apiSecret / secret_key / secretKey
  - Tokens / bot_token / jwt / sessionToken / token
  - Senhas / password / pass / passwordHash / pin
  - Credenciais / privateKey / authorization / apiKey
===================================================================
"""

import os
import re
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

SENSITIVE_KEYS_REGEX = re.compile(
    r"(api[_-]?secret|secret|password|passwd|senha|token|bot[_-]?token|jwt|bearer|authorization|private[_-]?key|credentials|auth[_-]?key|encrypted[_-]?vault|apikeyencrypted|apisecretencrypted|hash)",
    re.IGNORECASE,
)

TELEGRAM_TOKEN_REGEX = re.compile(r"\b(\d{8,10}):([a-zA-Z0-9_-]{35})\b")
BEARER_REGEX = re.compile(r"Bearer\s+([a-zA-Z0-9_\-\.]{15,})", re.IGNORECASE)
PARAM_SECRET_REGEX = re.compile(
    r"(password|senha|secret|api_secret|token)=([^&\s]+)", re.IGNORECASE
)

def mask_sensitive_string(text: str) -> str:
    if not isinstance(text, str):
        return str(text)
    text = TELEGRAM_TOKEN_REGEX.sub(r"\1:***REDACTED_BOT_TOKEN***", text)
    text = BEARER_REGEX.sub(r"Bearer ***REDACTED_TOKEN***", text)
    text = PARAM_SECRET_REGEX.sub(r"\1=***REDACTED***", text)
    return text

def sanitize_sensitive_data(input_data: Any, depth: int = 0) -> Any:
    """
    Recursively redacts sensitive keys and values from dicts, lists, and strings.
    """
    if depth > 8:
        return "[MAX_DEPTH_REACHED]"
    if input_data is None:
        return None

    if isinstance(input_data, str):
        return mask_sensitive_string(input_data)

    if isinstance(input_data, (int, float, bool)):
        return input_data

    if isinstance(input_data, list):
        return [sanitize_sensitive_data(item, depth + 1) for item in input_data]

    if isinstance(input_data, dict):
        sanitized = {}
        for key, value in input_data.items():
            if SENSITIVE_KEYS_REGEX.search(str(key)):
                if isinstance(value, str) and len(value) > 8:
                    sanitized[key] = f"***REDACTED (len:{len(value)})***"
                else:
                    sanitized[key] = "***REDACTED***"
            else:
                sanitized[key] = sanitize_sensitive_data(value, depth + 1)
        return sanitized

    return mask_sensitive_string(str(input_data))

class RedactingJsonFormatter(logging.Formatter):
    """
    Formatter that outputs sanitized JSON strings conforming to Trade AO FASE 20 standard.
    """

    def __init__(self, context: str = "TradeAO_Python"):
        super().__init__()
        self.context = context

    def format(self, record: logging.LogRecord) -> str:
        now = datetime.now(timezone.utc)
        message = record.getMessage()
        sanitized_msg = mask_sensitive_string(message)

        payload: Dict[str, Any] = {
            "timestamp": now.isoformat(),
            "timestampMs": int(time.time() * 1000),
            "level": record.levelname,
            "context": getattr(record, "context", self.context),
            "action": getattr(record, "action", record.funcName or "execution"),
            "message": sanitized_msg,
        }

        user_id = getattr(record, "user_id", None)
        if user_id is not None:
            payload["userId"] = str(user_id)

        duration_ms = getattr(record, "duration_ms", None)
        if duration_ms is not None:
            payload["durationMs"] = round(float(duration_ms), 2)

        details = getattr(record, "details", None)
        if details is not None:
            payload["details"] = sanitize_sensitive_data(details)

        if record.exc_info:
            payload["error"] = {
                "name": record.exc_info[0].__name__ if record.exc_info[0] else "Error",
                "message": mask_sensitive_string(str(record.exc_info[1])),
            }

        return json.dumps(payload, ensure_ascii=False)

def get_structured_logger(name: str = "TradeAO") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(RedactingJsonFormatter(context=name))
        logger.addHandler(handler)
        
        logs_dir = os.path.join(os.getcwd(), "logs")
        os.makedirs(logs_dir, exist_ok=True)
        file_handler = logging.FileHandler(
            os.path.join(logs_dir, "tradeao_python_structured.log"), encoding="utf-8"
        )
        file_handler.setFormatter(RedactingJsonFormatter(context=name))
        logger.addHandler(file_handler)

    return logger
