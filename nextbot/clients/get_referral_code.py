from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def get_referral_code(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  """GET /nextbot/studios/:studioId/clients/referral?q= — тот же формат, что в backend."""
  url = f"{nextbot_api_root(cfg)}/studios/{cfg.studio_id}/clients/referral"
  resp = requests.get(
    url,
    headers=build_headers(cfg),
    params={"q": user_contact},
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()
