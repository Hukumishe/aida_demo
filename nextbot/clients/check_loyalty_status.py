from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def check_loyalty_status(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  """GET /nextbot/clients/loyalty?q= — тот же формат, что в backend."""
  url = f"{nextbot_api_root(cfg)}/clients/loyalty"
  resp = requests.get(
    url,
    headers=build_headers(cfg),
    params={"q": user_contact},
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()
