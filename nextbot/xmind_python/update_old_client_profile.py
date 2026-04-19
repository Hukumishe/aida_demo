# xmind: update_old_client_profile
# HTTP: PATCH {base_url}/nextbot/clients/{client_id}/update — тело UpdateClientDto.
# Ответ: объект клиента + ключ update_old_client_profile (промпт с бэкенда: панель AIDA или фолбэк в Nest).
#
# Args: base_url, api_key, organization_id, client_id, phone, first_name,
#       last_name, patronymic, instagram, birth_date (YYYY-MM-DD; пусто — не отправляем)
# Опциональные строки с пустым значением в JSON не включаем (чтобы не затирать поля в CRM).

base = args.get("base_url", "").rstrip("/")
cid = str(args.get("client_id", "") or "").strip()
org_id = str(args.get("organization_id", "") or "").strip()

headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
  "Content-Type": "application/json",
}

fn = str(args.get("first_name", "") or "").strip()
ph = str(args.get("phone", "") or "").strip()
ln = str(args.get("last_name", "") or "").strip()
pat = str(args.get("patronymic", "") or "").strip()
ig = str(args.get("instagram", "") or "").strip()
bd = str(args.get("birth_date", "") or "").strip()

body = {"firstName": fn, "phone": ph}
if ln:
  body["lastName"] = ln
if pat:
  body["patronymic"] = pat
if ig:
  body["instagram"] = ig
if bd:
  body["birthDate"] = bd

if not cid:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "update_old_client_profile": "",
    "error": "missing_client_id",
  }
elif not fn or not ph:
  result = {
    "ok": False,
    "status": 0,
    "data": None,
    "prompt": "",
    "update_old_client_profile": "",
    "error": "missing_first_name_or_phone",
  }
else:
  url = base + "/nextbot/clients/" + cid + "/update"
  try:
    r = requests.patch(url, headers=headers, json=body, timeout=15)
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
        "prompt": prompt_text,
        "update_old_client_profile": prompt_text,
      }
    else:
      result = {
        "ok": False,
        "status": r.status_code,
        "data": None,
        "prompt": "",
        "update_old_client_profile": "",
        "raw": full if full else (r.text or None),
      }
  except Exception as e:
    result = {
      "ok": False,
      "status": 0,
      "data": None,
      "prompt": "",
      "update_old_client_profile": "",
      "error": "request_failed",
      "error_message": str(e),
    }
