from typing import Any, Dict, List, Optional

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def get_company_context(cfg: AidaConfig) -> Dict[str, Any]:
  """
  GET /nextbot/context — список студий (как в панели) и текущая по cfg.studio_id.
  """
  url = f"{nextbot_api_root(cfg)}/context"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  raw = resp.json()
  studios: List[Dict[str, Any]] = raw if isinstance(raw, list) else []

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
