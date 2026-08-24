from typing import Dict, Any, List

class PositionManager:
    """Manages active user positions in memory."""

    def __init__(self):
        self._positions: Dict[str, Dict[str, Any]] = {}

    def open_position(self, trade_id: str, data: Dict[str, Any]) -> None:
        self._positions[trade_id] = data

    def close_position(self, trade_id: str, result: str, profit: float) -> Optional[Dict[str, Any]]:
        if trade_id in self._positions:
            pos = self._positions.pop(trade_id)
            pos["status"] = "closed"
            pos["resultado"] = result
            pos["lucro"] = profit
            return pos
        return None

    def get_open_positions(self) -> List[Dict[str, Any]]:
        return list(self._positions.values())

position_manager = PositionManager()
