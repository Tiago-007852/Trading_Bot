"""
===================================================================
TRADE AO — Trading Mode & Real Trading Guardrails (engine/trading_mode.py)
FASE 19: Safe Feature Flag Configuration & Live Trading Protection
===================================================================
Modes allowed:
  - 'paper'   : Virtual execution & simulation (Default & safest)
  - 'testnet' : Official Binance Testnet sandbox execution
  - 'live'    : Real execution with real capital (Requires explicit activation)

DEFAULT: TRADING_MODE=paper
NEVER activate live trading automatically.
===================================================================
"""

import os
import json
import logging
from typing import Dict, Any, List, Literal

logger = logging.getLogger("TradeAO_TradingMode")

ALLOWED_TRADING_MODES: List[str] = ["paper", "testnet", "live"]
DEFAULT_TRADING_MODE: str = "paper"

LIVE_CONFIRMATION_PHRASE: str = "LIVE TRADING ATIVADO"
DEFAULT_USER_LIVE_STATUS: str = "LIVE_DISABLED"

ALLOWED_SPOT_SYMBOLS: List[str] = [
    "BTC/USDT",
    "ETH/USDT",
    "SOL/USDT",
    "BNB/USDT",
    "XRP/USDT",
    "ADA/USDT",
    "DOGE/USDT",
    "AVAX/USDT",
    "DOT/USDT",
    "LINK/USDT",
    "NEAR/USDT",
    "MATIC/USDT",
    "SUI/USDT",
    "APT/USDT",
]

CONFIG_FILE_PATH = os.path.join(os.getcwd(), "storage", "trading_mode.json")
USER_LIVE_STATUS_FILE = os.path.join(os.getcwd(), "storage", "user_live_status.json")

