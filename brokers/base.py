"""
===================================================================
TRADE AO — Abstract Broker Interface (brokers/base.py)
Standard contract for all exchange integrations (Binance, Bybit, etc.)
===================================================================
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List

class BaseBroker(ABC):
    """
    Abstract Base Class defining the standard contract for all exchange brokers.
    All implementations must use official REST/WebSocket APIs only.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        testnet: bool = True,
    ):
        self.api_key = api_key
        self.api_secret = api_secret
        self.testnet = testnet

    @abstractmethod
    def connect(self) -> Dict[str, Any]:
        """
        Validates API credentials and checks connection to the exchange endpoint.
        Returns {"connected": bool, "latency_ms": float, "mode": str, "error": Optional[str]}
        """
        pass

    @abstractmethod
    def get_balance(self) -> Dict[str, float]:
        """
        Retrieves current account balances (e.g. USDT, BTC, ETH free and locked).
        Returns mapping of asset ticker to free balance.
        """
        pass

    @abstractmethod
    def get_price(self, symbol: str) -> float:
        """
        Retrieves the latest market price for a given symbol (e.g. 'BTC/USDT' or 'BTCUSDT').
        """
        pass

    @abstractmethod
    def get_ticker(self, symbol: str) -> Dict[str, Any]:
        """
        Fetches detailed ticker statistics including 24h high, low, volume, and percentage change.
        """
        pass

    @abstractmethod
    def open_position(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        order_type: str = "MARKET",
    ) -> Dict[str, Any]:
        """
        Executes an order to open a trading position on the exchange.
        Side: 'BUY' / 'LONG' or 'SELL' / 'SHORT'.
        """
        pass

    @abstractmethod
    def close_position(
        self,
        symbol: str,
        position_id: Optional[str] = None,
        quantity: Optional[float] = None,
        price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Closes an open position by placing an offsetting market/limit order or executing position close.
        """
        pass

    @abstractmethod
    def get_positions(self) -> List[Dict[str, Any]]:
        """
        Returns a list of currently open positions or active asset holdings.
        """
        pass

    @abstractmethod
    def get_open_orders(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Retrieves active open orders waiting for execution on the exchange book.
        """
        pass

    @abstractmethod
    def cancel_order(self, symbol: str, order_id: str | int) -> Dict[str, Any]:
        """
        Cancels an open order on the exchange given its unique orderId.
        """
        pass
