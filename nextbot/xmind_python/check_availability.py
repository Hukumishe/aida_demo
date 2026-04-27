# xmind: check_availability
# HTTP: GET {base_url}/nextbot/studios/{studio_id}/availability-raw
# Query: date (YYYY-MM-DD), serviceIds (обязательны: одна или несколько), staffUserId (опционально).
# В query: serviceIds= id или serviceIds= id1,id2 (или повторы параметра). Legacy: serviceId.
# durationMinutes и slotStepMinutes в query не передаём — сервер считает по услугам.
#
# Args: base_url, api_key, organization_id, studio_id, date,
#       serviceIds (рекомендуется) ИЛИ serviceId / service_id;
#       опционально staffUserId (или staff_user_id).
# Имена в args: snake_case или camelCase (Nextbot) — как в create_booking_request.
#
# result: ok, status, data { durationMinutes, freeSlots[], serviceIds[] }, prompt
# У каждого элемента freeSlots: staffUserId, staffName, startAt, endAt,
# priority (exact|high|normal|low).
# exact — щель ≈ длительности услуги (±5 мин); при услуге <30 мин иначе сетка 30 мин.
# high — слот ПОЛНОСТЬЮ внутри «плотного» окна между двумя подряд записями одного мастера,
#        длина окна которого ≤ highPriorityGapMinutes (настройка организации). Если настройка
#        не задана (null) — high не используется совсем.
# normal — слот ПРИЛЕГАЕТ к какой-то записи мастера: его end не дальше чем
#          normalPriorityToleranceMinutes от старта записи, либо start не дальше того же
#          допуска от конца записи (по умолчанию 0 — строго впритык). Слот не пересекается
#          с записью. НЕ попадает в high.
# low — всё остальное.
#
# Среда Nextbot: json.loads / json.dumps и requests — без import (см. xmind_python/README.md).

try:
  AP = args
except NameError:
  AP = {}
if AP is None:
  AP = {}


def str_first(ap, *keys):
  """Первый непустой строковый аргумент по списку ключей (snake + camel), как a or b or ..."""
  for k in keys:
    v = ap.get(k)
    if v is None:
      continue
    s = str(v).strip()
    if s:
      return s
  return ""


def coalesce_service_ids(ap):
  """
  Собирает список id услуг: serviceIds (строка/список/JSON-массив) или единичный serviceId.
  """
  out = []
  for key in (
    "serviceIds",
    "ServiceIds",
    "service_ids",
    "service_id_list",
    "serviceIdList",
  ):
    raw = ap.get(key)
    if raw is None or raw == "":
      continue
    if isinstance(raw, (list, tuple)):
      for x in raw:
        s = str(x).strip()
        if s:
          out.append(s)
    else:
      text = str(raw).strip()
      if text.startswith("["):
        try:
          j = json.loads(text)
          if isinstance(j, list):
            for x in j:
              s = str(x).strip()
              if s:
                out.append(s)
        except Exception:
          if text.startswith("[") and text.endswith("]"):
            text = text[1:-1]
          for p in text.split(","):
            s = p.strip().strip("'").strip('"')
            if s:
              out.append(s)
      else:
        for p in text.split(","):
          s = p.strip().strip("'").strip('"')
          if s:
            out.append(s)
    if out:
      return out
  single = str_first(ap, "serviceId", "service_id")
  if single:
    return [single]
  return []


def fail_result(error_code, status_code=0, prompt=""):
  return {
    "ok": False,
    "status": status_code,
    "data": None,
    "prompt": prompt,
    "error": error_code,
  }


DEFAULT_PROMPT = (
  "СИСТЕМНОЕ СООБЩЕНИЕ: exact — щель под длительность услуги (±5 мин); "
  "high — слот целиком внутри «плотного» окна между двумя подряд записями одного мастера "
  "(длина окна ≤ highPriorityGapMinutes из настроек организации; если настройка null — high не выдаётся); "
  "normal — слот прилегает к записи мастера с допуском normalPriorityToleranceMinutes "
  "(слот сверху: appt.start − slot.end ≤ допуск; слот снизу: slot.start − appt.end ≤ допуск; "
  "по умолчанию 0 — впритык), но НЕ внутри плотного окна; low — всё остальное. "
  "Предлагай exact и high в первую очередь, затем normal. Не выдумывай слоты вне freeSlots."
)

base = str_first(AP, "base_url", "baseUrl").rstrip("/")
org_id = str_first(AP, "organization_id", "organizationId")
sid = str_first(AP, "studio_id", "studioId")
date = str_first(AP, "date")
service_id_list = coalesce_service_ids(AP)
staff_uid = str_first(AP, "staffUserId", "staff_user_id")

headers = {
  "X-API-Key": str(AP.get("api_key", "") or AP.get("apiKey", "") or ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
}

result = None

if not base:
  result = fail_result("missing_base_url")
elif not org_id:
  result = fail_result("missing_organization_id")
elif not sid:
  result = fail_result("missing_studio_id")
elif not date:
  result = fail_result("missing_date")
elif not service_id_list:
  result = fail_result("missing_service_ids")
else:
  params = {
    "date": date,
    "serviceIds": ",".join(service_id_list),
  }
  if staff_uid:
    params["staffUserId"] = staff_uid

  url = base + "/nextbot/studios/" + sid + "/availability-raw"
  try:
    r = requests.get(url, headers=headers, params=params, timeout=(3, 10))
    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}

    if not isinstance(full, dict):
      full = {}

    prompt_text = full.get("check_availability", "")
    if not prompt_text:
      prompt_text = DEFAULT_PROMPT
    if not isinstance(prompt_text, str):
      prompt_text = str(prompt_text)

    slots = full.get("freeSlots")
    if not isinstance(slots, list):
      slots = []

    resp_ids = full.get("serviceIds")
    if not isinstance(resp_ids, list) or not resp_ids:
      resp_ids = service_id_list
    else:
      resp_ids = [str(x).strip() for x in resp_ids if str(x).strip()]

    slim = {
      "durationMinutes": full.get("durationMinutes"),
      "freeSlots": slots,
      "serviceIds": resp_ids,
    }

    if r.ok and r.status_code == 200:
      result = {
        "ok": True,
        "status": r.status_code,
        "data": slim,
        "prompt": prompt_text,
      }
    else:
      result = {
        "ok": False,
        "status": r.status_code,
        "data": None,
        "prompt": prompt_text,
        "raw": full if full else (r.text or None),
      }
  except Exception as e:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": DEFAULT_PROMPT,
      "error": "request_failed",
      "error_message": str(e),
    }
