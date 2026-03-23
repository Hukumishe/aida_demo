from typing import Any, Dict

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def modify_booking(cfg: AidaConfig, appointment_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
  """
  POST /nextbot/appointments/:id/update

  Backend принимает только: startAt, prepaymentAmount, status (см. UpdateAppointmentDto).
  Поле serviceId в DTO нет — смена услуги через этот вызов не поддерживается.
  """
  url = f"{nextbot_api_root(cfg)}/appointments/{appointment_id}/update"
  resp = requests.post(url, headers=build_headers(cfg), json=patch, timeout=10)
  resp.raise_for_status()
  return resp.json()
