# xmind: update_old_client_profile
# HTTP: PATCH {base_url}/nextbot/clients/{client_id}/update — тело UpdateClientDto.
#
# Клиент задаётся так:
#   • client_id — если уже известен (переменная сценария после verify / регистрации);
#   • иначе по телефону: внутри вызывается GET /nextbot/clients/verify (как verify_client_status).
# Имя в чате для поиска не используется — в CRM клиент определяется по номеру.
#
# Args: base_url, api_key, organization_id,
#       client_id (опционально),
#       phone_lookup — для поиска, если нет client_id (номер как в CRM до смены);
#       phone — обязателен в теле PATCH; если нет client_id и пуст phone_lookup, для поиска используется phone;
#       first_name/firstName, last_name/lastName, patronymic, instagram,
#       birth_date/birthDate, referrer_code/referrerCode
# Успех (минимум полей): ok, status, data { id, firstName, phone }, update_old_client_profile;
# Без prompt и без дубля client_id (id только в data).

base = args.get("base_url", "").rstrip("/")
org_id = str(args.get("organization_id", "") or "").strip()

headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
  "Content-Type": "application/json",
}

cid = str(args.get("client_id", "") or "").strip()
phone_lookup = str(args.get("phone_lookup", "") or "").strip()
fn = str(args.get("first_name", "") or args.get("firstName", "") or "").strip()
ph = str(args.get("phone", "") or "").strip()
ln = str(args.get("last_name", "") or args.get("lastName", "") or "").strip()
pat = str(args.get("patronymic", "") or "").strip()
ig = str(args.get("instagram", "") or "").strip()
bd = str(args.get("birth_date", "") or args.get("birthDate", "") or "").strip()
ref = args.get("referrer_code")
if ref is None or ref == "":
  ref = args.get("referrerCode")

body = {"firstName": fn, "phone": ph}
if ln:
  body["lastName"] = ln
if pat:
  body["patronymic"] = pat
if ig:
  body["instagram"] = ig
if bd:
  body["birthDate"] = bd
if ref is not None and str(ref).strip() != "":
  body["referrerCode"] = str(ref).strip()

result = None

if not fn or not ph:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "update_old_client_profile": "",
    "error": "missing_first_name_or_phone",
  }
else:
  resolved_id = cid
  if not resolved_id:
    verify_phone = phone_lookup if phone_lookup else ph
    if not verify_phone:
      result = {
        "ok": False,
        "status": 0,
        "data": None,
        "update_old_client_profile": "",
        "error": "missing_client_id_and_phone",
      }
    else:
      try:
        rv = requests.get(
          base + "/nextbot/clients/verify",
          headers=headers,
          params={"phone": verify_phone},
          timeout=(2.5, 5),
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
            "data": None,
            "update_old_client_profile": "",
            "error": "verify_failed",
            "raw": vj if vj else (rv.text or None),
          }
        elif not vj.get("found"):
          result = {
            "ok": False,
            "status": rv.status_code,
            "data": None,
            "update_old_client_profile": "",
            "error": "client_not_found",
            "verify_client_status": vj.get("verify_client_status", ""),
          }
        else:
          cl = vj.get("client")
          if not isinstance(cl, dict) or not cl.get("id"):
            result = {
              "ok": False,
              "status": 0,
              "data": None,
              "update_old_client_profile": "",
              "error": "verify_response_without_client_id",
            }
          else:
            resolved_id = str(cl.get("id")).strip()
      except Exception as e:
        result = {
          "ok": False,
          "status": 0,
          "data": None,
          "update_old_client_profile": "",
          "error": "verify_request_failed",
          "error_message": str(e),
        }

  if result is None and resolved_id:
    url = base + "/nextbot/clients/" + resolved_id + "/update"
    try:
      r = requests.patch(url, headers=headers, json=body, timeout=(3, 10))
      try:
        full = r.json() if r.content else {}
      except Exception:
        full = {}

      if not isinstance(full, dict):
        full = {}

      prompt_text = full.get("update_old_client_profile")
      if prompt_text is None or (isinstance(prompt_text, str) and prompt_text.strip() == ""):
        prompt_text = full.get("prompt")
      if prompt_text is None:
        prompt_text = ""
      if not isinstance(prompt_text, str):
        prompt_text = str(prompt_text)

      if r.ok:
        slim = {
          "id": full.get("id"),
          "firstName": full.get("firstName"),
          "phone": full.get("phone"),
        }
        result = {
          "ok": True,
          "status": r.status_code,
          "data": slim,
          "update_old_client_profile": prompt_text,
        }
      else:
        result = {
          "ok": False,
          "status": r.status_code,
          "data": None,
          "update_old_client_profile": "",
          "raw": full if full else (r.text or None),
        }
    except Exception as e:
      result = {
        "ok": False,
        "status": 0,
        "data": None,
        "update_old_client_profile": "",
        "error": "request_failed",
        "error_message": str(e),
      }
