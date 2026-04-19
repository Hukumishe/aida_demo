# xmind: register_new_client
# POST {base_url}/nextbot/clients/register — создание клиента (CreateClientDto). HTTP 201 = клиент в БД.
# Args:
#   base_url, api_key, organization_id — обязательные;
#   studio_id — контекст филиала в сценарии Nextbot (в теле не передаётся; организация из X-Organization-Id);
#   first_name, phone — обязательные, если не задан payload_json;
#   last_name, patronymic, instagram, birth_date (YYYY-MM-DD) — опционально;
#   referrer_code или referrerCode — реферальный код друга → поле referrerCode в API;
#   referral_link_id — маркетинговая ссылка → referralLinkId; notes; bonuses, discount, balance;
#   payload_json — если задан, тело запроса из JSON (CreateClientDto), остальные поля не собираются.
# Result при успехе:
#   data: { id, firstName }; register_new_client — текст инструкции из панели промптов (ответ API, ключ register_new_client).

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
  "Content-Type": "application/json",
}
url = base + "/nextbot/clients/register"

# studio_id оставляем в args для оркестратора (выбор филиала в диалоге); регистрация клиента организационная.
_ = args.get("studio_id")

pj = args.get("payload_json", None)
body = None

if pj:
  try:
    body = json.loads(pj) if isinstance(pj, str) else pj
  except Exception:
    body = {}
  if not isinstance(body, dict):
    body = {}
else:
  fn = str(args.get("first_name", "") or "").strip()
  ph = str(args.get("phone", "") or "").strip()
  if not fn or not ph:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "register_new_client": "",
      "error": "missing_first_name_or_phone",
    }
    body = None
  else:
    body = {
      "firstName": fn,
      "phone": ph,
    }
    ln = str(args.get("last_name", "") or "").strip()
    if ln:
      body["lastName"] = ln
    pat = str(args.get("patronymic", "") or "").strip()
    if pat:
      body["patronymic"] = pat
    ig = str(args.get("instagram", "") or "").strip()
    if ig:
      body["instagram"] = ig
    bd = str(args.get("birth_date", "") or "").strip()
    if bd:
      body["birthDate"] = bd
    ref = args.get("referrer_code")
    if ref is None or ref == "":
      ref = args.get("referrerCode")
    if ref is not None and str(ref).strip() != "":
      body["referrerCode"] = str(ref).strip()
    rid = args.get("referral_link_id")
    if rid:
      body["referralLinkId"] = rid
    if args.get("notes") is not None:
      body["notes"] = args.get("notes")
    for json_key, arg_key in (("bonuses", "bonuses"), ("discount", "discount"), ("balance", "balance")):
      v = args.get(arg_key)
      if v is not None and v != "":
        try:
          body[json_key] = int(v)
        except (TypeError, ValueError):
          pass

if body is not None:
  try:
    r = requests.post(url, headers=headers, json=body, timeout=15)
    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}

    if not isinstance(full, dict):
      full = {}

    prompt = full.get("register_new_client")
    if prompt is None:
      prompt = ""

    if r.ok and r.status_code in (200, 201):
      result = {
        "ok": True,
        "status": r.status_code,
        "data": {
          "id": full.get("id"),
          "firstName": full.get("firstName"),
        },
        "register_new_client": prompt if isinstance(prompt, str) else str(prompt),
      }
    else:
      result = {
        "ok": False,
        "status": r.status_code,
        "data": None,
        "register_new_client": "",
        "raw": full if full else (r.text or None),
      }
  except Exception as e:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "register_new_client": "",
      "error": "request_failed",
      "error_message": str(e),
    }
