# xmind: get_service_categories
# HTTP: GET {base_url}/nextbot/service-categories
# Args: base_url, api_key, organization_id, studio_id (опционально — принимается, но не обязателен)
# Ответ: {
#   "data": { "categories": [{ "id", "name", "available_in": [studioId...] }] },
#   "prompt": "<субпромпт>",
#   "ok": bool,
#   "status": int
# }
# Категории — общие для всей организации (сети салонов). `available_in` — ID филиалов,
# где категория НЕ отключена через StudioDisabledCategory.

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
params = {}
sid = str(args.get("studio_id", "") or "").strip()
if sid:
  params["studioId"] = sid

try:
  r = requests.get(
    base + "/nextbot/service-categories",
    headers=headers,
    params=params or None,
    timeout=15,
  )
  try:
    body = r.json() if r.ok else r.text
  except Exception:
    body = r.text

  prompt_text = ""
  categories = []
  if isinstance(body, dict):
    prompt_text = body.get("get_service_categories") or body.get("prompt") or ""
    raw = (body.get("data") or {}).get("categories") or body.get("categories") or []
    for c in raw:
      if not isinstance(c, dict):
        continue
      categories.append({
        "id": c.get("id"),
        "name": c.get("name"),
        "available_in": list(c.get("available_in") or []),
      })

  result = {
    "ok": r.ok,
    "status": r.status_code,
    "data": {"categories": categories},
    "prompt": prompt_text,
  }
except Exception as e:
  result = {
    "ok": False,
    "status": 0,
    "data": {"categories": []},
    "prompt": "",
    "error": "request_failed",
    "error_message": str(e),
  }
