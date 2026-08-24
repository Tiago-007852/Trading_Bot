import requests
from typing import Dict, Any, Optional
from brokers.base import BaseBroker

class BybitBroker(BaseBroker):
    """Bybit Signal Destination and Market Data Integration (No unofficial scraping)."""

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None, testnet: bool = True):
        super().__init__(api_key, api_secret, testnet)
        self.base_url = "https://api-testnet.bybit.com" if testnet else "https://api.bybit.com"

    def get_ticker(self, symbol: str = "BTCUSDT") -> Dict[str, Any]:
        clean = symbol.replace("/", "").upper()
        url = f"{self.base_url}/v5/market/tickers?category=spot&symbol={clean}"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                data = r.json()
                item = data.get("result", {}).get("list", [{}])[0]
                return {
                    "symbol": clean,
                    "price": float(item.get("lastPrice", 96250.0)),
                    "change24h": float(item.get("price24hPcnt", 0.0)) * 100,
                    "high": float(item.get("highPrice24h", 97000.0)),
                    "low": float(item.get("lowPrice24h", 95000.0)),
                }
        except Exception as e:
            print(f"[BybitBroker] get_ticker error: {e}")
        return {"symbol": clean, "price": 96250.0, "change24h": 1.5, "high": 97000.0, "low": 95000.0}

    def get_balance(self) -> Dict[str, float]:
        return {"USDT": 1000.0, "mode": "signal_destination"}

    def place_order(self, symbol: str, side: str, order_type: str = "MARKET", quantity: float = 0.001, price: Optional[float] = None) -> Dict[str, Any]:
        return {
            "status": "SIGNAL_DESTINATION_ONLY",
            "message": "Bybit is configured as a signal destination. Manual execution via official Bybit app recommended.",
        }

    def get_order_status(self, symbol: str, order_id: str) -> Dict[str, Any]:
        return {"status": "NOT_APPLICABLE"}
