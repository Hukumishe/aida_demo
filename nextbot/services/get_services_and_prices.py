from typing import Any, Dict, List

import requests

from ..config import AidaConfig, build_headers


def get_services_and_prices(cfg: AidaConfig) -> List[Dict[str, Any]]:
  """GET /studios/:studioId/services"""
  url = f"{cfg.base_url}/studios/{cfg.studio_id}/services"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
