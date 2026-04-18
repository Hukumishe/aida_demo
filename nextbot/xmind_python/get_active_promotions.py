# xmind: get_active_promotions
# HTTP: GET {base_url}/nextbot/landing/promotions
# Args: base_url, api_key, organization_id
# Акции действуют на всю организацию, поэтому studio_id НЕ требуется.
# Ответ: { "data": [ акции... ], "get_active_promotions": "<промпт>" }

base = args.get("base_url", "").rstrip("/")
headers = {
  "X-API-Key": args.get("api_key", ""),
  "X-Organization-Id": args.get("organization_id", ""),
  "Accept": "application/json",
}
url = base + "/nextbot/landing/promotions"
r = requests.get(url, headers=headers, timeout=15)
try:
  data = r.json() if r.ok else r.text
except Exception:
  data = r.text
result = {"ok": r.ok, "status": r.status_code, "data": data}