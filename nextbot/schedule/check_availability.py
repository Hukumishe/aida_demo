from typing import Any, Dict, Optional

import requests

from ..config import AidaConfig, build_headers, nextbot_api_root


def check_availability(
  cfg: AidaConfig,
  date: str,
  service_id: Optional[str] = None,
  staff_user_id: Optional[str] = None,
  *,
  duration_minutes: Optional[int] = None,
  slot_step_minutes: Optional[int] = None,
) -> Dict[str, Any]:
  """
  GET /nextbot/studios/:studioId/availability-raw
  Ответ: freeSlots, check_availability (промпт для ИИ), durationMinutes, slotStepMinutes, date, studioId.
  """
  url = f"{nextbot_api_root(cfg)}/studios/{cfg.studio_id}/availability-raw"
  params: Dict[str, str] = {"date": date}
  if staff_user_id:
    params["staffUserId"] = staff_user_id
  if service_id:
    params["serviceId"] = service_id
  if duration_minutes is not None:
    params["durationMinutes"] = str(duration_minutes)
  if slot_step_minutes is not None:
    params["slotStepMinutes"] = str(slot_step_minutes)

  resp = requests.get(url, headers=build_headers(cfg), params=params, timeout=20)
  resp.raise_for_status()
  return resp.json()
