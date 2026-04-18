from typing import Any, Dict, List

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def get_services_and_prices(cfg: AidaConfig) -> List[Dict[str, Any]]:
  """GET /nextbot/services?studioId=..."""
  url = f"{nextbot_api_root(cfg)}/services"
  params = {"studioId": cfg.studio_id}
  resp = requests.get(url, headers=build_headers(cfg), params=params, timeout=10)
  resp.raise_for_status()
  return resp.json()
