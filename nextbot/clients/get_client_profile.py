from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers


def get_client_profile(cfg: AidaConfig, client_id: str) -> Dict[str, Any]:
  """GET /clients/:id"""
  url = f"{cfg.base_url}/clients/{client_id}"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
