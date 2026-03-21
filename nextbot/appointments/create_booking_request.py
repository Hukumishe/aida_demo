from typing import Any, Dict, Optional

import requests

from ..config import AidaConfig, build_headers


def create_booking_request(
  cfg: AidaConfig,
  *,
  staff_user_id: str,
  client_id: str,
  service_id: str,
  start_at_iso: str,
  prepayment_amount: Optional[int] = None,
) -> Dict[str, Any]:
  """POST /studios/:studioId/appointments"""
  payload: Dict[str, Any] = {
    "staffUserId": staff_user_id,
    "clientId": client_id,
    "serviceId": service_id,
    "startAt": start_at_iso,
  }
  if prepayment_amount is not None:
    payload["prepaymentAmount"] = prepayment_amount

  url = f"{cfg.base_url}/studios/{cfg.studio_id}/appointments"
  resp = requests.post(url, headers=build_headers(cfg), json=payload, timeout=10)
  resp.raise_for_status()
  return resp.json()
