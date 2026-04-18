from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def verify_client_status(cfg: AidaConfig, phone: str) -> Dict[str, Any]:
  """
  GET /nextbot/clients/verify?phone=...
  Один запрос: backend возвращает { found, client } с полным профилем при найденном клиенте.
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
