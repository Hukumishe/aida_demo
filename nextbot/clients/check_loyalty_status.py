from typing import Any, Dict

from ..config import AidaConfig
from .verify_client_status import verify_client_status


def check_loyalty_status(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  status = verify_client_status(cfg, user_contact)
  if not status["found"]:
    return {
      "found": False,
      "clientId": None,
      "level": None,
      "bonuses": None,
      "discount": None,
      "rawClient": None,
    }
  client = status["client"]
  return {
    "found": True,
    "clientId": client.get("id"),
    "level": client.get("level"),
    "bonuses": client.get("bonuses"),
    "discount": client.get("discount"),
    "rawClient": client,
  }
