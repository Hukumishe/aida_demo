from typing import Any, Dict, Optional

import requests

from ..config import AidaConfig, build_headers


def register_new_client(
  cfg: AidaConfig,
  *,
  first_name: str,
  phone: str,
  last_name: Optional[str] = None,
  birth_date: Optional[str] = None,
  notes: Optional[str] = None,
  bonuses: Optional[int] = None,
  discount: Optional[int] = None,
  balance: Optional[int] = None,
) -> Dict[str, Any]:
  """
  POST /studios/:studioId/clients — то же создание клиента, что в панели.

  birth_date: YYYY-MM-DD (как в CreateClientDto).
  """
  url = f"{cfg.base_url}/studios/{cfg.studio_id}/clients"
  payload: Dict[str, Any] = {
    "firstName": first_name,
    "phone": phone,
  }
  if last_name is not None:
    payload["lastName"] = last_name
  if birth_date is not None:
    payload["birthDate"] = birth_date
  if notes is not None:
    payload["notes"] = notes
  if bonuses is not None:
    payload["bonuses"] = bonuses
  if discount is not None:
    payload["discount"] = discount
  if balance is not None:
    payload["balance"] = balance

  resp = requests.post(url, headers=build_headers(cfg), json=payload, timeout=10)
  resp.raise_for_status()
  return resp.json()
