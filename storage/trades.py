import json
import os
import time
from typing import List, Dict, Any, Optional

HISTORICO_FILE = os.path.join(os.getcwd(), "historico.json")

def load_history() -> List[Dict[str, Any]]:
    if os.path.exists(HISTORICO_FILE):
        try:
            with open(HISTORICO_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Storage] Error loading historico.json: {e}")
    return []

def save_history(history: List[Dict[str, Any]]) -> None:
    try:
        with open(HISTORICO_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Storage] Error saving historico.json: {e}")

def add_signal_to_history(signal: Dict[str, Any]) -> None:
    hist = load_history()
    hist.insert(0, signal)
    if len(hist) > 100:
        hist = hist[:100]
    save_history(hist)

def resolve_signal(signal_id: str, status: str) -> Optional[Dict[str, Any]]:
    hist = load_history()
    for s in hist:
        if s.get("id") == signal_id or str(s.get("ts")) == signal_id:
            s["status"] = status
            s["resolvidoEm"] = int(time.time() * 1000)
            save_history(hist)
            return s
    return None
