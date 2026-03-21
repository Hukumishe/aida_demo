from typing import Any, Dict

from ..config import AidaConfig
from .modify_booking import modify_booking


def cancel_booking(cfg: AidaConfig, appointment_id: str) -> Dict[str, Any]:
  """Отмена через status=CANCELLED (если бизнес-логика backend это допускает)."""
  return modify_booking(cfg, appointment_id, {"status": "CANCELLED"})
