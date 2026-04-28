# xmind: register_new_client
# HTTP: POST {base_url}/nextbot/clients/register
# (для совместимости со старыми backend при необходимости пробуем legacy: /nextbot/studios/{studio_id}/clients/register)
# Args:
#   base_url, api_key, organization_id, first_name, phone;
#   studio_id — опционален (только для legacy-fallback).
#   опционально: last_name, patronymic, instagram, birth_date, referrerCode/referrer_code.
# Result:
#   { ok, status, data: { id }, register_new_client, prompt }

try:
  AP = args
except NameError:
  AP = {}
if AP is None:
  AP = {}

DEFAULT_PROMPT = (
  "СИСТЕМНОЕ СООБЩЕНИЕ: клиент успешно зарегистрирован. "
  "ТВОИ ДЕЙСТВИЯ: радостно поприветствуй клиента, сообщи про Welcome-бонус, "
  "и переведи диалог к выбору услуги/даты записи."
)

base = str(AP.get("base_url") or AP.get("baseUrl") or "").rstrip("/")
api_key = AP.get("api_key") or AP.get("apiKey") or ""
org_id = str(AP.get("organization_id") or AP.get("organizationId") or "").strip()
studio_id = str(AP.get("studio_id") or AP.get("studioId") or "").strip()

first_name = str(AP.get("first_name") or AP.get("firstName") or "").strip()
phone = str(AP.get("phone") or "").strip()

headers = {
  "X-API-Key": api_key,
  "X-Organization-Id": org_id,
  "Accept": "application/json",
  "Content-Type": "application/json",
}

body = {
  "firstName": first_name,
  "phone": phone,
}
last_name = str(AP.get("last_name") or AP.get("lastName") or "").strip()
if last_name:
  body["lastName"] = last_name
patronymic = str(AP.get("patronymic") or "").strip()
if patronymic:
  body["patronymic"] = patronymic
instagram = str(AP.get("instagram") or "").strip()
if instagram:
  body["instagram"] = instagram
birth_date = str(AP.get("birth_date") or AP.get("birthDate") or "").strip()
if birth_date:
  body["birthDate"] = birth_date
referrer = AP.get("referrerCode")
if referrer is None or referrer == "":
  referrer = AP.get("referrer_code")
if referrer is not None and str(referrer).strip() != "":
  body["referrerCode"] = str(referrer).strip()

status_code = 0
prompt_text = DEFAULT_PROMPT
client_id = None
error_code = None
error_message = None
raw_payload = None

if base and first_name and phone:
  try:
    # Актуальный маршрут backend
    url = base + "/nextbot/clients/register"
    r = requests.post(url, headers=headers, json=body, timeout=(3, 10))
    status_code = r.status_code
    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}
    if not isinstance(full, dict):
      full = {}

    # Совместимость со старым backend-роутом (через studioId), если новый путь не сработал.
    if not r.ok:
      if studio_id:
        legacy_url = base + "/nextbot/studios/" + studio_id + "/clients/register"
        r2 = requests.post(legacy_url, headers=headers, json=body, timeout=(3, 10))
        status_code = r2.status_code
        try:
          full = r2.json() if r2.content else {}
        except Exception:
          full = {}
        if not isinstance(full, dict):
          full = {}
      else:
        error_code = "request_failed"
        error_message = "backend_status_" + str(status_code)

    dynamic_prompt = full.get("register_new_client", "")
    if dynamic_prompt:
      prompt_text = str(dynamic_prompt)
    # Возможные формы ответа:
    # { id: ... } или { client: { id: ... } } или другой объект с data.id
    client_id = full.get("id")
    if not client_id and isinstance(full.get("client"), dict):
      client_id = full.get("client", {}).get("id")
    if not client_id and isinstance(full.get("data"), dict):
      client_id = full.get("data", {}).get("id")
    raw_payload = full if full else (r.text or None)
    if not client_id and error_code is None:
      error_code = "client_not_created"
  except Exception as e:
    debug("register_new_client: request_failed " + str(e))
    error_code = "request_failed"
    error_message = str(e)
else:
  debug("register_new_client: missing required args")
  missing = []
  if not base:
    missing.append("base_url")
  if not org_id:
    missing.append("organization_id")
  if not first_name:
    missing.append("first_name")
  if not phone:
    missing.append("phone")
  error_code = "missing_" + "_".join(missing) if missing else "missing_required_args"

result = {
  "ok": bool(client_id) and error_code is None,
  "status": status_code,
  "data": {"id": client_id} if client_id else None,
  "register_new_client": prompt_text,
}
if not result["ok"]:
  result["error"] = error_code or "request_failed"
  if error_message:
    result["error_message"] = error_message
  if raw_payload is not None:
    result["raw"] = raw_payload
