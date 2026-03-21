from typing import Any, Dict, List

import requests

from ..config import AidaConfig, build_headers


def list_prompts(cfg: AidaConfig) -> List[Dict[str, Any]]:
  """
  GET /prompts — список промптов (роль SERVICE; подходит для X-API-Key).

  Можно использовать для динамического Tone of Voice, если ключи заведены в CRM.
  """
  url = f"{cfg.base_url}/prompts"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
