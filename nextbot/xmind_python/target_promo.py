# xmind: target_promo
# HTTP: POST {base_url}/nextbot/target-promo
# Args: base_url, api_key, organization_id [, promo_text, promo_id, phone, dialog_id]
# Ответ: activationStatus (NOT_MATCHED | EXHAUSTED | MATCHED), matched, mechanics, clientId;
#        строка target_promo — инструкции агента с портала (или agentPrompt из CRM при MATCHED).
# studioId в URL не передаётся — акция на уровне организации.

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


base = str(args.get("base_url", "") or "").strip().rstrip("/")
apiKey = str(args.get("api_key", "") or "").strip()
organizationId = str(args.get("organization_id", "") or "").strip()
promoText = str(args.get("promo_text", "") or args.get("promoText", "") or "").strip()
promoId = str(args.get("promo_id", "") or args.get("promoId", "") or "").strip()
phoneRaw = str(args.get("phone", "") or "").strip()
dialogRaw = args.get("dialog_id", args.get("dialogId", ""))

normalizedPhone = normalizePhone(phoneRaw) if phoneRaw else ""

dialogId = None
try:
  if dialogRaw not in ("", None):
    dialogId = int(dialogRaw)
    if dialogId < 1:
      dialogId = None
except Exception:
  dialogId = None

debug("target_promo: start")
debug("promo_text=" + promoText + " promo_id=" + promoId)

headers = {
  "X-API-Key": apiKey,
  "X-Organization-Id": organizationId,
  "Accept": "application/json",
  "Content-Type": "application/json",
}

if not base or not apiKey or not organizationId:
  result = {
    "ok": False,
    "status": 400,
    "error": "invalid_input",
    "data": "base_url, api_key and organization_id are required",
  }
elif not promoText and not promoId:
  result = {
    "ok": False,
    "status": 400,
    "error": "empty_promo",
    "data": "promo_text or promo_id is required",
  }
else:
  body = {}
  if promoText:
    body["promoText"] = promoText
  if promoId:
    body["promoId"] = promoId
  if normalizedPhone:
    body["phone"] = normalizedPhone
  if dialogId is not None:
    body["dialogId"] = dialogId

  try:
    url = base + "/nextbot/target-promo"
    debug("POST " + url)
    r = requests.post(url, headers=headers, json=body, timeout=(2.5, 10))
    try:
      data = r.json() if r.text else {}
    except Exception:
      data = r.text
    result = {
      "ok": r.ok,
      "status": r.status_code,
      "normalizedPhone": normalizedPhone,
      "data": data,
    }
  except Exception as e:
    debug("target_promo fail: " + str(e))
    result = {
      "ok": False,
      "status": 500,
      "error": "request_failed",
      "normalizedPhone": normalizedPhone,
      "data": str(e),
    }
