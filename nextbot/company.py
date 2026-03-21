from typing import Any, Dict, List, Optional

import requests

from .config import AidaConfig, build_headers


def get_company_context(cfg: AidaConfig) -> Dict[str, Any]:
  """
  GET /studios — список студий и текущая по cfg.studio_id.
  """
  url = f"{cfg.base_url}/studios"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  studios: List[Dict[str, Any]] = resp.json()

  current_studio: Optional[Dict[str, Any]] = None
  if cfg.studio_id:
    current_studio = next(
      (s for s in studios if s.get("id") == cfg.studio_id),
      None,
    )

  out: Dict[str, Any] = {
    "studios": studios,
    "currentStudio": current_studio,
  }
  if cfg.company_id is not None:
    out["companyId"] = cfg.company_id
  return out


def get_studio_details(cfg: AidaConfig, studio_id: str) -> Dict[str, Any]:
  """GET /studios/:studioId"""
  url = f"{cfg.base_url}/studios/{studio_id}"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()
