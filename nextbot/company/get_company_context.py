from typing import Any, Dict, List, Optional

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root, parse_company_context_json


def get_company_context(cfg: AidaConfig) -> Dict[str, Any]:
  """
  GET /nextbot/context — organizationId, список студий и текущая по cfg.studio_id.
  """
  url = f"{nextbot_api_root(cfg)}/context"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  raw = resp.json()
  studios, organization_id_from_api, extras = parse_company_context_json(raw)
  effective_org_id = organization_id_from_api or cfg.organization_id

  current_studio: Optional[Dict[str, Any]] = None
  if cfg.studio_id:
    current_studio = next(
      (s for s in studios if s.get("id") == cfg.studio_id),
      None,
    )

  out: Dict[str, Any] = {
    "organizationId": effective_org_id,
    "studios": studios,
    "currentStudio": current_studio,
    **extras,
  }
  if cfg.company_id is not None:
    out["companyId"] = cfg.company_id
  return out
