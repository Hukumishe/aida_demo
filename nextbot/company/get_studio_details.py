from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers


def get_studio_details(cfg: AidaConfig, studio_id: str) -> Dict[str, Any]:
  """GET /studios/:studioId"""
  url = f"{cfg.base_url}/studios/{studio_id}"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
