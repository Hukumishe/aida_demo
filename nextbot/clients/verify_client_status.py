from typing import Any, Dict, List

import requests

from ..config import AidaConfig, build_headers
from .get_client_profile import get_client_profile


def verify_client_status(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  """
  GET /studios/:studioId/clients?q=...
  """
  url = f"{cfg.base_url}/studios/{cfg.studio_id}/clients"
  resp = requests.get(
    url,
    headers=build_headers(cfg),
    params={"q": user_contact},
    timeout=10,
  )
  resp.raise_for_status()
  clients: List[Dict[str, Any]] = resp.json()

  if not clients:
    return {"found": False, "client": None}

  client_id = clients[0]["id"]
  profile = get_client_profile(cfg, client_id)
  return {"found": True, "client": profile}
