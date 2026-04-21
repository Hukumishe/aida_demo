# xmind: register_new_client
# HTTP: POST {base_url}/nextbot/studios/{studio_id}/clients/register
# (для совместимости при необходимости пробуем legacy: /nextbot/clients/register)
# Args:
#   base_url, api_key, organization_id, studio_id, first_name, phone;
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

if base and studio_id and first_name and phone:
  try:
    url = base + "/nextbot/studios/" + studio_id + "/clients/register"
    r = requests.post(url, headers=headers, json=body, timeout=15)
    status_code = r.status_code
    try:
      full = r.json() if r.content else {}
    except Exception:
      full = {}
    if not isinstance(full, dict):
      full = {}

    # Совместимость со старым backend-роутом.
    if not r.ok:
      legacy_url = base + "/nextbot/clients/register"
      r2 = requests.post(legacy_url, headers=headers, json=body, timeout=15)
      status_code = r2.status_code
      try:
        full = r2.json() if r2.content else {}
      except Exception:
        full = {}
      if not isinstance(full, dict):
        full = {}

    dynamic_prompt = full.get("register_new_client", "")
    if dynamic_prompt:
      prompt_text = str(dynamic_prompt)
    client_id = full.get("id")
  except Exception as e:
    debug("register_new_client: request_failed " + str(e))
else:
  debug("register_new_client: missing required args")

result = {
  "ok": True,
  "status": status_code,
  "data": {"id": client_id},
  "register_new_client": prompt_text,
  "prompt": prompt_text,
}
