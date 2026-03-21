from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers


def modify_booking(cfg: AidaConfig, appointment_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
  """
  PATCH /appointments/:id

  Backend принимает только: startAt, prepaymentAmount, status (см. UpdateAppointmentDto).
  Поле serviceId в DTO нет — смена услуги через этот вызов не поддерживается.
  """
  url = f"{cfg.base_url}/appointments/{appointment_id}"
  resp = requests.patch(url, headers=build_headers(cfg), json=patch, timeout=10)
  resp.raise_for_status()
  return resp.json()
