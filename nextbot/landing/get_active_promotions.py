from typing import Any, Dict, List

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def get_active_promotions(cfg: AidaConfig) -> List[Dict[str, Any]]:
  """GET /nextbot/studios/:studioId/landing/promotions."""
  url = f"{nextbot_api_root(cfg)}/studios/{cfg.studio_id}/landing/promotions"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
