"""
===================================================================
TRADE AO — Python Bot Daemon & Single-Instance Lock (FASE 18)
Provides 24/7 process resilience, PID lock against duplicate execution,
structured rotating logging, and signal handling for graceful shutdown.
===================================================================
"""

import os
import sys
import signal
import atexit
import logging
from logging.handlers import RotatingFileHandler
from typing import Optional

PID_FILE = os.path.join(os.getcwd(), "storage", "tradeao_bot.pid")
LOGS_DIR = os.path.join(os.getcwd(), "logs")
BOT_LOG_FILE = os.path.join(LOGS_DIR, "tradeao_bot.log")

_lock_acquired = False

def setup_bot_logging(log_level=logging.INFO) -> logging.Logger:
    """Configures structured rotating file logger and console stdout logger."""
    if not os.path.exists(LOGS_DIR):
        os.makedirs(LOGS_DIR, exist_ok=True)
    
    logger = logging.getLogger("TradeAO_Bot")
    logger.setLevel(log_level)
    logger.propagate = False

    # Clear existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()

    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)-8s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S"
    )

    # 1. Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    logger.addHandler(console_handler)

    # 2. Rotating File Handler (10MB max, 5 backup files)
    try:
        file_handler = RotatingFileHandler(
            BOT_LOG_FILE,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(log_level)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"[Daemon] Warning: Could not create RotatingFileHandler: {e}")

    return logger

def acquire_bot_pid_lock(logger: Optional[logging.Logger] = None) -> bool:
    """
    Acquires single-instance PID lockfile.
    Prevents duplicate bot instances from running concurrently.
    """
    global _lock_acquired
    storage_dir = os.path.join(os.getcwd(), "storage")
    if not os.path.exists(storage_dir):
        os.makedirs(storage_dir, exist_ok=True)

    current_pid = os.getpid()
    log = logger or logging.getLogger("TradeAO_Bot")

    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r", encoding="utf-8") as f:
                existing_pid_str = f.read().strip()
                if existing_pid_str:
                    existing_pid = int(existing_pid_str)
                    if existing_pid != current_pid:
                        # Check if process is alive
                        try:
                            os.kill(existing_pid, 0)
                            log.critical(
                                f"❌ Instância duplicada detectada! O bot já está em execução no PID {existing_pid}."
                            )
                            return False
                        except OSError:
                            log.info(
                                f"⚠️ Limpando PID lock obsoleto do PID {existing_pid} (recuperação pós-crash)."
                            )
        except Exception as e:
            log.warning(f"Erro ao verificar PID lockfile anterior: {e}")

    try:
        with open(PID_FILE, "w", encoding="utf-8") as f:
            f.write(str(current_pid))
        _lock_acquired = True
        log.info(f"🔒 PID Lock de instância única adquirido com sucesso (PID: {current_pid})")
        
        # Register atexit cleanup
        atexit.register(release_bot_pid_lock)
        return True
    except Exception as e:
        log.critical(f"Falha ao gravar PID lockfile: {e}")
        return False

def release_bot_pid_lock():
    """Releases the PID lockfile on shutdown."""
    global _lock_acquired
    if _lock_acquired and os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r", encoding="utf-8") as f:
                pid_str = f.read().strip()
                if pid_str == str(os.getpid()):
                    os.remove(PID_FILE)
            _lock_acquired = False
        except Exception:
            pass

def setup_signal_handlers(cleanup_callback=None, logger: Optional[logging.Logger] = None):
    """Configures graceful shutdown signal traps for SIGTERM, SIGINT, SIGHUP."""
    log = logger or logging.getLogger("TradeAO_Bot")

    def handle_shutdown(signum, frame):
        sig_name = signal.Signals(signum).name if hasattr(signal, "Signals") else str(signum)
        log.info(f"🛑 Sinal de parada recebido: {sig_name}. Executando encerramento gracioso...")
        if cleanup_callback:
            try:
                cleanup_callback()
            except Exception as e:
                log.error(f"Erro no callback de limpeza: {e}")
        release_bot_pid_lock()
        sys.exit(0)

    try:
        signal.signal(signal.SIGINT, handle_shutdown)
        signal.signal(signal.SIGTERM, handle_shutdown)
        if hasattr(signal, "SIGHUP"):
            signal.signal(signal.SIGHUP, handle_shutdown)
    except Exception as e:
        log.warning(f"Could not bind all signal handlers: {e}")

    # Top level uncaught exception hook
    def uncaught_exception_hook(exc_type, exc_value, exc_traceback):
        log.critical("💥 Exceção não tratada capturada no processo:", exc_info=(exc_type, exc_value, exc_traceback))
        release_bot_pid_lock()
        sys.__excepthook__(exc_type, exc_value, exc_traceback)

    sys.excepthook = uncaught_exception_hook
