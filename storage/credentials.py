import os
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

def _get_fernet_instance() -> Fernet:
    master_key = os.getenv("APP_ENCRYPTION_KEY", "TradeAO_DefaultMasterKey_DevOnly_2026_SecureKey")
    # Derive 32-byte key for Fernet
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"TradeAO_StaticVaultSalt_v1",
        iterations=100_000,
    )
    derived = base64.urlsafe_b64encode(kdf.derive(master_key.encode()))
    return Fernet(derived)

def encrypt_secret(secret_value: str) -> str:
    """Encrypts a sensitive string (API Key, Secret) using AES-256 Fernet."""
    if not secret_value:
        return ""
    fernet = _get_fernet_instance()
    encrypted_bytes = fernet.encrypt(secret_value.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")

def decrypt_secret(encrypted_value: str) -> Optional[str]:
    """Decrypts a ciphertext into plain text."""
    if not encrypted_value:
        return None
    try:
        fernet = _get_fernet_instance()
        decrypted_bytes = fernet.decrypt(encrypted_value.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        print(f"[CredentialsVault] Decryption failed: {e}")
        return None
