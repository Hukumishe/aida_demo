from typing import Any, Dict, Optional

import requests

from .config import AidaConfig, build_headers


def check_availability(
  cfg: AidaConfig,
  date: str,
  service_id: Optional[str] = None,
  staff_user_id: Optional[str] = None,
) -> Dict[str, Any]:
  """
  Сырые данные для расчёта слотов на стороне Nextbot:
  GET schedule, busy-slots, appointments за дату.
  """
  headers = build_headers(cfg)
  params: Dict[str, str] = {"date": date}
  if staff_user_id:
    params["staffUserId"] = staff_user_id

  base = f"{cfg.base_url}/studios/{cfg.studio_id}"
  schedule_resp = requests.get(
    f"{base}/schedule", headers=headers, params=params, timeout=10
  )
  schedule_resp.raise_for_status()
  busy_resp = requests.get(
    f"{base}/busy-slots", headers=headers, params=params, timeout=10
  )
  busy_resp.raise_for_status()
  appt_resp = requests.get(
    f"{base}/appointments", headers=headers, params=params, timeout=10
  )
  appt_resp.raise_for_status()

  return {
    "scheduleDays": schedule_resp.json(),
    "busySlots": busy_resp.json(),
    "appointments": appt_resp.json(),
    "serviceIdHint": service_id,
    "staffUserIdHint": staff_user_id,
  }