def _load_user_live_states() -> Dict[str, str]:
    if os.path.exists(USER_LIVE_STATUS_FILE):
        try:
            with open(USER_LIVE_STATUS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading {USER_LIVE_STATUS_FILE}: {e}")
    return {}

def _save_user_live_states(states: Dict[str, str]) -> None:
    try:
        os.makedirs(os.path.dirname(USER_LIVE_STATUS_FILE), exist_ok=True)
        with open(USER_LIVE_STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(states, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving {USER_LIVE_STATUS_FILE}: {e}")

def get_user_live_status(user_id: str | int) -> str:
    """Returns 'LIVE_DISABLED' or 'LIVE_ENABLED' for a specific user."""
    states = _load_user_live_states()
    return states.get(str(user_id), DEFAULT_USER_LIVE_STATUS)

def set_user_live_status(
    user_id: str | int,
    status: str,
    confirmation_phrase: str = ""
) -> Dict[str, Any]:
    """
    Sets user live trading status.
    If activating ('LIVE_ENABLED'), strictly requires confirmation_phrase == 'LIVE TRADING ATIVADO'.
    """
    clean_status = status.upper().strip()
    if clean_status not in ["LIVE_ENABLED", "LIVE_DISABLED"]:
        return {
            "success": False,
            "status": get_user_live_status(user_id),
            "error": f"Estado inválido: '{status}'. Permitidos: LIVE_DISABLED, LIVE_ENABLED",
        }

    if clean_status == "LIVE_ENABLED":
        if confirmation_phrase.strip() != LIVE_CONFIRMATION_PHRASE:
            return {
                "success": False,
                "status": get_user_live_status(user_id),
                "error": f"⛔ Confirmação explícita rejeitada: É obrigatório digitar exatamente '{LIVE_CONFIRMATION_PHRASE}' para autorizar o autotrading real.",
            }

    states = _load_user_live_states()
    states[str(user_id)] = clean_status
    _save_user_live_states(states)

    return {
        "success": True,
        "status": clean_status,
        "message": "LIVE TRADING ATIVADO com sucesso." if clean_status == "LIVE_ENABLED" else "LIVE TRADING DESATIVADO.",
    }

def is_user_live_enabled(user_id: str | int) -> bool:
    """Returns True ONLY if global mode is 'live' AND user has explicit LIVE_ENABLED status."""
    return is_live_trading_enabled() and (get_user_live_status(user_id) == "LIVE_ENABLED")

def is_symbol_allowed(symbol: str) -> bool:
    """Validates if pair is on allowed spot whitelist."""
    if not symbol:
        return False
    clean = symbol.strip().upper()
    standard = clean if "/" in clean else f"{clean[:-4]}/{clean[-4:]}"
    is_whitelisted = (clean in ALLOWED_SPOT_SYMBOLS) or (standard in ALLOWED_SPOT_SYMBOLS)
    has_valid_quote = clean.endswith("USDT") or standard.endswith("/USDT")
    return is_whitelisted and has_valid_quote

def get_binance_base_url(mode: str = "") -> str:
    current = mode or get_trading_mode()
    if current == "live":
        return "https://api.binance.com"
    return "https://testnet.binance.vision"

def _read_runtime_override() -> str:
    """Reads runtime override file if present."""
    if os.path.exists(CONFIG_FILE_PATH):
        try:
            with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                mode = data.get("trading_mode", "").lower().strip()
                if mode in ALLOWED_TRADING_MODES:
                    return mode
        except Exception as e:
            logger.warning(f"Error reading {CONFIG_FILE_PATH}: {e}")
    return ""

def get_trading_mode() -> Literal["paper", "testnet", "live"]:
    """
    Returns the currently configured trading mode.
    Precedence:
      1. Runtime configuration file (if set)
      2. Environment variable TRADING_MODE
      3. DEFAULT: 'paper' (always defaults to paper)
    """
    runtime_mode = _read_runtime_override()
    if runtime_mode:
        return runtime_mode  # type: ignore

    env_mode = os.getenv("TRADING_MODE", DEFAULT_TRADING_MODE).lower().strip()
    if env_mode in ALLOWED_TRADING_MODES:
        return env_mode  # type: ignore

    logger.warning(f"Invalid TRADING_MODE '{env_mode}'. Falling back safely to default '{DEFAULT_TRADING_MODE}'.")
    return DEFAULT_TRADING_MODE  # type: ignore

def set_trading_mode(mode: str, updated_by: str = "system") -> Dict[str, Any]:
    """
    Sets the active trading mode. Rejects invalid values.
    Saves state in storage/trading_mode.json.
    """
    clean_mode = mode.lower().strip()
    if clean_mode not in ALLOWED_TRADING_MODES:
        return {
            "success": False,
            "error": f"Modo de trading inválido: '{mode}'. Valores permitidos: {ALLOWED_TRADING_MODES}",
            "current_mode": get_trading_mode(),
        }

    os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
    payload = {
        "trading_mode": clean_mode,
        "updated_at": int(os.path.getmtime(CONFIG_FILE_PATH)) if os.path.exists(CONFIG_FILE_PATH) else None,
        "updated_by": updated_by,
        "is_live": clean_mode == "live",
    }
    
    with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    logger.info(f"TRADING_MODE updated to '{clean_mode}' by {updated_by}.")
    return {
        "success": True,
        "trading_mode": clean_mode,
        "is_live": clean_mode == "live",
        "message": f"Modo de operação atualizado para '{clean_mode.upper()}'.",
    }

def is_live_trading_enabled() -> bool:
    """Returns True ONLY if TRADING_MODE is explicitly set to 'live'."""
    return get_trading_mode() == "live"

def is_testnet_mode() -> bool:
    """Returns True if TRADING_MODE is 'testnet'."""
    return get_trading_mode() == "testnet"

def is_paper_mode() -> bool:
    """Returns True if TRADING_MODE is 'paper' (default)."""
    return get_trading_mode() == "paper"

def assert_live_trading_allowed() -> None:
    """
    Strict guardrail assertion. Raises RuntimeError if an attempt is made
    to dispatch real orders while TRADING_MODE != 'live'.
    """
    current = get_trading_mode()
    if current != "live":
        raise RuntimeError(
            f"⛔ SEGURANÇA BLOQUEADA: Tentativa de envio de ordem real com TRADING_MODE='{current}'. "
            f"O trading real requer TRADING_MODE='live' configurado explicitamente."
        )

def get_trading_mode_status() -> Dict[str, Any]:
    """Returns full status and security guardrail details for the trading mode."""
    current = get_trading_mode()
    return {
        "trading_mode": current,
        "is_live": current == "live",
        "is_testnet": current == "testnet",
        "is_paper": current == "paper",
        "default_mode": DEFAULT_TRADING_MODE,
        "allowed_modes": ALLOWED_TRADING_MODES,
        "guardrails": {
            "neverAutoActivateLive": True,
            "defaultIsPaper": True,
            "requiresExplicitLiveFlag": True,
            "stopLossMandatory": True,
        }
    }

# Aliases for TS/Python interoperability
getUserLiveStatus = get_user_live_status
setUserLiveStatus = set_user_live_status
isUserLiveEnabled = is_user_live_enabled
isSymbolAllowed = is_symbol_allowed
getTradingMode = get_trading_mode
setTradingMode = set_trading_mode
isLiveTradingAllowed = is_live_trading_enabled
getBinanceBaseUrl = get_binance_base_url

