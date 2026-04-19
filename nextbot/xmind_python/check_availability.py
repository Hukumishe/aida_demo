# xmind: check_availability
# HTTP: GET {base_url}/nextbot/studios/{studio_id}/availability-raw
# Query: date (YYYY-MM-DD), serviceId (обязателен), staffUserId (опционально).
# durationMinutes и slotStepMinutes в query не передаём — сервер считает по услуге.
#
# Args: base_url, api_key, organization_id, studio_id, date, serviceId (или service_id);
# опционально staffUserId (или staff_user_id).
# result: ok, status, data { durationMinutes, freeSlots[] }, prompt
# У каждого элемента freeSlots: staffUserId, staffName, startAt, endAt,
# priority (exact|high|normal|low). exact — щель ≈ длительности услуги (±5 мин); при услуге <30 мин иначе сетка 30 мин.

try:
  AP = args
except NameError:
  AP = {}
if AP is None:
  AP = {}

DEFAULT_PROMPT = (
  "СИСТЕМНОЕ СООБЩЕНИЕ: exact — щель под длительность услуги (±5 мин); high — между двумя записями; "
  "normal — только первое окно сразу после последней записи мастера в этот день; low — остальное. "
  "Предлагай exact и high в первую очередь. Не выдумывай слоты вне freeSlots."
)

base = str(AP.get("base_url") or AP.get("baseUrl") or "").rstrip("/")
org_id = str(AP.get("organization_id") or AP.get("organizationId") or "").strip()
sid = str(AP.get("studio_id") or AP.get("studioId") or "").strip()
date = str(AP.get("date") or "").strip()
service_id = str(AP.get("serviceId") or AP.get("service_id") or "").strip()
staff_uid = str(AP.get("staffUserId") or AP.get("staff_user_id") or "").strip()

headers = {
  "X-API-Key": AP.get("api_key") or AP.get("apiKey") or "",
  "X-Organization-Id": org_id,
  "Accept": "application/json",
}

if not base:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_base_url",
  }
elif not org_id:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_organization_id",
  }
elif not sid:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_studio_id",
  }
elif not date:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_date",
  }
elif not service_id:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_service_id",
  }
else:
  params = {
    "date": date,
    "serviceId": service_id,
  }
  if staff_uid:
    params["staffUserId"] = staff_uid

  url = base + "/nextbot/studios/" + sid + "/availability-raw"
  try:
    r = requests.get(url, headers=headers, params=params, timeout=20)
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

    slim = {
      "durationMinutes": full.get("durationMinutes"),
      "freeSlots": slots,
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
