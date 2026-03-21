from typing import Any, Dict

from ..config import AidaConfig
from .modify_booking import modify_booking


def reschedule_booking(
  cfg: AidaConfig,
  appointment_id: str,
  start_at_iso: str,
) -> Dict[str, Any]:
  """Удобная обёртка: только перенос времени."""
  return modify_booking(cfg, appointment_id, {"startAt": start_at_iso})
