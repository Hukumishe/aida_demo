from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def verify_client_status(cfg: AidaConfig, phone: str) -> Dict[str, Any]:
  """
  GET /nextbot/clients/verify?phone=...
  Ответ: verificationStatus, found, client, verify_client_status (промпт для сценария).
  """
  url = f"{nextbot_api_root(cfg)}/clients/verify"
  resp = requests.get(
    url,
    headers=build_headers(cfg),
    params={"phone": phone},
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()
