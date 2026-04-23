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

DEFAULT_PROMPT = (
  "СИСТЕМНОЕ СООБЩЕНИЕ: реферальный код в data.referralCode, признак found в data.found. "
  "Озвучь программу Приведи друга и верни диалог к записи или выбору услуг."
)

def toAsciiDigits(value):
  out = []
  for ch in str(value or ""):
    if "0" <= ch <= "9":
      out.append(ch)
      continue
    if "\u0660" <= ch <= "\u0669":
      out.append(str(ord(ch) - ord("\u0660")))
      continue
    if "\u06F0" <= ch <= "\u06F9":
      out.append(str(ord(ch) - ord("\u06F0")))
      continue
    out.append(ch)
  return "".join(out)


def normalizePhone(rawPhone):
  raw = toAsciiDigits(rawPhone).strip()
  if not raw:
    return ""
  hadPlus = raw.startswith("+")
  digits = re.sub(r"\D", "", raw)
  if not digits:
    return ""
  if digits.startswith("00"):
    digits = digits[2:]
    hadPlus = True
  if (not hadPlus) and len(digits) == 11 and digits.startswith("8"):
    return "+7" + digits[1:]
  if (not hadPlus) and len(digits) == 11 and digits.startswith("05"):
    return "+90" + digits[1:]
  if (not hadPlus) and len(digits) == 10 and digits.startswith("5"):
    return "+90" + digits
  if (not hadPlus) and len(digits) == 12 and digits.startswith("90"):
    return "+" + digits
  if hadPlus or len(digits) >= 11:
    return "+" + digits
  return digits


base = str(AP.get("base_url", "") or "").strip().rstrip("/")
phone = normalizePhone(AP.get("phone", ""))
org_id = str(AP.get("organization_id", "") or "").strip()
api_key = str(AP.get("api_key", "") or "").strip()

headers = {
  "X-API-Key": api_key,
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
  elif not base:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": "missing_base_url",
    }
  elif not api_key:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": "missing_api_key",
    }
  elif not org_id:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "error": "missing_organization_id",
    }
  else:
    r = requests.get(url, headers=headers, params={"phone": phone}, timeout=(2.5, 5))
    try:
      body = r.json() if r.content else {}
    except Exception:
      body = {}

    if not isinstance(body, dict):
      body = {}

    prompt_text = body.get("prompt") or body.get("get_referral_code") or DEFAULT_PROMPT
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
    "prompt": DEFAULT_PROMPT,
    "error": "request_failed",
    "error_message": str(e),
  }
