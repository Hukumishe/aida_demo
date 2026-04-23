# xmind: verify_client_status
# HTTP: GET {base_url}/nextbot/clients/verify?phone=...
# Args: base_url, api_key, organization_id [, phone]
# Ответ: verificationStatus — NOT_FOUND | FOUND_WITH_BIRTH_DATE | FOUND_WITHOUT_BIRTH_DATE;
#        found, client; строка verify_client_status — промпт с портала для выбранного сценария.

def toAsciiDigits(value):
  out = []
  for ch in str(value or ""):
    if "0" <= ch <= "9":
      out.append(ch)
      continue
    # Поддержка арабских и персидских цифр.
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

  # Международный префикс 00 -> +
  if digits.startswith("00"):
    digits = digits[2:]
    hadPlus = True

  # Россия/Казахстан: 8XXXXXXXXXX -> +7XXXXXXXXXX
  if (not hadPlus) and len(digits) == 11 and digits.startswith("8"):
    return "+7" + digits[1:]

  # Турция: 05XXXXXXXXX / 5XXXXXXXXX / 90XXXXXXXXXX
  if (not hadPlus) and len(digits) == 11 and digits.startswith("05"):
    return "+90" + digits[1:]
  if (not hadPlus) and len(digits) == 10 and digits.startswith("5"):
    return "+90" + digits
  if (not hadPlus) and len(digits) == 12 and digits.startswith("90"):
    return "+" + digits

  # Если плюс был в исходнике или длина уже международная — приводим к E.164.
  if hadPlus or len(digits) >= 11:
    return "+" + digits

  # Короткие локальные номера оставляем цифровыми без плюса.
  return digits


base = str(args.get("base_url", "") or "").strip().rstrip("/")
phone = str(args.get("phone", "") or "").strip()
apiKey = str(args.get("api_key", "") or "").strip()
organizationId = str(args.get("organization_id", "") or "").strip()
normalizedPhone = normalizePhone(phone)

headers = {
  "X-API-Key": apiKey,
  "X-Organization-Id": organizationId,
  "Accept": "application/json",
}

if not base or not apiKey or not organizationId or not normalizedPhone:
  result = {
    "ok": False,
    "status": 400,
    "error": "invalid_input",
    "normalizedPhone": normalizedPhone,
    "data": "base_url, api_key, organization_id and phone are required",
  }
else:
  try:
    url = base + "/nextbot/clients/verify"
    r = requests.get(url, headers=headers, params={"phone": normalizedPhone}, timeout=15)
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
    result = {
      "ok": False,
      "status": 500,
      "error": "request_failed",
      "normalizedPhone": normalizedPhone,
      "data": str(e),
    }
