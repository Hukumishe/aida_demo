# xmind: get_services_and_prices
# HTTP: GET {base_url}/nextbot/studios/{studio_id}/services
#       ?organizationId=<org>&category=<id|name>&audience=<MEN|WOMEN>
# Args (kwargs): base_url, api_key, studio_id, organization_id, category, audience
# Ответ бэкенда уже отфильтрован по студии / категории / полу. Обёртка оставляет
# только минимально необходимые поля для презентации клиенту:
#   data[].id, data[].name, data[].description, data[].defaultPrice, data[].defaultDurationMin
# plus prompt — системная инструкция для бота.

base = args.get("base_url", "").rstrip("/")
sid = str(args.get("studio_id", "") or "").strip()
org_id = str(args.get("organization_id", "") or "").strip()
category = str(args.get("category", "") or "").strip()
audience = str(args.get("audience", "") or "").strip()

headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": org_id,
  "Accept": "application/json",
}

params = {}
if org_id:
  params["organizationId"] = org_id
if category:
  params["category"] = category
if audience:
  params["audience"] = audience

url = base + "/nextbot/studios/" + sid + "/services"

try:
  r = requests.get(url, headers=headers, params=params or None, timeout=(2.5, 7))
  try:
    body = r.json() if r.ok else r.text
  except Exception:
    body = r.text

  prompt_text = ""
  services = []
  if isinstance(body, dict):
    prompt_text = (
      body.get("get_services_and_prices")
      or body.get("prompt")
      or ""
    )
    raw = body.get("data") or []
    if not isinstance(raw, list):
      raw = []
    for s in raw:
      if not isinstance(s, dict):
        continue
      if s.get("isActive") is False:
        continue
      services.append({
        "id": s.get("id"),
        "name": s.get("name"),
        "description": s.get("description"),
        "defaultPrice": s.get("defaultPrice"),
        "defaultDurationMin": s.get("defaultDurationMin"),
      })

  result = {
    "ok": r.ok,
    "status": r.status_code,
    "data": services,
    "prompt": prompt_text,
  }
except Exception as e:
  result = {
    "ok": False,
    "status": 0,
    "data": [],
    "prompt": "",
    "error": "request_failed",
    "error_message": str(e),
  }
