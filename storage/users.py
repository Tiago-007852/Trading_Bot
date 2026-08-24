import json
import os
import re
from datetime import datetime
from typing import Dict, Any, Optional
from storage.credentials import encrypt_secret, decrypt_secret

USERS_FILE = os.path.join(os.getcwd(), "users.json")
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

def load_users() -> Dict[str, Any]:
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Storage] Error loading users.json: {e}")
    return {}

def save_users(users: Dict[str, Any]) -> None:
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Storage] Error saving users.json: {e}")

def validate_email_format(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_REGEX.match(email.strip()))

def find_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    if not email:
        return None
    clean = email.strip().lower()
    users = load_users()
    for user_data in users.values():
        if user_data.get("email", "").lower() == clean:
            return user_data
    return None

def get_user_by_id(chat_id: str | int) -> Optional[Dict[str, Any]]:
    users = load_users()
    return users.get(str(chat_id))

def register_user(chat_id: str | int, email: str) -> tuple[bool, str, Optional[Dict[str, Any]]]:
    if not validate_email_format(email):
        return False, "❌ Formato de e-mail inválido. Digite um e-mail válido (ex: seu@email.com).", None

    clean_email = email.strip().lower()
    if find_user_by_email(clean_email):
        return False, "⚠️ Este e-mail já está registrado no Trade AO.\nDigite outro e-mail ou use /login para entrar.", None

    users = load_users()
    user_record = {
        "email": clean_email,
        "senha": "••••••••••••",
        "tokens": 20.0,
        "chat_id": int(chat_id) if str(chat_id).isdigit() else chat_id,
        "registro": datetime.utcnow().isoformat(),
        "trades": 0,
        "vitorias": 0,
        "autotrade": False,
        "risco": 0.25,
        "clicou_depositar": False,
        "convidado_por": None,
        "broker_credentials": {
            "binance": None,
            "bybit": None,
        },
    }
    users[str(chat_id)] = user_record
    save_users(users)
    return True, "Conta Trade AO criada com sucesso!", user_record

def update_user_credentials(chat_id: str | int, broker: str, api_key: str, api_secret: str, permissions_audit: Optional[dict] = None) -> bool:
    from storage.vault import store_broker_credentials
    users = load_users()
    u = users.get(str(chat_id))
    if not u:
        return False
    
    # Store strictly in isolated encrypted vault
    store_broker_credentials(chat_id, broker, api_key, api_secret, permissions_audit=permissions_audit)
    
    # In user profile, only store non-sensitive boolean flags and timestamps
    if "broker_connections" not in u:
        u["broker_connections"] = {}
    u["broker_connections"][broker.lower()] = {
        "connected": True,
        "connected_at": datetime.utcnow().isoformat(),
        "api_key_preview": f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "******",
    }
    save_users(users)
    return True

def get_user_broker_credentials(chat_id: str | int, broker: str) -> Optional[dict]:
    from storage.vault import get_broker_credentials
    return get_broker_credentials(chat_id, broker)

def remove_user_broker_credentials(chat_id: str | int, broker: str) -> bool:
    from storage.vault import remove_broker_credentials
    users = load_users()
    u = users.get(str(chat_id))
    if u and "broker_connections" in u:
        u["broker_connections"].pop(broker.lower(), None)
        save_users(users)
    return remove_broker_credentials(chat_id, broker)
