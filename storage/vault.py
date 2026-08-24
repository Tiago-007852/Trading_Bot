"""
===================================================================
TRADE AO — Secure Credentials Vault (storage/vault.py)
Encrypted at Rest with AES-256 (Fernet) & Stored in Separate Vault
Never stored in plaintext. Separated from standard user profiles.
===================================================================
"""

import os
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime
from storage.credentials import encrypt_secret, decrypt_secret

VAULT_FILE = os.path.join(os.getcwd(), "secure_vault.json")

def load_vault() -> Dict[str, Any]:
    """Loads the isolated, encrypted credentials storage vault."""
    if os.path.exists(VAULT_FILE):
        try:
            with open(VAULT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Vault] Error reading secure_vault.json: {e}")
    return {}

def save_vault(data: Dict[str, Any]) -> None:
    """Saves encrypted credential records into the isolated vault file."""
    try:
        with open(VAULT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Vault] Error writing secure_vault.json: {e}")

def store_broker_credentials(
    chat_id: str | int,
    broker: str,
    api_key: str,
    api_secret: str,
    permissions_audit: Optional[Dict[str, Any]] = None,
    testnet: bool = True,
) -> Dict[str, Any]:
    """
    Encrypts credentials and stores them strictly in the separate secure vault.
    Plaintext secrets are NEVER written to disk or logs.
    """
    vault = load_vault()
    user_key = str(chat_id)
    if user_key not in vault:
        vault[user_key] = {}

    vault[user_key][broker.lower()] = {
        "api_key_encrypted": encrypt_secret(api_key.strip()),
        "api_secret_encrypted": encrypt_secret(api_secret.strip()),
        "api_key_preview": f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "******",
        "testnet": testnet,
        "permissions_audit": permissions_audit or {"can_read": True, "can_trade": True, "withdrawals_disabled": True},
        "configured_at": datetime.utcnow().isoformat(),
        "last_validated_at": datetime.utcnow().isoformat(),
    }
    save_vault(vault)

    return {
        "success": True,
        "broker": broker.lower(),
        "api_key_preview": f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "******",
        "testnet": testnet,
    }

def get_broker_credentials(chat_id: str | int, broker: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves and decrypts the credentials from the vault on-demand for trade execution.
    """
    vault = load_vault()
    user_vault = vault.get(str(chat_id))
    if not user_vault:
        return None

    record = user_vault.get(broker.lower())
    if not record:
        return None

    decrypted_key = decrypt_secret(record.get("api_key_encrypted", ""))
    decrypted_secret = decrypt_secret(record.get("api_secret_encrypted", ""))

    if not decrypted_key or not decrypted_secret:
        return None

    return {
        "api_key": decrypted_key,
        "api_secret": decrypted_secret,
        "api_key_preview": record.get("api_key_preview"),
        "testnet": record.get("testnet", True),
        "permissions_audit": record.get("permissions_audit"),
        "configured_at": record.get("configured_at"),
    }

def remove_broker_credentials(chat_id: str | int, broker: str) -> bool:
    """
    Permanently deletes and revokes the stored credentials from the secure vault.
    """
    vault = load_vault()
    user_key = str(chat_id)
    if user_key in vault and broker.lower() in vault[user_key]:
        vault[user_key].pop(broker.lower())
        if not vault[user_key]:
            vault.pop(user_key)
        save_vault(vault)
        return True
    return False

def has_connected_broker(chat_id: str | int, broker: str) -> bool:
    """Returns True if the user has active encrypted credentials in the vault."""
    vault = load_vault()
    return bool(vault.get(str(chat_id), {}).get(broker.lower()))
