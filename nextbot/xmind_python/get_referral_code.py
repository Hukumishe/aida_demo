# xmind: get_referral_code
# HTTP: GET {base_url}/nextbot/clients/referral?phone=...
# Args: base_url, api_key, organization_id, phone (client_id не нужен, studio_id не используется)
# result: ok, status, data { found, referralCode }, prompt

try:
  AP = args
except NameError:
  AP = {}
if AP is None:
  AP = {}

_DEFAULT_PROMPT = (
  "СИСТЕМНОЕ СООБЩЕНИЕ: реферальный код в data.referralCode, признак found в data.found. "
  "Озвучь программу Приведи друга и верни диалог к записи или выбору услуг."
)

base = AP.get("base_url", "").rstrip("/")
phone = str(AP.get("phone", "") or "").strip()
org_id = str(AP.get("organization_id", "") or "").strip()

headers = {
  "X-API-Key": AP.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
}

url = base + "/nextbot/clients/referral"

try:
  if not phone:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": "missing_phone",
    }
  else:
    r = requests.get(url, headers=headers, params={"phone": phone}, timeout=15)
    try:
      body = r.json() if r.content else {}
    except Exception:
      body = {}

    if not isinstance(body, dict):
      body = {}

    prompt_text = body.get("prompt") or body.get("get_referral_code") or _DEFAULT_PROMPT
    if not isinstance(prompt_text, str):
      prompt_text = str(prompt_text)

    slim = {
      "found": body.get("found"),
      "referralCode": body.get("referralCode"),
    }

    if r.ok:
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
        "raw": body if body else r.text,
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
