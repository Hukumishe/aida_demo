from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def get_referral_code(cfg: AidaConfig, phone: str) -> Dict[str, Any]:
  """GET /nextbot/clients/referral?phone= — тот же формат, что в backend."""
  url = f"{nextbot_api_root(cfg)}/clients/referral"
  resp = requests.get(
    url,
    headers=build_headers(cfg),
    params={"phone": phone},
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()
