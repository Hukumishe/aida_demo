import json
from typing import Any, Dict, List, Optional

import requests

from .config import AidaConfig, build_headers


def verify_client_status(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  """
  GET /studios/:studioId/clients?q=...
  """
  url = f"{cfg.base_url}/studios/{cfg.studio_id}/clients"
  resp = requests.get(
    url,
    headers=build_headers(cfg),
    params={"q": user_contact},
    timeout=10,
  )
  resp.raise_for_status()
  clients: List[Dict[str, Any]] = resp.json()

  if not clients:
    return {"found": False, "client": None}

  client_id = clients[0]["id"]
  profile = get_client_profile(cfg, client_id)
  return {"found": True, "client": profile}


def get_client_profile(cfg: AidaConfig, client_id: str) -> Dict[str, Any]:
  """GET /clients/:id"""
  url = f"{cfg.base_url}/clients/{client_id}"
  resp = requests.get(url, headers=build_headers(cfg), timeout=10)
  resp.raise_for_status()
  return resp.json()


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


def process_survey_answers(
  cfg: AidaConfig,
  client_id: str,
  answers: Dict[str, Any],
  *,
  merge_into_notes: bool = True,
  survey_prefix: str = "[NEXTBOT_SURVEY]",
) -> Dict[str, Any]:
  """
  Фиксация ответов анкеты через PATCH /clients/:id (поле notes).

  В API нет отдельной сущности «анкета» — ответы сериализуются в notes.
  При merge_into_notes=True дописывает блок к существующим notes.
  """
  block = f"{survey_prefix} {json.dumps(answers, ensure_ascii=False)}"
  if merge_into_notes:
    existing = get_client_profile(cfg, client_id)
    old = (existing.get("notes") or "").strip()
    new_notes = f"{old}\n\n{block}".strip() if old else block
  else:
    new_notes = block

  url = f"{cfg.base_url}/clients/{client_id}"
  resp = requests.patch(
    url,
    headers=build_headers(cfg),
    json={"notes": new_notes},
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()


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


def check_loyalty_status(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  status = verify_client_status(cfg, user_contact)
  if not status["found"]:
    return {
      "found": False,
      "clientId": None,
      "level": None,
      "bonuses": None,
      "discount": None,
      "rawClient": None,
    }
  client = status["client"]
  return {
    "found": True,
    "clientId": client.get("id"),
    "level": client.get("level"),
    "bonuses": client.get("bonuses"),
    "discount": client.get("discount"),
    "rawClient": client,
  }


def get_referral_code(cfg: AidaConfig, user_contact: str) -> Dict[str, Any]:
  status = verify_client_status(cfg, user_contact)
  if not status["found"]:
    return {"found": False, "clientId": None, "referralCode": None, "rawClient": None}
  client = status["client"]
  return {
    "found": True,
    "clientId": client.get("id"),
    "referralCode": client.get("referralCode"),
    "rawClient": client,
  }
