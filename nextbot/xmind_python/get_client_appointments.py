# xmind: get_client_appointments
# HTTP: GET {base_url}/clients/{client_id}/appointments?upcoming=true
#
# Клиент:
#   • client_id — если уже известен;
#   • иначе phone (или phone_lookup): внутри GET /nextbot/clients/verify → id.
# Имя в диалоге для поиска не используется.
#
# Args: base_url, api_key, organization_id,
#       client_id (опционально), phone / phone_lookup (если нет client_id)
# Предстоящие записи: BOOKED | ARRIVED, startAt >= сейчас.

try:
  AP = args
except NameError:
  AP = {}
if AP is None:
  AP = {}


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
  """
  Нормализация номера в единый формат (предпочтительно E.164: +<digits>).
  Поддержка:
  - +7..., 8..., 7...
  - 0090..., +90..., 90..., 05..., 5... (частые турецкие варианты)
  - удаление пробелов, скобок, дефисов и других разделителей.
  """
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
cid = str(AP.get("client_id", "") or "").strip()
phone_lookup = str(AP.get("phone_lookup", "") or "").strip()
ph = str(AP.get("phone", "") or "").strip()
org_id = str(AP.get("organization_id", "") or "").strip()

raw_phone_for_verify = phone_lookup if phone_lookup else ph
verify_phone = normalizePhone(raw_phone_for_verify)

headers = {
  "X-API-Key": AP.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
}

params = {"upcoming": "true"}

result = None
resolved_id = cid

if not resolved_id:
  if not raw_phone_for_verify:
    result = {
      "ok": False,
      "status": 0,
      "data": [],
      "raw": None,
      "error": "missing_client_id_and_phone",
    }
  elif not verify_phone:
    result = {
      "ok": False,
      "status": 0,
      "data": [],
      "raw": None,
      "error": "invalid_phone",
    }
  else:
    try:
      rv = requests.get(
        base + "/nextbot/clients/verify",
        headers=headers,
        params={"phone": verify_phone},
        timeout=(2.5, 7),
      )
      try:
        vj = rv.json() if rv.content else {}
      except Exception:
        vj = {}
      if not isinstance(vj, dict):
        vj = {}
      if not rv.ok:
        result = {
          "ok": False,
          "status": rv.status_code,
          "data": [],
          "raw": vj if vj else (rv.text or None),
          "error": "verify_failed",
          "normalizedPhone": verify_phone,
        }
      elif not vj.get("found"):
        result = {
          "ok": False,
          "status": rv.status_code,
          "data": [],
          "raw": vj,
          "error": "client_not_found",
          "normalizedPhone": verify_phone,
        }
      else:
        cl = vj.get("client")
        if not isinstance(cl, dict) or not cl.get("id"):
          result = {
            "ok": False,
            "status": 0,
            "data": [],
            "raw": None,
            "error": "verify_response_without_client_id",
            "normalizedPhone": verify_phone,
          }
        else:
          resolved_id = str(cl.get("id")).strip()
    except Exception as e:
      result = {
        "ok": False,
        "status": 0,
        "data": [],
        "raw": None,
        "error": "verify_request_failed",
        "error_message": str(e),
        "normalizedPhone": verify_phone,
      }

if result is None and resolved_id:
  url = base + "/clients/" + resolved_id + "/appointments"
  try:
    r = requests.get(url, headers=headers, params=params, timeout=(2.5, 7))
    try:
      body = r.json() if r.content else []
    except Exception:
      body = r.text

    slim = []
    raw_list = body if isinstance(body, list) else []

    for a in raw_list:
      if not isinstance(a, dict):
        continue
      svc = a.get("service") if isinstance(a.get("service"), dict) else {}
      st = a.get("staff") if isinstance(a.get("staff"), dict) else {}
      sp = st.get("staffProfile") if isinstance(st.get("staffProfile"), dict) else {}
      fn = str(sp.get("firstName") or "").strip()
      ln = str(sp.get("lastName") or "").strip()
      staff_name = (fn + " " + ln).strip() or None
      slim.append({
        "id": a.get("id"),
        "startAt": a.get("startAt"),
        "endAt": a.get("endAt"),
        "status": a.get("status"),
        "studioId": a.get("studioId"),
        "serviceId": a.get("serviceId"),
        "serviceName": svc.get("name"),
        "staffName": staff_name,
      })

    out = {
      "ok": r.ok,
      "status": r.status_code,
      "data": slim if r.ok else [],
      "raw": raw_list if r.ok else body,
      "client_id": resolved_id,
    }
    if not cid and verify_phone:
      out["normalizedPhone"] = verify_phone
    result = out
  except Exception as e:
    ex = {
      "ok": False,
      "status": 0,
      "data": [],
      "raw": None,
      "error": "request_failed",
      "error_message": str(e),
    }
    if not cid and verify_phone:
      ex["normalizedPhone"] = verify_phone
    result = ex
