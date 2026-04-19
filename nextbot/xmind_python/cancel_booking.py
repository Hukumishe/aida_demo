# xmind: cancel_booking
# HTTP: POST {base_url}/nextbot/appointments/{appointment_id}/update
# Тело всегда {"status": "CANCELLED"} — агент не передаёт JSON вручную.
#
# Среда выполнения (как в register_new_client.py): args, requests; json не используется.
#
# Args: base_url, api_key, organization_id, appointment_id
# result: ok, status, data { id, status }, prompt

base = args.get("base_url", "").rstrip("/")
aid = str(args.get("appointment_id", "") or "").strip()
org_id = str(args.get("organization_id", "") or "").strip()

headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
  "Content-Type": "application/json",
}

body = {"status": "CANCELLED"}

_DEFAULT_PROMPT = (
  "Запись отменена. Кратко подтверди клиенту отмену вежливо. "
  "Если отмена позднее чем за 4 часа до визита, предоплата могла быть удержана — при необходимости поясни по правилам сети."
)

if not aid:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "error": "missing_appointment_id",
  }
else:
  url = base + "/nextbot/appointments/" + aid + "/update"
  try:
    r = requests.post(url, headers=headers, json=body, timeout=15)
    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}

    if not isinstance(full, dict):
      full = {}

    prompt_text = full.get("prompt") or full.get("modify_booking") or _DEFAULT_PROMPT
    if not isinstance(prompt_text, str):
      prompt_text = str(prompt_text)

    slim = {
      "id": full.get("id"),
      "status": full.get("status"),
    }

    if r.ok and r.status_code in (200, 201):
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
      "prompt": _DEFAULT_PROMPT,
      "error": "request_failed",
      "error_message": str(e),
    }
