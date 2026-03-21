from typing import Any, Dict

from ..config import AidaConfig
from .verify_client_status import verify_client_status


def get_referral_code(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  status = verify_client_status(cfg, user_contact)
  if not status["found"]:
    return {"found": False, "clientId": None, "referralCode": None, "rawClient": None}
  client = status["client"]
  return {
    "found": True,
    "clientId": client.get("id"),
    "referralCode": client.get("referralCode"),
    "rawClient": client,
  }
