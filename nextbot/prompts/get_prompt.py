from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers


def get_prompt(cfg: AidaConfig, prompt_id: str) -> Dict[str, Any]:
  """GET /prompts/:id"""
  url = f"{cfg.base_url}/prompts/{prompt_id}"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
