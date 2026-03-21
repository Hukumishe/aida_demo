from typing import Any, Dict, List

import requests

from ..config import AidaConfig, build_headers


def get_active_promotions(cfg: AidaConfig) -> List[Dict[str, Any]]:
  """GET /studios/:studioId/landing/promotions (часто доступен без ключа)."""
  url = f"{cfg.base_url}/studios/{cfg.studio_id}/landing/promotions"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
