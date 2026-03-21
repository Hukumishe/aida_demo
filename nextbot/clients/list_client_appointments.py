from typing import Any, Dict, List

import requests

from ..config import AidaConfig, build_headers


def list_client_appointments(
  cfg: AidaConfig,
  client_id: str,
  *,
  upcoming_only: bool = False,
) -> List[Dict[str, Any]]:
  """GET /clients/:id/appointments?upcoming=true|false"""
  url = f"{cfg.base_url}/clients/{client_id}/appointments"
  params: Dict[str, str] = {}
  if upcoming_only:
    params["upcoming"] = "true"
  resp = requests.get(url, headers=build_headers(cfg), params=params, timeout=10)
  resp.raise_for_status()
  return resp.json()
